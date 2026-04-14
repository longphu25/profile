// SUI Walrus Upload Plugin — Main entry
// Two modes: Publisher (easy) vs Direct (own blob)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { walrus, WalrusFile, TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'

import {
  type NetworkKey,
  type UploadMode,
  type UploadResult,
  NET_CONFIG,
  TESTNET_PUBLISHERS,
  WALLET_KEY,
  formatSize,
  fileIcon,
} from './config'
import { ModeSelector } from './ModeSelector'
import { PublisherList } from './PublisherList'
import { StepTracker } from './StepTracker'
import { CostEstimate } from './CostEstimate'
import './style.css'

let sharedHost: SuiHostAPI | null = null

function WalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [epochs, setEpochs] = useState(5)
  const [deletable, setDeletable] = useState(false)
  const [mode, setMode] = useState<UploadMode>('publisher')
  const [publisherUrl, setPublisherUrl] = useState(TESTNET_PUBLISHERS[0]?.url ?? '')
  const [step, setStep] = useState('idle')
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
  const isConnected = !!walletAddr

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      const n = (p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
      setNetwork(n)
      // Auto-select first publisher for new network
      const pubs = n === 'testnet' ? TESTNET_PUBLISHERS : []
      if (pubs.length > 0) setPublisherUrl(pubs[0].url)
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
    if (!file || !sharedHost) return
    if (mode === 'direct' && !walletAddr) return
    setError(null)
    setResult(null)

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())

      if (mode === 'publisher') {
        // --- Publisher mode ---
        if (!publisherUrl) throw new Error('Select a publisher')
        setStep('uploading')
        setDetail(`Uploading to publisher...`)

        const url = `${publisherUrl}/v1/blobs?epochs=${epochs}${deletable ? '&deletable=true' : ''}`
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes.buffer as ArrayBuffer,
        })
        if (!res.ok)
          throw new Error(
            `Publisher ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`,
          )

        const data = await res.json()
        const blobId = data.newlyCreated?.blobObject?.blobId ?? data.alreadyCertified?.blobId ?? ''
        if (!blobId) throw new Error('No blob ID: ' + JSON.stringify(data).slice(0, 200))

        finishUpload(blobId, 'publisher')
      } else {
        // --- Direct mode ---
        const client = new SuiGrpcClient({ network, baseUrl: net.rpc })

        // Check + acquire WAL
        setStep('check-wal')
        setDetail('')
        const balRes = await client.core.getBalance({ owner: walletAddr!, coinType: net.walType })
        const bal = Number(balRes.balance.balance) / 1e9
        setWalBalance(bal)

        const cost = Math.max(0.5, (file.size / 1e6) * 0.5 * epochs)
        if (bal < cost) {
          setStep('acquire-wal')
          const needed = cost - bal + 0.1
          if (network === 'testnet') {
            setDetail(`Exchange ${needed.toFixed(2)} SUI → WAL`)
            const exId = TESTNET_WALRUS_PACKAGE_CONFIG.exchangeIds?.[0]
            if (!exId) throw new Error('No exchange object')

            // Resolve package ID dynamically from exchange object type
            const exRes = await fetch(net.rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sui_getObject',
                params: [exId, { showType: true }],
              }),
            }).then((r) => r.json())
            const exType: string = exRes.result?.data?.type ?? ''
            const exPkg = exType.split('::')[0]
            if (!exPkg || exPkg.length < 10) throw new Error('Cannot resolve exchange package')

            const neededMist = BigInt(Math.ceil(needed * 1e9))
            const tx = new Transaction()
            tx.setSender(walletAddr!)
            const [suiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(neededMist)])
            const [walCoin] = tx.moveCall({
              target: `${exPkg}::wal_exchange::exchange_for_wal`,
              arguments: [tx.object(exId), suiCoin, tx.pure.u64(neededMist)],
            })
            tx.transferObjects([walCoin, suiCoin], walletAddr!)
            await sharedHost.signAndExecuteTransaction(tx)
          } else {
            throw new Error('Insufficient WAL. Use WAL Swap plugin first.')
          }
        }

        // Encode + register + upload + certify
        setStep('encode')
        setDetail('WASM RedStuff encoding...')
        const wClient = client.$extend(
          walrus({
            wasmUrl: walrusWasmUrl,
            packageConfig: net.walrusConfig,
            uploadRelay: { host: net.uploadRelay, sendTip: { max: 10000 } },
          }),
        )

        const flow = wClient.walrus.writeFilesFlow({
          files: [WalrusFile.from({ contents: bytes, identifier: file.name })],
        })
        await flow.encode()

        setStep('register')
        setDetail('Sign register tx in wallet...')
        const regTx = flow.register({ epochs, owner: walletAddr!, deletable })
        const regResult = await sharedHost.signAndExecuteTransaction(regTx)

        setStep('upload')
        setDetail('Uploading slivers...')
        await flow.upload({ digest: regResult.digest })

        setStep('certify')
        setDetail('Sign certify tx in wallet...')
        const certTx = flow.certify()
        const certResult = await sharedHost.signAndExecuteTransaction(certTx)
        void certResult

        const files = await flow.listFiles()
        finishUpload(files[0]?.blobId ?? '', 'direct')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`[${step}] ${msg}`)
    } finally {
      if (step !== 'done') setStep('idle')
    }
  }, [file, epochs, deletable, walletAddr, network, net, mode, publisherUrl])

  function finishUpload(blobId: string, uploadMode: UploadMode) {
    if (!file) return
    const r: UploadResult = {
      blobId,
      url: `${net.aggregator}/v1/blobs/${blobId}`,
      size: file.size,
      fileName: file.name,
      mode: uploadMode,
      publisher: uploadMode === 'publisher' ? publisherUrl : undefined,
    }
    setResult(r)
    setHistory((prev) => {
      const next = [r, ...prev.slice(0, 9)]
      if (sharedHost) sharedHost.setSharedData('walrusUploads', next)
      return next
    })
    setStep('done')
    setDetail('')
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const pubSteps = ['encode', 'uploading', 'done']
  const directSteps = [
    'check-wal',
    'acquire-wal',
    'encode',
    'register',
    'upload',
    'certify',
    'done',
  ]

  return (
    <div className="sui-wup">
      <div className="sui-wup__header">
        <h3 className="sui-wup__title">Walrus Upload</h3>
        <p className="sui-wup__desc">Upload to Walrus · {network}</p>
      </div>

      {error && <div className="sui-wup__error">{error}</div>}

      {!isConnected && mode === 'direct' && (
        <div
          className="sui-wup__error"
          style={{ background: '#2a1a0a', borderColor: '#5c3a1a', color: '#fbbf24' }}
        >
          ⚠ Connect wallet for Direct mode
        </div>
      )}

      {isConnected && walBalance !== null && mode === 'direct' && (
        <div className="sui-wup__cost">
          <div className="sui-wup__cost-row">
            <span className="sui-wup__cost-label">WAL Balance</span>
            <span className="sui-wup__cost-val">{walBalance.toFixed(4)} WAL</span>
          </div>
        </div>
      )}

      {/* Mode selector */}
      {!uploading && !result && <ModeSelector mode={mode} onChange={setMode} />}

      {/* Publisher list (publisher mode) */}
      {!uploading && !result && mode === 'publisher' && (
        <PublisherList network={network} selected={publisherUrl} onSelect={setPublisherUrl} />
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
          <div className="sui-wup__drop-text">Drop file or click to browse</div>
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
          {file.type.startsWith('image/') ? (
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="sui-wup__preview-thumb"
              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
            />
          ) : (
            <div className="sui-wup__file-icon">{fileIcon(file.type)}</div>
          )}
          <div className="sui-wup__file-info">
            <div className="sui-wup__file-name">{file.name}</div>
            <div className="sui-wup__file-size">{formatSize(file.size)}</div>
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

      {/* Cost estimate */}
      {file && !uploading && !result && (
        <CostEstimate fileSize={file.size} epochs={epochs} mode={mode} publisher={publisherUrl} />
      )}

      {/* Step tracker */}
      {uploading && (
        <StepTracker
          steps={mode === 'publisher' ? pubSteps : directSteps}
          currentStep={step}
          detail={detail}
        />
      )}

      {/* Upload button */}
      {file && !uploading && !result && (
        <button
          className="sui-wup__action"
          disabled={mode === 'direct' && !isConnected}
          onClick={handleUpload}
        >
          {mode === 'publisher' ? `Upload via Publisher` : `Upload Direct`} ({epochs} epochs)
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="sui-wup__result">
          <div className="sui-wup__result-title">✓ Uploaded ({result.mode})</div>

          {/* Preview if image */}
          {file?.type.startsWith('image/') && (
            <div className="sui-wup__result-preview">
              <img src={result.url} alt="Uploaded" className="sui-wup__result-img" />
            </div>
          )}

          <div className="sui-wup__result-row">
            <span className="sui-wup__result-label">Blob ID</span>
            <span className="sui-wup__result-val">
              {result.blobId.slice(0, 24)}...
              <button className="sui-wup__copy" onClick={() => copy(result.blobId, 'blob')}>
                {copied === 'blob' ? '✓' : '⎘'}
              </button>
            </span>
          </div>
          <div className="sui-wup__result-row">
            <span className="sui-wup__result-label">View URL</span>
            <span className="sui-wup__result-val">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="sui-wup__link"
              >
                Open in browser ↗
              </a>
              <button className="sui-wup__copy" onClick={() => copy(result.url, 'url')}>
                {copied === 'url' ? '✓' : '⎘'}
              </button>
            </span>
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
            Upload Another
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !uploading && (
        <>
          <div className="sui-wup__section-title">Recent ({history.length})</div>
          {history.map((h) => (
            <div key={h.blobId} className="sui-wup__history-row">
              <div>
                <div className="sui-wup__history-name">{h.fileName}</div>
                <div className="sui-wup__history-id">
                  {h.blobId.slice(0, 24)}... · {h.mode}
                </div>
              </div>
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="sui-wup__link">
                View ↗
              </a>
            </div>
          ))}
        </>
      )}

      <div className="sui-wup__footer">
        <a
          href="https://docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-wup__link"
        >
          Walrus Docs
        </a>
      </div>
    </div>
  )
}

const SuiWalrusUploadPlugin: Plugin = {
  name: 'SuiWalrusUpload',
  version: '4.0.0',
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
