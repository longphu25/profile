// SUI Seal Encrypt Plugin
// Encrypt arbitrary text/files using Seal threshold encryption

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { SealClient } from '@mysten/seal'
import { toHex } from '@mysten/bcs'
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

interface EncryptResult {
  id: string
  encryptedHex: string
  backupKeyHex: string
  size: number
  timestamp: number
}

function SealEncryptContent() {
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [packageId, setPackageId] = useState('')
  const [identityId, setIdentityId] = useState('')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [encrypting, setEncrypting] = useState(false)
  const [result, setResult] = useState<EncryptResult | null>(null)
  const [history, setHistory] = useState<EncryptResult[]>([])
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

  const handleEncrypt = async () => {
    setError(null)
    setResult(null)

    if (!packageId.trim() || !identityId.trim()) {
      setError('Package ID and Identity ID are required')
      return
    }

    let data: Uint8Array
    if (mode === 'text') {
      if (!text.trim()) {
        setError('Enter text to encrypt')
        return
      }
      data = new TextEncoder().encode(text)
    } else {
      if (!file) {
        setError('Select a file')
        return
      }
      data = new Uint8Array(await file.arrayBuffer())
    }

    setEncrypting(true)
    try {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const { encryptedObject, key } = await sealClient.encrypt({
        threshold,
        packageId: packageId.trim(),
        id: identityId.trim(),
        data,
      })

      const r: EncryptResult = {
        id: identityId,
        encryptedHex: toHex(encryptedObject),
        backupKeyHex: toHex(key),
        size: encryptedObject.length,
        timestamp: Date.now(),
      }
      setResult(r)
      setHistory((h) => [r, ...h].slice(0, 20))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEncrypting(false)
    }
  }

  return (
    <div className="sui-se">
      <div className="sui-se__header">
        <h3 className="sui-se__title">Seal Encrypt</h3>
        <p className="sui-se__desc">Threshold-encrypt data with Seal on Sui</p>
      </div>

      {!walletAddr && <div className="sui-se__warn">Connect wallet to encrypt data</div>}

      {/* Mode toggle */}
      <div className="sui-se__tabs">
        <button
          className={`sui-se__tab ${mode === 'text' ? 'sui-se__tab--active' : ''}`}
          onClick={() => setMode('text')}
        >
          Text
        </button>
        <button
          className={`sui-se__tab ${mode === 'file' ? 'sui-se__tab--active' : ''}`}
          onClick={() => setMode('file')}
        >
          File
        </button>
      </div>

      {/* Input */}
      {mode === 'text' ? (
        <textarea
          className="sui-se__textarea"
          placeholder="Enter text to encrypt…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
      ) : (
        <div className="sui-se__file-zone">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sui-se__file-input"
          />
          {file && (
            <span className="sui-se__file-name">
              {file.name} ({formatBytes(file.size)})
            </span>
          )}
        </div>
      )}

      {/* Config */}
      <div className="sui-se__field">
        <label className="sui-se__label">Package ID</label>
        <input
          className="sui-se__input"
          placeholder="0x…"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
        />
      </div>
      <div className="sui-se__field">
        <label className="sui-se__label">Identity ID</label>
        <input
          className="sui-se__input"
          placeholder="0x…"
          value={identityId}
          onChange={(e) => setIdentityId(e.target.value)}
        />
      </div>
      <div className="sui-se__field">
        <label className="sui-se__label">Threshold</label>
        <input
          className="sui-se__input sui-se__input--sm"
          type="number"
          min={1}
          max={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      </div>

      <button className="sui-se__btn" onClick={handleEncrypt} disabled={encrypting}>
        {encrypting ? 'Encrypting…' : 'Encrypt'}
      </button>

      {error && <div className="sui-se__error">{error}</div>}

      {result && (
        <div className="sui-se__result">
          <div className="sui-se__result-title">Encrypted Successfully</div>
          <div className="sui-se__meta-row">
            <span className="sui-se__meta-label">Size</span>
            <span className="sui-se__meta-val">{formatBytes(result.size)}</span>
          </div>
          <div className="sui-se__meta-row">
            <span className="sui-se__meta-label">Encrypted Data</span>
            <button className="sui-se__copy" onClick={() => copy(result.encryptedHex, 'enc')}>
              {copied === 'enc' ? 'Copied!' : shortenHex(result.encryptedHex, 10)}
            </button>
          </div>
          <div className="sui-se__meta-row">
            <span className="sui-se__meta-label">Backup Key</span>
            <button className="sui-se__copy" onClick={() => copy(result.backupKeyHex, 'key')}>
              {copied === 'key' ? 'Copied!' : shortenHex(result.backupKeyHex, 10)}
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="sui-se__history">
          <div className="sui-se__history-title">History</div>
          {history.map((h, i) => (
            <div key={i} className="sui-se__history-row">
              <span className="sui-se__history-id">{shortenHex(h.id)}</span>
              <span className="sui-se__history-size">{formatBytes(h.size)}</span>
              <button className="sui-se__copy" onClick={() => copy(h.encryptedHex, `h${i}`)}>
                {copied === `h${i}` ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sui-se__footer">
        <span className="sui-se__net">{network}</span>
        <a
          href="https://seal-docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-se__link"
        >
          Seal Docs
        </a>
      </div>
    </div>
  )
}

const SuiSealEncryptPlugin: Plugin = {
  name: 'SuiSealEncrypt',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-encrypt/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealEncrypt', SealEncryptContent)
    host.log('SuiSealEncrypt initialized')
  },
  mount() {
    console.log('[SuiSealEncrypt] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealEncrypt] unmounted')
  },
}

export default SuiSealEncryptPlugin
