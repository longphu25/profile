// SUI Walrus Upload Plugin
// Upload files to Walrus with step-by-step flow
// Uses @mysten/walrus SDK + WASM + upload relay
// Signing via CurrentAccountSigner from wallet-profile's DAppKit

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus'
import './style.css'

type NetworkKey = 'mainnet' | 'testnet'

const NET_CONFIG: Record<
  NetworkKey,
  {
    rpc: string
    aggregator: string
    publisher: string
    walType: string
    exchangePackage: string
  }
> = {
  mainnet: {
    rpc: 'https://fullnode.mainnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-mainnet.walrus.space',
    publisher: '', // no public publisher on mainnet
    walType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
    exchangePackage: '',
  },
  testnet: {
    rpc: 'https://fullnode.testnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
    publisher: 'https://publisher.walrus-testnet.walrus.space',
    walType: '0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL',
    exchangePackage: '0x82593828ed3fcb8c6a235eac9abd0adbe9c5f9bbffa9b1e7a45cdd884481ef9f',
  },
}

const WALLET_KEY = 'walletProfile'

type StepId = 'idle' | 'check-wal' | 'acquire-wal' | 'encode' | 'uploading' | 'done'

const STEP_LABELS: Record<StepId, string> = {
  idle: '',
  'check-wal': 'Checking WAL balance...',
  'acquire-wal': 'Acquiring WAL...',
  encode: 'Encoding & uploading (WASM)...',
  uploading: 'Uploading via relay...',
  done: 'Upload complete!',
}

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

function WalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [epochs, setEpochs] = useState(5)
  const [deletable, setDeletable] = useState(false)
  const [step, setStep] = useState<StepId>('idle')
  const [detail, setDetail] = useState('')
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

  const uploading = step !== 'idle' && step !== 'done'
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
      setStep('check-wal')
      setDetail('')
      const balRes = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
      const bal = Number(balRes.balance.balance) / 1e9
      setWalBalance(bal)

      // Step 2: Acquire WAL if needed
      const estimatedCost = Math.max(0.5, (file.size / 1e6) * 0.5 * epochs)
      if (bal < estimatedCost) {
        const needed = estimatedCost - bal + 0.1
        const neededMist = BigInt(Math.ceil(needed * 1e9))
        setStep('acquire-wal')

        if (network === 'testnet') {
          setDetail(`Exchange ${needed.toFixed(2)} SUI → WAL (1:1 testnet)`)
          const exchangeId = TESTNET_WALRUS_PACKAGE_CONFIG.exchangeIds?.[0]
          if (!exchangeId) throw new Error('No testnet exchange object')

          const tx = new Transaction()
          tx.setSender(walletAddr)
          const [suiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(neededMist)])
          const [walCoin] = tx.moveCall({
            target: `${net.exchangePackage}::wal_exchange::exchange_for_wal`,
            arguments: [tx.object(exchangeId), suiCoin, tx.pure.u64(neededMist)],
          })
          tx.transferObjects([walCoin, suiCoin], walletAddr)
          await sharedHost.signAndExecuteTransaction(tx)
        } else {
          // Mainnet: skip auto-swap, just warn
          throw new Error(
            `Insufficient WAL balance (${bal.toFixed(4)} WAL). ` +
              `Need ~${estimatedCost.toFixed(4)} WAL. ` +
              `Use the WAL Swap plugin to get WAL first.`,
          )
        }

        const newBal = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
        setWalBalance(Number(newBal.balance.balance) / 1e9)
      }

      // Step 3: Upload via publisher HTTP API
      // Testnet: public publishers available with CORS
      // Mainnet: no public publisher — need Walrus CLI or own publisher
      if (!net.publisher) {
        throw new Error(
          'Mainnet has no public publisher for browser uploads. ' +
            'Use the Walrus CLI, Tusky app, or run your own publisher.',
        )
      }

      setStep('encode')
      setDetail('Reading file...')
      const bytes = new Uint8Array(await file.arrayBuffer())

      setStep('uploading')
      setDetail(`Uploading to ${network} publisher...`)

      const url = `${net.publisher}/v1/blobs?epochs=${epochs}${deletable ? '' : '&deletable=true'}&send_object_to=${walletAddr}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Publisher error ${res.status}: ${text.slice(0, 300)}`)
      }

      const data = await res.json()
      const blobInfo = data.newlyCreated?.blobObject ?? data.alreadyCertified ?? data
      const blobId = blobInfo?.blobId ?? ''

      if (!blobId) throw new Error('No blob ID in response: ' + JSON.stringify(data).slice(0, 200))

      // Done
      const uploadResult: UploadResult = {
        blobId,
        url: `${net.aggregator}/v1/blobs/${blobId}`,
        size: file.size,
        fileName: file.name,
      }
      setResult(uploadResult)
      setHistory((prev) => [uploadResult, ...prev.slice(0, 9)])
      setStep('done')
      setDetail('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStep('idle')
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

      {isConnected && walBalance !== null && (
        <div className="sui-wup__cost">
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">WAL Balance</span>
            <span className="sui-wup__cost-val">{walBalance.toFixed(4)} WAL</span>
          </div>
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">Network</span>
            <span className="sui-wup__cost-val">{network}</span>
          </div>
        </div>
      )}

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
          <div className="sui-wup__drop-hint">
            WASM encoding · Upload relay · Auto WAL exchange (testnet)
          </div>
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
                setStep('idle')
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

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

      {uploading && (
        <div className="sui-wup__steps">
          {(['check-wal', 'acquire-wal', 'encode', 'uploading', 'done'] as StepId[]).map((sid) => {
            const isCurrent = step === sid
            const allSteps: StepId[] = ['check-wal', 'acquire-wal', 'encode', 'uploading', 'done']
            const isDone = allSteps.indexOf(sid) < allSteps.indexOf(step)
            return (
              <div
                key={sid}
                className={`sui-wup__step ${isCurrent ? 'sui-wup__step--active' : ''} ${isDone ? 'sui-wup__step--done' : ''}`}
              >
                <span className="sui-wup__step-icon">{isDone ? '✓' : isCurrent ? '⏳' : '○'}</span>
                <span className="sui-wup__step-label">{STEP_LABELS[sid]}</span>
              </div>
            )
          })}
          {detail && <div className="sui-wup__step-detail">{detail}</div>}
          <div className="sui-wup__progress">
            <div className="sui-wup__progress-bar">
              <div
                className="sui-wup__progress-fill"
                style={{
                  width: `${step === 'check-wal' ? 15 : step === 'acquire-wal' ? 30 : step === 'encode' ? 50 : step === 'uploading' ? 75 : 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {file && !uploading && !result && (
        <button className="sui-wup__action" disabled={!isConnected} onClick={handleUpload}>
          {isConnected ? `Upload to Walrus (${epochs} epochs)` : 'Connect Wallet First'}
        </button>
      )}

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
              setStep('idle')
            }}
          >
            Upload Another File
          </button>
        </div>
      )}

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
        {' · WASM encoding · Upload relay'}
      </div>
    </div>
  )
}

const SuiWalrusUploadPlugin: Plugin = {
  name: 'SuiWalrusUpload',
  version: '2.0.0',
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
