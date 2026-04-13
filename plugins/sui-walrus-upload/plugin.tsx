// SUI Walrus Upload Plugin
// Upload files to Walrus decentralized storage
// Uses @mysten/walrus SDK with upload relay (browser-compatible)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { walrus, WalrusFile } from '@mysten/walrus'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'
import './style.css'

const AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space'
const UPLOAD_RELAY = 'https://upload-relay.mainnet.walrus.space'
const WALLET_KEY = 'walletProfile'

interface UploadResult {
  blobId: string
  url: string
  size: number
  fileName: string
}

let sharedHost: SuiHostAPI | null = null

function formatSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`
  return `${bytes} B`
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
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState('')
  const [pct, setPct] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [history, setHistory] = useState<UploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [walletAddr, setWalletAddr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Subscribe to wallet
  useEffect(() => {
    if (!sharedHost) return
    const d = sharedHost.getSharedData(WALLET_KEY) as { address: string } | null
    if (d) setWalletAddr(d.address)
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string } | null
      setWalletAddr(p?.address ?? null)
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
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      setStep('Initializing Walrus client...')
      setPct(10)

      // Create Walrus client with upload relay
      const client = new SuiGrpcClient({
        network: 'mainnet',
        baseUrl: 'https://fullnode.mainnet.sui.io:443',
      }).$extend(
        walrus({
          wasmUrl: walrusWasmUrl,
          uploadRelay: {
            host: UPLOAD_RELAY,
            sendTip: { max: 5000 },
          },
        }),
      )

      setStep('Reading file...')
      setPct(20)
      const bytes = new Uint8Array(await file.arrayBuffer())

      setStep('Encoding & uploading via relay...')
      setPct(40)

      // Use a temporary keypair for signing the upload tx
      // In production, this should use the connected wallet
      const signer = walletAddr
        ? undefined // TODO: use wallet signer when available
        : Ed25519Keypair.generate()

      if (!signer) {
        // Fallback: use publisher HTTP API directly via fetch proxy
        // This works if the publisher allows it
        throw new Error(
          'Wallet signing for Walrus uploads coming soon. ' +
            'For now, use the Walrus CLI or Tusky app to upload files.',
        )
      }

      const results = await client.walrus.writeFiles({
        files: [WalrusFile.from({ contents: bytes, identifier: file.name })],
        epochs,
        deletable: false,
        signer,
      })

      const r = results[0]
      const uploadResult: UploadResult = {
        blobId: r.blobId,
        url: `${AGGREGATOR}/v1/blobs/${r.blobId}`,
        size: file.size,
        fileName: file.name,
      }

      setResult(uploadResult)
      setHistory((prev) => [uploadResult, ...prev.slice(0, 9)])
      setStep('Done!')
      setPct(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      setTimeout(() => {
        setStep('')
        setPct(0)
      }, 2000)
    }
  }, [file, epochs, walletAddr])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="sui-wup">
      <div className="sui-wup__header">
        <h3 className="sui-wup__title">Walrus Upload</h3>
        <p className="sui-wup__desc">Upload files to Walrus decentralized storage (WASM)</p>
      </div>

      {error && <div className="sui-wup__error">{error}</div>}

      {/* Drop zone */}
      {!file && (
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
            Uses Walrus SDK + upload relay · WASM RedStuff encoding
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
          <button
            className="sui-wup__file-remove"
            onClick={() => {
              setFile(null)
              setResult(null)
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Options */}
      {file && !result && (
        <div className="sui-wup__options">
          <div className="sui-wup__field">
            <label className="sui-wup__label">Storage Epochs</label>
            <select
              className="sui-wup__select"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
            >
              {[1, 3, 5, 10, 25, 53].map((e) => (
                <option key={e} value={e}>
                  {e} epochs (~{e * 14} days)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Progress */}
      {step && (
        <div className="sui-wup__progress">
          <div className="sui-wup__progress-label">
            <span>{step}</span>
            <span>{pct}%</span>
          </div>
          <div className="sui-wup__progress-bar">
            <div className="sui-wup__progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && !result && (
        <button className="sui-wup__action" disabled={uploading} onClick={handleUpload}>
          {uploading ? 'Uploading...' : `Upload to Walrus (${epochs} epochs)`}
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
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
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
        {' · @mysten/walrus SDK + WASM encoding'}
      </div>
    </div>
  )
}

const SuiWalrusUploadPlugin: Plugin = {
  name: 'SuiWalrusUpload',
  version: '1.0.0',
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
