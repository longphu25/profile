// SUI Walrus Upload Plugin
// Upload files to Walrus decentralized storage
// Uses @mysten/walrus SDK with WASM encoding (RedStuff)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback } from 'react'
import './style.css'

// Walrus aggregator for reads (no auth needed)
const AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space'
const PUBLISHER = 'https://publisher.walrus-mainnet.walrus.space'

const WALLET_KEY = 'walletProfile'

interface UploadResult {
  blobId: string
  objectId?: string
  url: string
  size: number
  fileName: string
}

let sharedHost: SuiHostAPI | null = null

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`
  return `${bytes} B`
}

function fileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📄'
  if (type.includes('json')) return '📋'
  return '📁'
}

function WalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [epochs, setEpochs] = useState(5)
  const [deletable, setDeletable] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ step: string; pct: number } | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [history, setHistory] = useState<UploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Subscribe to wallet profile
  useState(() => {
    if (!sharedHost) return
    sharedHost.onSharedDataChange(WALLET_KEY, () => {})
  })

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
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
      setProgress({ step: 'Reading file...', pct: 10 })
      const bytes = new Uint8Array(await file.arrayBuffer())

      setProgress({ step: 'Uploading to Walrus publisher...', pct: 30 })

      // Use the public publisher HTTP API
      const url = `${PUBLISHER}/v1/blobs?epochs=${epochs}${deletable ? '&deletable=true' : ''}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Publisher error ${res.status}: ${text.slice(0, 200)}`)
      }

      setProgress({ step: 'Processing response...', pct: 80 })
      const data = await res.json()

      // Response can be { newlyCreated: { blobObject: { blobId, id } } }
      // or { alreadyCertified: { blobId, ... } }
      const blobInfo = data.newlyCreated?.blobObject ?? data.alreadyCertified
      const blobId = blobInfo?.blobId ?? data.newlyCreated?.blobObject?.blobId ?? ''
      const objectId = blobInfo?.id ?? ''

      const uploadResult: UploadResult = {
        blobId,
        objectId,
        url: `${AGGREGATOR}/v1/blobs/${blobId}`,
        size: file.size,
        fileName: file.name,
      }

      setResult(uploadResult)
      setHistory((prev) => [uploadResult, ...prev.slice(0, 9)])
      setProgress({ step: 'Done!', pct: 100 })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(null), 2000)
    }
  }, [file, epochs, deletable])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="sui-wup">
      <div className="sui-wup__header">
        <h3 className="sui-wup__title">Walrus Upload</h3>
        <p className="sui-wup__desc">Upload files to Walrus decentralized storage</p>
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
            Any file type · Max recommended 10MB via publisher
          </div>
          <input ref={inputRef} type="file" hidden onChange={handleFileSelect} />
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
          <div className="sui-wup__field">
            <label className="sui-wup__label">Deletable</label>
            <select
              className="sui-wup__select"
              value={deletable ? 'yes' : 'no'}
              onChange={(e) => setDeletable(e.target.value === 'yes')}
            >
              <option value="no">No (permanent)</option>
              <option value="yes">Yes (owner can delete)</option>
            </select>
          </div>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="sui-wup__progress">
          <div className="sui-wup__progress-label">
            <span>{progress.step}</span>
            <span>{progress.pct}%</span>
          </div>
          <div className="sui-wup__progress-bar">
            <div className="sui-wup__progress-fill" style={{ width: `${progress.pct}%` }} />
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
        {' · Uses public publisher (no wallet needed for small files)'}
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
