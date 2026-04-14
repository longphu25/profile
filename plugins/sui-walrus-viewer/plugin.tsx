// SUI Walrus Viewer Plugin
// View and download files from Walrus by blob ID
// Shows owned blobs from connected wallet
// Uses public aggregator HTTP API for reads

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback, useEffect } from 'react'
import { blobIdFromInt } from '@mysten/walrus'
import './style.css'

const AGGREGATORS: Record<string, string> = {
  mainnet: 'https://aggregator.walrus-mainnet.walrus.space',
  testnet: 'https://aggregator.walrus-testnet.walrus.space',
}

const RPC: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

const WALLET_KEY = 'walletProfile'

interface BlobData {
  blobId: string
  bytes: Uint8Array
  contentType: string
  size: number
  objectUrl: string | null
}

interface OwnedBlob {
  objectId: string
  blobId: string
  size: number
  rawBlobId: string
}

let sharedHost: SuiHostAPI | null = null

function formatSize(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`
  return `${b} B`
}

function detectContentType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return 'application/pdf'
  if (bytes[0] === 0x7b) return 'application/json'
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
  const [ownedBlobs, setOwnedBlobs] = useState<OwnedBlob[]>([])
  const [ownedLoading, setOwnedLoading] = useState(false)
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    if (!sharedHost) return null
    const d = sharedHost.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [network, setNetwork] = useState<string>(() => {
    if (!sharedHost) return 'mainnet'
    const d = sharedHost.getSharedData(WALLET_KEY) as { network: string } | null
    return d?.network ?? 'mainnet'
  })

  const aggregator = AGGREGATORS[network] ?? AGGREGATORS.mainnet

  // Subscribe to wallet
  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork(p?.network ?? 'mainnet')
    })
  }, [])

  // Fetch owned blobs when wallet connects
  const fetchOwnedBlobs = useCallback(async (addr: string, net: string) => {
    setOwnedLoading(true)
    try {
      const rpc = RPC[net] ?? RPC.mainnet
      // Use JSON-RPC directly to filter by module::type pattern
      // Package ID changes on upgrades, so we search all objects and filter
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getOwnedObjects',
          params: [addr, { options: { showType: true, showContent: true } }, null, 50],
        }),
      })
      const json = await res.json()
      const objects = json.result?.data ?? []

      const blobs: OwnedBlob[] = []
      for (const obj of objects) {
        const type = obj.data?.type ?? ''
        if (!type.includes('::blob::Blob')) continue
        const fields = obj.data?.content?.fields ?? {}
        const rawBlobId = fields.blob_id ?? ''
        // Convert numeric blob_id to base64url using Walrus SDK
        let b64BlobId = ''
        try {
          b64BlobId = blobIdFromInt(BigInt(rawBlobId))
        } catch {
          b64BlobId = String(rawBlobId)
        }
        blobs.push({
          objectId: obj.data?.objectId ?? '',
          blobId: b64BlobId,
          size: Number(fields.size ?? 0),
          rawBlobId: String(rawBlobId),
        })
      }
      setOwnedBlobs(blobs)
    } catch {
      setOwnedBlobs([])
    } finally {
      setOwnedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (walletAddr) fetchOwnedBlobs(walletAddr, network)
  }, [walletAddr, network, fetchOwnedBlobs])

  const fetchBlob = useCallback(
    async (id?: string) => {
      const target = (id ?? blobId).trim()
      if (!target) return
      setLoading(true)
      setError(null)
      setData(null)

      try {
        const res = await fetch(`${aggregator}/v1/blobs/${target}`)
        if (!res.ok) throw new Error(`Aggregator: ${res.status} ${res.statusText}`)

        const bytes = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || detectContentType(bytes)

        let objectUrl: string | null = null
        if (isImageType(contentType)) {
          objectUrl = URL.createObjectURL(
            new Blob([bytes.buffer as ArrayBuffer], { type: contentType }),
          )
        }

        setData({ blobId: target, bytes, contentType, size: bytes.length, objectUrl })

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
    [blobId, aggregator],
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
        <p className="sui-wvw__desc">View files from Walrus · {network}</p>
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

          <div className="sui-wvw__download">
            <button className="sui-wvw__dl-btn" onClick={handleDownload}>
              ⬇ Download
            </button>
            <a
              className="sui-wvw__dl-btn"
              href={`${aggregator}/v1/blobs/${data.blobId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ Open in Browser
            </a>
          </div>
        </>
      )}

      {/* Owned blobs */}
      {walletAddr && (
        <>
          <div className="sui-wvw__section-title">
            My Blobs {ownedLoading ? '(loading...)' : `(${ownedBlobs.length})`}
          </div>
          {ownedBlobs.length === 0 && !ownedLoading && (
            <div className="sui-wvw__empty">No blob objects found for this wallet</div>
          )}
          {ownedBlobs.map((b) => (
            <div
              key={b.objectId}
              className="sui-wvw__history-row"
              onClick={() => {
                setBlobId(b.blobId)
                fetchBlob(b.blobId)
              }}
            >
              <span className="sui-wvw__history-id">
                {b.objectId.slice(0, 12)}...{b.objectId.slice(-6)}
              </span>
              <span className="sui-wvw__history-size">
                {b.size > 0 ? formatSize(b.size) : 'blob'}
              </span>
            </div>
          ))}
        </>
      )}

      {/* View history */}
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
        {' aggregator · '}
        {network}
      </div>
    </div>
  )
}

const SuiWalrusViewerPlugin: Plugin = {
  name: 'SuiWalrusViewer',
  version: '1.1.0',
  styleUrls: ['/plugins/sui-walrus-viewer/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiWalrusViewer', ViewerContent)
    host.log('SuiWalrusViewer initialized')
  },
  mount() {
    console.log('[SuiWalrusViewer] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiWalrusViewer] unmounted')
  },
}

export default SuiWalrusViewerPlugin
