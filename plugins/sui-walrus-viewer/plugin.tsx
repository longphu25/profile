// SUI Walrus Viewer Plugin
// View and download files from Walrus by blob ID
// Uses public aggregator HTTP API for reads

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useState, useCallback } from 'react'
import './style.css'

const AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space'

interface BlobData {
  blobId: string
  bytes: Uint8Array
  contentType: string
  size: number
  objectUrl: string | null
}

function formatSize(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`
  return `${b} B`
}

function detectContentType(bytes: Uint8Array): string {
  // Magic bytes detection
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return 'application/pdf'
  if (bytes[0] === 0x7b) return 'application/json'
  // Try UTF-8 text
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 512))
    if (text.includes('<html') || text.includes('<!DOCTYPE')) return 'text/html'
    return 'text/plain'
  } catch {
    return 'application/octet-stream'
  }
}

function isTextType(ct: string): boolean {
  return ct.startsWith('text/') || ct === 'application/json'
}

function isImageType(ct: string): boolean {
  return ct.startsWith('image/')
}

function ViewerContent() {
  const [blobId, setBlobId] = useState('')
  const [data, setData] = useState<BlobData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ blobId: string; size: number }[]>([])

  const fetchBlob = useCallback(
    async (id?: string) => {
      const target = (id ?? blobId).trim()
      if (!target) return
      setLoading(true)
      setError(null)
      setData(null)

      try {
        const res = await fetch(`${AGGREGATOR}/v1/blobs/${target}`)
        if (!res.ok) throw new Error(`Aggregator: ${res.status} ${res.statusText}`)

        const bytes = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || detectContentType(bytes)

        let objectUrl: string | null = null
        if (isImageType(contentType)) {
          objectUrl = URL.createObjectURL(
            new Blob([bytes.buffer as ArrayBuffer], { type: contentType }),
          )
        }

        const result: BlobData = {
          blobId: target,
          bytes,
          contentType,
          size: bytes.length,
          objectUrl,
        }
        setData(result)

        setHistory((prev) => {
          if (prev.some((h) => h.blobId === target)) return prev
          return [{ blobId: target, size: bytes.length }, ...prev.slice(0, 9)]
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [blobId],
  )

  const handleDownload = () => {
    if (!data) return
    const blob = new Blob([data.bytes.buffer as ArrayBuffer], { type: data.contentType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `walrus-${data.blobId.slice(0, 12)}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const textContent =
    data && isTextType(data.contentType)
      ? new TextDecoder().decode(data.bytes.slice(0, 50_000))
      : null

  return (
    <div className="sui-wvw">
      <div className="sui-wvw__header">
        <h3 className="sui-wvw__title">Walrus Viewer</h3>
        <p className="sui-wvw__desc">View and download files from Walrus storage</p>
      </div>

      {/* Input */}
      <div className="sui-wvw__input-row">
        <input
          className="sui-wvw__input"
          type="text"
          placeholder="Enter blob ID..."
          value={blobId}
          onChange={(e) => setBlobId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchBlob()}
        />
        <button
          className="sui-wvw__btn"
          onClick={() => fetchBlob()}
          disabled={loading || !blobId.trim()}
        >
          {loading ? 'Loading...' : 'View'}
        </button>
      </div>

      {error && <div className="sui-wvw__error">{error}</div>}
      {loading && <div className="sui-wvw__loading">Fetching blob from Walrus...</div>}

      {data && (
        <>
          {/* Metadata */}
          <div className="sui-wvw__meta">
            <div className="sui-wvw__meta-row">
              <span className="sui-wvw__meta-label">Blob ID</span>
              <span className="sui-wvw__meta-val">{data.blobId.slice(0, 24)}...</span>
            </div>
            <div className="sui-wvw__meta-row">
              <span className="sui-wvw__meta-label">Content Type</span>
              <span className="sui-wvw__meta-val">{data.contentType}</span>
            </div>
            <div className="sui-wvw__meta-row">
              <span className="sui-wvw__meta-label">Size</span>
              <span className="sui-wvw__meta-val">{formatSize(data.size)}</span>
            </div>
          </div>

          {/* Preview */}
          <div className="sui-wvw__preview">
            <div className="sui-wvw__preview-title">Preview</div>
            {data.objectUrl && isImageType(data.contentType) ? (
              <img src={data.objectUrl} alt="Walrus blob" className="sui-wvw__preview-img" />
            ) : textContent !== null ? (
              <pre className="sui-wvw__preview-text">{textContent}</pre>
            ) : (
              <div className="sui-wvw__preview-binary">
                Binary file ({data.contentType}) — download to view
              </div>
            )}
          </div>

          {/* Download */}
          <div className="sui-wvw__download">
            <button className="sui-wvw__dl-btn" onClick={handleDownload}>
              ⬇ Download File
            </button>
            <a
              className="sui-wvw__dl-btn"
              href={`${AGGREGATOR}/v1/blobs/${data.blobId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ Open in Browser
            </a>
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <div className="sui-wvw__section-title">Recent ({history.length})</div>
          {history.map((h) => (
            <div
              key={h.blobId}
              className="sui-wvw__history-row"
              onClick={() => {
                setBlobId(h.blobId)
                fetchBlob(h.blobId)
              }}
            >
              <span className="sui-wvw__history-id">{h.blobId.slice(0, 28)}...</span>
              <span className="sui-wvw__history-size">{formatSize(h.size)}</span>
            </div>
          ))}
        </>
      )}

      <div className="sui-wvw__footer">
        Reads from{' '}
        <a
          href="https://docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-wvw__link"
        >
          Walrus
        </a>
        {' aggregator · No wallet needed'}
      </div>
    </div>
  )
}

const SuiWalrusViewerPlugin: Plugin = {
  name: 'SuiWalrusViewer',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-walrus-viewer/style.css'],
  init(host: HostAPI) {
    host.registerComponent('SuiWalrusViewer', ViewerContent)
    host.log('SuiWalrusViewer initialized')
  },
  mount() {
    console.log('[SuiWalrusViewer] mounted')
  },
  unmount() {
    console.log('[SuiWalrusViewer] unmounted')
  },
}

export default SuiWalrusViewerPlugin
