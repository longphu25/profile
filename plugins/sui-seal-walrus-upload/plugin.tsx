// SUI Seal + Walrus Upload Plugin
// Single flow: pick file → Seal encrypt → upload encrypted blob to Walrus → shareable link
// Encrypted blob can only be decrypted by authorized addresses (via Seal policy)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { SealClient } from '@mysten/seal'
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

const PUBLISHERS: Record<NetworkKey, string[]> = {
  testnet: [
    'https://publisher.walrus-testnet.walrus.space',
    'https://wal-publisher-testnet.staketab.org',
  ],
  mainnet: ['https://publisher.walrus.space'],
}

const AGGREGATORS: Record<NetworkKey, string> = {
  testnet: 'https://aggregator.walrus-testnet.walrus.space',
  mainnet: 'https://aggregator.walrus.space',
}

function SealWalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [packageId, setPackageId] = useState('0x...')
  const [policyId, setPolicyId] = useState('')
  const [epochs, setEpochs] = useState(5)
  const [step, setStep] = useState<'idle' | 'encrypting' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    blobId: string
    url: string
    size: number
    encSize: number
  } | null>(null)
  const [network, setNetwork] = useState<NetworkKey>('testnet')
  const [walletAddr, setWalletAddr] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sharedHost) return
    const d = sharedHost.getSharedData(WALLET_KEY) as { address: string; network: string } | null
    if (d) {
      setWalletAddr(d.address)
      setNetwork((d.network === 'mainnet' ? 'mainnet' : 'testnet') as NetworkKey)
    }
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'mainnet' ? 'mainnet' : 'testnet') as NetworkKey)
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setResult(null)
      setError(null)
    }
  }, [])

  const upload = useCallback(async () => {
    if (!file || !walletAddr || !sharedHost || !policyId) return
    setError(null)
    setResult(null)

    try {
      // Step 1: Encrypt with Seal
      setStep('encrypting')
      const rpc = RPC_URLS[network]
      const client = new SuiGrpcClient({ network, baseUrl: rpc })
      const sealClient = new SealClient({
        suiClient: client,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const plainBytes = new Uint8Array(await file.arrayBuffer())
      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId,
        id: policyId,
        data: plainBytes,
      })

      // Step 2: Upload encrypted blob to Walrus
      setStep('uploading')
      const publishers = PUBLISHERS[network]
      if (publishers.length === 0) throw new Error(`No publishers for ${network}`)

      let blobId = ''
      let lastErr = ''
      for (const pub of publishers) {
        try {
          const url = `${pub}/v1/blobs?epochs=${epochs}`
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: encryptedBytes.buffer as ArrayBuffer,
          })
          if (!res.ok) {
            lastErr = `${res.status}`
            continue
          }
          const data = await res.json()
          blobId = data.newlyCreated?.blobObject?.blobId ?? data.alreadyCertified?.blobId ?? ''
          if (blobId) break
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e)
        }
      }
      if (!blobId) throw new Error(`All publishers failed. Last: ${lastErr}`)

      const aggUrl = `${AGGREGATORS[network]}/v1/blobs/${blobId}`
      setResult({ blobId, url: aggUrl, size: plainBytes.length, encSize: encryptedBytes.length })
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('idle')
    }
  }, [file, walletAddr, packageId, policyId, epochs, network])

  function copyUrl() {
    if (!result) return
    navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const busy = step === 'encrypting' || step === 'uploading'

  return (
    <div className="sui-sew">
      <div className="sui-sew__header">
        <h3 className="sui-sew__title">Seal → Walrus Upload</h3>
        <span className="sui-sew__net">{network}</span>
      </div>

      {!walletAddr && <div className="sui-sew__warn">Connect wallet to upload</div>}
      {error && <div className="sui-sew__error">{error}</div>}

      {/* File drop zone */}
      <div
        className={`sui-sew__drop ${dragActive ? 'sui-sew__drop--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setFile(e.target.files[0])
              setResult(null)
            }
          }}
        />
        {file ? (
          <div className="sui-sew__file-info">
            <span className="sui-sew__file-name">{file.name}</span>
            <span className="sui-sew__file-size">{formatBytes(file.size)}</span>
          </div>
        ) : (
          <span className="sui-sew__drop-text">Drop file or click to select</span>
        )}
      </div>

      {/* Seal config */}
      <div className="sui-sew__fields">
        <div className="sui-sew__field">
          <label className="sui-sew__label">Seal Package ID</label>
          <input
            className="sui-sew__input"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <div className="sui-sew__field">
          <label className="sui-sew__label">Policy / Identity ID</label>
          <input
            className="sui-sew__input"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            placeholder="Allowlist or policy object ID"
          />
        </div>
        <div className="sui-sew__field sui-sew__field--sm">
          <label className="sui-sew__label">Epochs</label>
          <input
            className="sui-sew__input"
            type="number"
            min={1}
            max={200}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Upload button */}
      <button
        className="sui-sew__btn"
        onClick={upload}
        disabled={busy || !file || !walletAddr || !policyId}
      >
        {step === 'encrypting'
          ? 'Encrypting with Seal…'
          : step === 'uploading'
            ? 'Uploading to Walrus…'
            : 'Encrypt & Upload'}
      </button>

      {/* Result */}
      {result && (
        <div className="sui-sew__result">
          <div className="sui-sew__result-title">Encrypted & Uploaded</div>
          <div className="sui-sew__meta">
            <div className="sui-sew__meta-row">
              <span>Blob ID</span>
              <code>{shortenHex(result.blobId, 10)}</code>
            </div>
            <div className="sui-sew__meta-row">
              <span>Original</span>
              <code>{formatBytes(result.size)}</code>
            </div>
            <div className="sui-sew__meta-row">
              <span>Encrypted</span>
              <code>{formatBytes(result.encSize)}</code>
            </div>
            <div className="sui-sew__meta-row">
              <span>Epochs</span>
              <code>{epochs}</code>
            </div>
          </div>
          <div className="sui-sew__url-row">
            <input className="sui-sew__input sui-sew__input--url" readOnly value={result.url} />
            <button
              className={`sui-sew__copy ${copied ? 'sui-sew__copy--ok' : ''}`}
              onClick={copyUrl}
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="sui-sew__hint">
            Only addresses authorized by the Seal policy can decrypt this blob.
          </p>
        </div>
      )}

      <div className="sui-sew__footer">
        <span className="sui-sew__badge">Seal</span>
        <span className="sui-sew__badge sui-sew__badge--walrus">Walrus</span>
        <span className="sui-sew__disclaimer">
          Encrypted at rest — decryption requires Seal policy approval
        </span>
      </div>
    </div>
  )
}

const SuiSealWalrusUploadPlugin: Plugin = {
  name: 'SuiSealWalrusUpload',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-walrus-upload/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealWalrusUpload', SealWalrusUploadContent)
    host.log('SuiSealWalrusUpload initialized')
  },
  mount() {
    console.log('[SuiSealWalrusUpload] mounted')
  },
  unmount() {
    sharedHost = null
  },
}

export default SuiSealWalrusUploadPlugin
