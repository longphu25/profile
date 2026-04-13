// SUI Walrus Upload Plugin
// Upload files to Walrus with step-by-step popup flow
// Steps: Check WAL → Acquire WAL → Encode → Register → Upload → Certify → Done
// Uses @mysten/walrus SDK + WASM + upload relay

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { walrus, WalrusFile } from '@mysten/walrus'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds } from '@mysten/deepbook-v3'
import { MAINNET_WALRUS_PACKAGE_CONFIG, TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'
import './style.css'

type NetworkKey = 'mainnet' | 'testnet'

const NET_CONFIG: Record<
  NetworkKey,
  {
    rpc: string
    aggregator: string
    uploadRelay: string
    walType: string
  }
> = {
  mainnet: {
    rpc: 'https://fullnode.mainnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-mainnet.walrus.space',
    uploadRelay: 'https://upload-relay.mainnet.walrus.space',
    walType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
  },
  testnet: {
    rpc: 'https://fullnode.testnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
    uploadRelay: 'https://upload-relay.testnet.walrus.space',
    walType: '0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL',
  },
}

const WALLET_KEY = 'walletProfile'

type UploadStep =
  | { id: 'idle' }
  | { id: 'check-wal'; label: 'Checking WAL balance...' }
  | { id: 'acquire-wal'; label: 'Acquiring WAL...'; detail: string }
  | { id: 'encode'; label: 'Encoding file (WASM)...' }
  | { id: 'register'; label: 'Register blob on-chain'; detail: 'Sign transaction in wallet' }
  | { id: 'upload'; label: 'Uploading to storage nodes...' }
  | { id: 'certify'; label: 'Certify blob on-chain'; detail: 'Sign transaction in wallet' }
  | { id: 'done'; label: 'Upload complete!' }

const STEPS: UploadStep['id'][] = [
  'check-wal',
  'acquire-wal',
  'encode',
  'register',
  'upload',
  'certify',
  'done',
]

interface UploadResult {
  blobId: string
  url: string
  size: number
  fileName: string
}

let sharedHost: SuiHostAPI | null = null

function formatSize(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`
  return `${b} B`
}

function fileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📄'
  return '📁'
}

function stepPct(id: UploadStep['id']): number {
  const idx = STEPS.indexOf(id)
  return idx < 0 ? 0 : Math.round(((idx + 1) / STEPS.length) * 100)
}

function WalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [epochs, setEpochs] = useState(5)
  const [deletable, setDeletable] = useState(false)
  const [currentStep, setCurrentStep] = useState<UploadStep>({ id: 'idle' })
  const [result, setResult] = useState<UploadResult | null>(null)
  const [history, setHistory] = useState<UploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [network, setNetwork] = useState<NetworkKey>(() => {
    if (!sharedHost) return 'mainnet'
    const d = sharedHost.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    if (!sharedHost) return null
    const d = sharedHost.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [walBalance, setWalBalance] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploading = currentStep.id !== 'idle' && currentStep.id !== 'done'
  const net = NET_CONFIG[network]

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey)
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file || !walletAddr || !sharedHost) return
    setError(null)
    setResult(null)

    const client = new SuiGrpcClient({ network, baseUrl: net.rpc })

    try {
      // Step 1: Check WAL balance
      setCurrentStep({ id: 'check-wal', label: 'Checking WAL balance...' })
      const balRes = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
      const bal = Number(balRes.balance.balance) / 1e9
      setWalBalance(bal)

      // Step 2: Acquire WAL if needed (rough estimate: 0.1 WAL per MB per epoch)
      const estimatedCost = Math.max(0.01, (file.size / 1e6) * 0.1 * epochs)
      if (bal < estimatedCost) {
        const needed = estimatedCost - bal + 0.01 // buffer
        const neededMist = BigInt(Math.ceil(needed * 1e9))

        if (network === 'testnet') {
          // Testnet: exchange SUI → WAL 1:1 via exchange objects
          setCurrentStep({
            id: 'acquire-wal',
            label: 'Acquiring WAL...',
            detail: `Exchanging ${needed.toFixed(4)} SUI → WAL (1:1 testnet exchange)`,
          })
          const exchangeId = TESTNET_WALRUS_PACKAGE_CONFIG.exchangeIds?.[0]
          if (!exchangeId) throw new Error('No testnet exchange object available')

          // Get the walrus package ID from system object
          const sysObj = await client.core.getObject({
            objectId: TESTNET_WALRUS_PACKAGE_CONFIG.systemObjectId,
            include: { content: true },
          })
          void sysObj // package ID inferred by SDK

          const exchangeTx = new Transaction()
          exchangeTx.setSender(walletAddr)
          const [suiCoin] = exchangeTx.splitCoins(exchangeTx.gas, [exchangeTx.pure.u64(neededMist)])
          exchangeTx.moveCall({
            target: `${TESTNET_WALRUS_PACKAGE_CONFIG.systemObjectId}::wal_exchange::exchange`,
            arguments: [exchangeTx.object(exchangeId), suiCoin],
          })
          await sharedHost.signAndExecuteTransaction(exchangeTx)
        } else {
          // Mainnet: swap SUI → WAL via DeepBook
          setCurrentStep({
            id: 'acquire-wal',
            label: 'Acquiring WAL...',
            detail: `Swapping ${needed.toFixed(4)} SUI → WAL via DeepBook`,
          })
          const dbClient = new DeepBookClient({
            client,
            address: walletAddr,
            network,
            coins: mainnetCoins,
            pools: mainnetPools,
            packageIds: mainnetPackageIds,
          })
          const swapTx = new Transaction()
          swapTx.setSender(walletAddr)
          dbClient.deepBook.swapExactQuoteForBase({
            poolKey: 'WAL_SUI',
            amount: needed,
            deepAmount: 0,
            minOut: needed * 0.95,
          })(swapTx)
          await sharedHost.signAndExecuteTransaction(swapTx)
        }

        // Re-check balance
        const newBal = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
        setWalBalance(Number(newBal.balance.balance) / 1e9)
      }

      // Step 3: Encode
      setCurrentStep({ id: 'encode', label: 'Encoding file (WASM)...' })
      const bytes = new Uint8Array(await file.arrayBuffer())
      const walrusClient = client.$extend(
        walrus({
          wasmUrl: walrusWasmUrl,
          packageConfig:
            network === 'mainnet' ? MAINNET_WALRUS_PACKAGE_CONFIG : TESTNET_WALRUS_PACKAGE_CONFIG,
          uploadRelay: { host: net.uploadRelay, sendTip: { max: 5000 } },
        }),
      )

      const flow = walrusClient.walrus.writeFilesFlow({
        files: [WalrusFile.from({ contents: bytes, identifier: file.name })],
      })
      await flow.encode()

      // Step 4: Register (wallet popup)
      setCurrentStep({
        id: 'register',
        label: 'Register blob on-chain',
        detail: 'Sign transaction in wallet',
      })
      const registerTx = flow.register({ epochs, owner: walletAddr, deletable })
      await sharedHost.signAndExecuteTransaction(registerTx)

      // Step 5: Upload slivers
      setCurrentStep({ id: 'upload', label: 'Uploading to storage nodes...' })
      await flow.upload()

      // Step 6: Certify (wallet popup)
      setCurrentStep({
        id: 'certify',
        label: 'Certify blob on-chain',
        detail: 'Sign transaction in wallet',
      })
      const certifyTx = flow.certify()
      await sharedHost.signAndExecuteTransaction(certifyTx)

      // Step 7: Done
      const files = await flow.listFiles()
      const blobId = files[0]?.blobId ?? ''
      const uploadResult: UploadResult = {
        blobId,
        url: `${net.aggregator}/v1/blobs/${blobId}`,
        size: file.size,
        fileName: file.name,
      }
      setResult(uploadResult)
      setHistory((prev) => [uploadResult, ...prev.slice(0, 9)])
      setCurrentStep({ id: 'done', label: 'Upload complete!' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setCurrentStep({ id: 'idle' })
    }
  }, [file, epochs, deletable, walletAddr, network, net])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const isConnected = !!walletAddr

  return (
    <div className="sui-wup">
      <div className="sui-wup__header">
        <h3 className="sui-wup__title">Walrus Upload</h3>
        <p className="sui-wup__desc">Upload files to Walrus decentralized storage</p>
      </div>

      {error && <div className="sui-wup__error">{error}</div>}

      {/* Wallet status */}
      {!isConnected && (
        <div
          className="sui-wup__error"
          style={{ background: '#2a1a0a', borderColor: '#5c3a1a', color: '#fbbf24' }}
        >
          ⚠ Connect wallet via <strong>Wallet Profile</strong> plugin to upload
          {sharedHost && (
            <button
              className="sui-wup__action sui-wup__action--connect"
              style={{ marginTop: 8 }}
              onClick={() => sharedHost!.requestConnect()}
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* WAL balance */}
      {isConnected && walBalance !== null && (
        <div className="sui-wup__cost">
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">WAL Balance</span>
            <span className="sui-wup__cost-val">{walBalance.toFixed(4)} WAL</span>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!file && !uploading && (
        <div
          className={`sui-wup__drop ${dragActive ? 'sui-wup__drop--active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="sui-wup__drop-icon">📤</div>
          <div className="sui-wup__drop-text">Drop file here or click to browse</div>
          <div className="sui-wup__drop-hint">WASM RedStuff encoding · Auto WAL swap if needed</div>
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                setFile(f)
                setResult(null)
                setError(null)
              }
            }}
          />
        </div>
      )}

      {/* File info */}
      {file && (
        <div className="sui-wup__file">
          <div className="sui-wup__file-icon">{fileIcon(file.type)}</div>
          <div className="sui-wup__file-info">
            <div className="sui-wup__file-name">{file.name}</div>
            <div className="sui-wup__file-size">
              {formatSize(file.size)} · {file.type || 'unknown'}
            </div>
          </div>
          {!uploading && (
            <button
              className="sui-wup__file-remove"
              onClick={() => {
                setFile(null)
                setResult(null)
                setCurrentStep({ id: 'idle' })
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Options */}
      {file && !uploading && !result && (
        <div className="sui-wup__options">
          <div className="sui-wup__field">
            <label className="sui-wup__label">Epochs</label>
            <select
              className="sui-wup__select"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
            >
              {[1, 3, 5, 10, 25, 53].map((e) => (
                <option key={e} value={e}>
                  {e} (~{e * 14}d)
                </option>
              ))}
            </select>
          </div>
          <div className="sui-wup__field">
            <label className="sui-wup__label">Deletable</label>
            <select
              className="sui-wup__select"
              value={deletable ? '1' : '0'}
              onChange={(e) => setDeletable(e.target.value === '1')}
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </select>
          </div>
        </div>
      )}

      {/* Step-by-step progress */}
      {uploading && (
        <div className="sui-wup__steps">
          {STEPS.map((sid) => {
            const isCurrent = currentStep.id === sid
            const isDone = STEPS.indexOf(sid) < STEPS.indexOf(currentStep.id)
            return (
              <div
                key={sid}
                className={`sui-wup__step ${isCurrent ? 'sui-wup__step--active' : ''} ${isDone ? 'sui-wup__step--done' : ''}`}
              >
                <span className="sui-wup__step-icon">{isDone ? '✓' : isCurrent ? '⏳' : '○'}</span>
                <span className="sui-wup__step-label">
                  {sid === 'check-wal' && 'Check WAL balance'}
                  {sid === 'acquire-wal' && 'Acquire WAL'}
                  {sid === 'encode' && 'Encode file (WASM)'}
                  {sid === 'register' && 'Register blob'}
                  {sid === 'upload' && 'Upload to nodes'}
                  {sid === 'certify' && 'Certify blob'}
                  {sid === 'done' && 'Done'}
                </span>
              </div>
            )
          })}
          {'detail' in currentStep && currentStep.detail && (
            <div className="sui-wup__step-detail">{currentStep.detail}</div>
          )}
          <div className="sui-wup__progress">
            <div className="sui-wup__progress-bar">
              <div
                className="sui-wup__progress-fill"
                style={{ width: `${stepPct(currentStep.id)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && !uploading && !result && (
        <button className="sui-wup__action" disabled={!isConnected} onClick={handleUpload}>
          {isConnected ? `Upload to Walrus (${epochs} epochs)` : 'Connect Wallet First'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="sui-wup__result">
          <div className="sui-wup__result-title">✓ Upload Successful</div>
          <div className="sui-wup__result-row">
            <span className="sui-wup__result-label">Blob ID</span>
            <span className="sui-wup__result-val">
              {result.blobId.slice(0, 20)}...
              <button className="sui-wup__copy" onClick={() => copy(result.blobId, 'blob')}>
                {copied === 'blob' ? '✓' : '⎘'}
              </button>
            </span>
          </div>
          <div className="sui-wup__result-row">
            <span className="sui-wup__result-label">URL</span>
            <span className="sui-wup__result-val">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="sui-wup__link"
              >
                Open ↗
              </a>
              <button className="sui-wup__copy" onClick={() => copy(result.url, 'url')}>
                {copied === 'url' ? '✓' : '⎘'}
              </button>
            </span>
          </div>
          <div className="sui-wup__result-row">
            <span className="sui-wup__result-label">Size</span>
            <span className="sui-wup__result-val">{formatSize(result.size)}</span>
          </div>
          <button
            className="sui-wup__action"
            style={{ marginTop: 10 }}
            onClick={() => {
              setFile(null)
              setResult(null)
              setCurrentStep({ id: 'idle' })
            }}
          >
            Upload Another File
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !uploading && (
        <>
          <div className="sui-wup__section-title">Recent Uploads ({history.length})</div>
          {history.map((h) => (
            <div key={h.blobId} className="sui-wup__history-row">
              <div>
                <div className="sui-wup__history-name">{h.fileName}</div>
                <div className="sui-wup__history-id">{h.blobId.slice(0, 24)}...</div>
              </div>
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="sui-wup__link">
                View ↗
              </a>
            </div>
          ))}
        </>
      )}

      <div className="sui-wup__footer">
        Powered by{' '}
        <a
          href="https://docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-wup__link"
        >
          Walrus
        </a>
        {' · WASM encoding · Auto WAL swap via DeepBook'}
      </div>
    </div>
  )
}

const SuiWalrusUploadPlugin: Plugin = {
  name: 'SuiWalrusUpload',
  version: '1.1.0',
  styleUrls: ['/plugins/sui-walrus-upload/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiWalrusUpload', WalrusUploadContent)
    host.log('SuiWalrusUpload initialized')
  },
  mount() {
    console.log('[SuiWalrusUpload] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiWalrusUpload] unmounted')
  },
}

export default SuiWalrusUploadPlugin
