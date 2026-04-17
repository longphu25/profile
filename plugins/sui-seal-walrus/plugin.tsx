// SUI Seal + Walrus Plugin
// Encrypt files with Seal, upload to Walrus, decrypt & download with access control

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal'
import { fromHex } from '@mysten/bcs'
import {
  WALLET_KEY,
  TESTNET_KEY_SERVERS,
  DEFAULT_THRESHOLD,
  RPC_URLS,
  shortenHex,
  formatBytes,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

const AGGREGATORS: Record<NetworkKey, string> = {
  testnet: 'https://aggregator.walrus-testnet.walrus.space',
  mainnet: 'https://aggregator.walrus-mainnet.walrus.space',
}

const PUBLISHERS: Record<NetworkKey, string> = {
  testnet: 'https://publisher.walrus-testnet.walrus.space',
  mainnet: '', // mainnet publishers vary
}

type Tab = 'upload' | 'download'

interface UploadRecord {
  blobId: string
  fileName: string
  size: number
  encryptedSize: number
  identityId: string
  timestamp: number
}

function SealWalrusContent() {
  const [tab, setTab] = useState<Tab>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [packageId, setPackageId] = useState('')
  const [identityId, setIdentityId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [uploadResult, setUploadResult] = useState<UploadRecord | null>(null)
  const [history, setHistory] = useState<UploadRecord[]>([])

  // Download state
  const [dlBlobId, setDlBlobId] = useState('')
  const [dlPackageId, setDlPackageId] = useState('')
  const [dlModuleName, setDlModuleName] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [dlStep, setDlStep] = useState('')
  const [dlResult, setDlResult] = useState<{ text: string | null; bytes: Uint8Array } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [network, setNetwork] = useState<NetworkKey>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey)
    })
  }, [])

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  // --- UPLOAD: Encrypt + Upload to Walrus ---
  const handleUpload = async () => {
    setError(null)
    setUploadResult(null)
    if (!file) {
      setError('Select a file')
      return
    }
    if (!packageId.trim() || !identityId.trim()) {
      setError('Package ID and Identity ID required')
      return
    }

    setUploading(true)
    try {
      // Step 1: Encrypt
      setUploadStep('Encrypting with Seal…')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const rawData = new Uint8Array(await file.arrayBuffer())
      const { encryptedObject } = await sealClient.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: packageId.trim(),
        id: identityId.trim(),
        data: rawData,
      })

      // Step 2: Upload encrypted blob to Walrus via publisher HTTP API
      setUploadStep('Uploading to Walrus…')
      const publisherUrl = PUBLISHERS[network]
      if (!publisherUrl) throw new Error('No publisher configured for ' + network)

      const resp = await fetch(`${publisherUrl}/v1/blobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: encryptedObject,
      })
      if (!resp.ok) throw new Error(`Walrus upload failed: ${resp.status} ${resp.statusText}`)
      const body = await resp.json()

      // Publisher returns { newlyCreated: { blobObject: { blobId } } } or { alreadyCertified: { blobId } }
      const blobId = body.newlyCreated?.blobObject?.blobId ?? body.alreadyCertified?.blobId
      if (!blobId) throw new Error('No blob ID in response')

      const record: UploadRecord = {
        blobId,
        fileName: file.name,
        size: rawData.length,
        encryptedSize: encryptedObject.length,
        identityId,
        timestamp: Date.now(),
      }
      setUploadResult(record)
      setHistory((h) => [record, ...h].slice(0, 20))
      setUploadStep('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setUploadStep('')
    } finally {
      setUploading(false)
    }
  }

  // --- DOWNLOAD: Fetch from Walrus + Decrypt ---
  const handleDownload = async () => {
    setError(null)
    setDlResult(null)
    if (!walletAddr || !sharedHost) {
      setError('Connect wallet first')
      return
    }
    if (!dlBlobId.trim()) {
      setError('Enter blob ID')
      return
    }
    if (!dlPackageId.trim() || !dlModuleName.trim()) {
      setError('Package ID and module name required')
      return
    }

    setDownloading(true)
    try {
      // Step 1: Fetch encrypted blob from Walrus
      setDlStep('Fetching from Walrus…')
      const aggUrl = AGGREGATORS[network]
      const resp = await fetch(`${aggUrl}/v1/blobs/${dlBlobId}`)
      if (!resp.ok) throw new Error(`Walrus fetch failed: ${resp.status}`)
      const encBytes = new Uint8Array(await resp.arrayBuffer())

      const parsed = EncryptedObject.parse(encBytes)

      // Step 2: Create session key
      setDlStep('Creating session key…')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const sessionKey = await SessionKey.create({
        address: walletAddr,
        packageId: dlPackageId.trim(),
        ttlMin: 10,
        suiClient,
      })

      // Step 3: Sign
      setDlStep('Waiting for wallet signature…')
      const message = sessionKey.getPersonalMessage()
      const { signature } = await sharedHost.signPersonalMessage(message)
      await sessionKey.setPersonalMessageSignature(signature)

      // Step 4: Decrypt
      setDlStep('Decrypting…')
      const tx = new Transaction()
      tx.moveCall({
        target: `${dlPackageId}::${dlModuleName}::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id))],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      const plaintext = await sealClient.decrypt({ data: encBytes, sessionKey, txBytes })

      let text: string | null = null
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
      } catch {
        /* binary data */
      }
      setDlResult({ text, bytes: plaintext })
      setDlStep('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setDlStep('')
    } finally {
      setDownloading(false)
    }
  }

  const downloadFile = () => {
    if (!dlResult) return
    const blob = new Blob([dlResult.bytes.slice().buffer])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'decrypted-file'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }, [])

  return (
    <div className="sui-sw">
      <div className="sui-sw__header">
        <h3 className="sui-sw__title">Seal + Walrus</h3>
        <p className="sui-sw__desc">Encrypted file storage on Walrus with Seal access control</p>
      </div>

      {!walletAddr && <div className="sui-sw__warn">Connect wallet for full functionality</div>}

      {/* Tabs */}
      <div className="sui-sw__tabs">
        <button
          className={`sui-sw__tab ${tab === 'upload' ? 'sui-sw__tab--active' : ''}`}
          onClick={() => {
            setTab('upload')
            setError(null)
          }}
        >
          Encrypt & Upload
        </button>
        <button
          className={`sui-sw__tab ${tab === 'download' ? 'sui-sw__tab--active' : ''}`}
          onClick={() => {
            setTab('download')
            setError(null)
          }}
        >
          Fetch & Decrypt
        </button>
      </div>

      {tab === 'upload' && (
        <>
          {/* Drop zone */}
          <div
            className={`sui-sw__drop ${dragActive ? 'sui-sw__drop--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('sw-file-input')?.click()}
          >
            <input
              id="sw-file-input"
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span>
                {file.name} ({formatBytes(file.size)})
              </span>
            ) : (
              <span>Drop file here or click to select</span>
            )}
          </div>

          <div className="sui-sw__field">
            <label className="sui-sw__label">Package ID</label>
            <input
              className="sui-sw__input"
              placeholder="0x…"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            />
          </div>
          <div className="sui-sw__field">
            <label className="sui-sw__label">Identity ID</label>
            <input
              className="sui-sw__input"
              placeholder="0x…"
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
            />
          </div>

          {uploadStep && <div className="sui-sw__step">{uploadStep}</div>}

          <button className="sui-sw__btn" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Processing…' : 'Encrypt & Upload'}
          </button>

          {uploadResult && (
            <div className="sui-sw__result">
              <div className="sui-sw__result-title">Uploaded Successfully</div>
              <div className="sui-sw__meta-row">
                <span className="sui-sw__meta-label">Blob ID</span>
                <button className="sui-sw__copy" onClick={() => copy(uploadResult.blobId, 'blob')}>
                  {copied === 'blob' ? 'Copied!' : shortenHex(uploadResult.blobId, 8)}
                </button>
              </div>
              <div className="sui-sw__meta-row">
                <span className="sui-sw__meta-label">Original</span>
                <span className="sui-sw__meta-val">{formatBytes(uploadResult.size)}</span>
              </div>
              <div className="sui-sw__meta-row">
                <span className="sui-sw__meta-label">Encrypted</span>
                <span className="sui-sw__meta-val">{formatBytes(uploadResult.encryptedSize)}</span>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="sui-sw__history">
              <div className="sui-sw__history-title">Upload History</div>
              {history.map((h, i) => (
                <div key={i} className="sui-sw__history-row">
                  <span className="sui-sw__history-name">{h.fileName}</span>
                  <button className="sui-sw__copy" onClick={() => copy(h.blobId, `h${i}`)}>
                    {copied === `h${i}` ? 'Copied!' : 'Copy Blob ID'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'download' && (
        <>
          <div className="sui-sw__field">
            <label className="sui-sw__label">Blob ID</label>
            <input
              className="sui-sw__input"
              placeholder="Walrus blob ID"
              value={dlBlobId}
              onChange={(e) => setDlBlobId(e.target.value)}
            />
          </div>
          <div className="sui-sw__field">
            <label className="sui-sw__label">Package ID</label>
            <input
              className="sui-sw__input"
              placeholder="0x…"
              value={dlPackageId}
              onChange={(e) => setDlPackageId(e.target.value)}
            />
          </div>
          <div className="sui-sw__field">
            <label className="sui-sw__label">Module Name</label>
            <input
              className="sui-sw__input"
              placeholder="e.g. whitelist"
              value={dlModuleName}
              onChange={(e) => setDlModuleName(e.target.value)}
            />
          </div>

          {dlStep && <div className="sui-sw__step">{dlStep}</div>}

          <button
            className="sui-sw__btn"
            onClick={handleDownload}
            disabled={downloading || !walletAddr}
          >
            {downloading ? 'Processing…' : 'Fetch & Decrypt'}
          </button>

          {dlResult && (
            <div className="sui-sw__result">
              <div className="sui-sw__result-title">Decrypted Successfully</div>
              {dlResult.text !== null ? (
                <div className="sui-sw__preview-text">{dlResult.text}</div>
              ) : (
                <div className="sui-sw__preview-binary">
                  Binary data — {formatBytes(dlResult.bytes.length)}
                </div>
              )}
              <div className="sui-sw__actions">
                {dlResult.text !== null && (
                  <button
                    className="sui-sw__copy"
                    onClick={() => {
                      navigator.clipboard.writeText(dlResult.text!)
                      setCopied('dl')
                      setTimeout(() => setCopied(null), 1500)
                    }}
                  >
                    {copied === 'dl' ? 'Copied!' : 'Copy Text'}
                  </button>
                )}
                <button className="sui-sw__btn-sm" onClick={downloadFile}>
                  Download File
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="sui-sw__error">{error}</div>}

      <div className="sui-sw__footer">
        <span className="sui-sw__net">{network}</span>
        <a
          href="https://seal-docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-sw__link"
        >
          Seal Docs
        </a>
      </div>
    </div>
  )
}

const SuiSealWalrusPlugin: Plugin = {
  name: 'SuiSealWalrus',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-walrus/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealWalrus', SealWalrusContent)
    host.log('SuiSealWalrus initialized')
  },
  mount() {
    console.log('[SuiSealWalrus] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealWalrus] unmounted')
  },
}

export default SuiSealWalrusPlugin
