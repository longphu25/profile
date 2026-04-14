// SUI Walrus Upload Plugin
// Two upload modes:
// 1. Publisher (easy): upload via HTTP API, publisher owns blob object
// 2. Direct (own blob): user signs register+certify, owns blob object on-chain

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import {
  walrus,
  WalrusFile,
  TESTNET_WALRUS_PACKAGE_CONFIG,
  MAINNET_WALRUS_PACKAGE_CONFIG,
} from '@mysten/walrus'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'
import './style.css'

type NetworkKey = 'mainnet' | 'testnet'
type UploadMode = 'publisher' | 'direct'

const NET_CONFIG: Record<
  NetworkKey,
  {
    rpc: string
    aggregator: string
    publisher: string
    uploadRelay: string
    walType: string
    exchangePackage: string
  }
> = {
  mainnet: {
    rpc: 'https://fullnode.mainnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-mainnet.walrus.space',
    publisher: '',
    uploadRelay: 'https://upload-relay.mainnet.walrus.space',
    walType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
    exchangePackage: '',
  },
  testnet: {
    rpc: 'https://fullnode.testnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
    publisher: 'https://publisher.walrus-testnet.walrus.space',
    uploadRelay: 'https://upload-relay.testnet.walrus.space',
    walType: '0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL',
    exchangePackage: '0x82593828ed3fcb8c6a235eac9abd0adbe9c5f9bbffa9b1e7a45cdd884481ef9f',
  },
}

const WALLET_KEY = 'walletProfile'

type StepId =
  | 'idle'
  | 'check-wal'
  | 'acquire-wal'
  | 'encode'
  | 'register'
  | 'upload'
  | 'certify'
  | 'uploading'
  | 'done'

interface UploadResult {
  blobId: string
  url: string
  size: number
  fileName: string
  mode: UploadMode
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

const PRICE_PER_UNIT_EPOCH = 0.5
const BYTES_PER_UNIT = 1024 * 1024

function estimateCost(fileSize: number, ep: number) {
  const units = Math.max(1, Math.ceil(fileSize / BYTES_PER_UNIT))
  const storage = units * PRICE_PER_UNIT_EPOCH * ep
  return { units, storage, total: storage + 0.01 }
}

function WalrusUploadContent() {
  const [file, setFile] = useState<File | null>(null)
  const [epochs, setEpochs] = useState(5)
  const [deletable, setDeletable] = useState(false)
  const [mode, setMode] = useState<UploadMode>('publisher')
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
  const isConnected = !!walletAddr

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

  // --- Acquire WAL helper ---
  const acquireWal = useCallback(
    async (_client: SuiGrpcClient, addr: string, needed: number) => {
      if (network === 'testnet') {
        setDetail(`Exchange ${needed.toFixed(2)} SUI → WAL (1:1 testnet)`)
        const exchangeId = TESTNET_WALRUS_PACKAGE_CONFIG.exchangeIds?.[0]
        if (!exchangeId) throw new Error('No testnet exchange object')
        const neededMist = BigInt(Math.ceil(needed * 1e9))
        const tx = new Transaction()
        tx.setSender(addr)
        const [suiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(neededMist)])
        const [walCoin] = tx.moveCall({
          target: `${net.exchangePackage}::wal_exchange::exchange_for_wal`,
          arguments: [tx.object(exchangeId), suiCoin, tx.pure.u64(neededMist)],
        })
        tx.transferObjects([walCoin, suiCoin], addr)
        await sharedHost!.signAndExecuteTransaction(tx)
      } else {
        throw new Error(`Insufficient WAL. Use WAL Swap plugin to get WAL first.`)
      }
    },
    [network, net],
  )

  // --- Publisher upload ---
  const uploadViaPublisher = useCallback(
    async (bytes: Uint8Array) => {
      if (!net.publisher)
        throw new Error('No public publisher on mainnet. Use Direct mode or Walrus CLI.')
      setStep('uploading')
      setDetail(`Uploading to ${network} publisher...`)

      const url = `${net.publisher}/v1/blobs?epochs=${epochs}${deletable ? '&deletable=true' : ''}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes.buffer as ArrayBuffer,
      })
      if (!res.ok)
        throw new Error(
          `Publisher error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`,
        )

      const data = await res.json()
      return (data.newlyCreated?.blobObject?.blobId ??
        data.alreadyCertified?.blobId ??
        '') as string
    },
    [net, network, epochs, deletable],
  )

  // --- Direct upload (user owns blob) ---
  const uploadDirect = useCallback(
    async (bytes: Uint8Array, addr: string) => {
      if (!sharedHost) throw new Error('No host API')

      setStep('encode')
      setDetail('Initializing WASM encoder...')

      const client = new SuiGrpcClient({ network, baseUrl: net.rpc }).$extend(
        walrus({
          wasmUrl: walrusWasmUrl,
          packageConfig:
            network === 'mainnet' ? MAINNET_WALRUS_PACKAGE_CONFIG : TESTNET_WALRUS_PACKAGE_CONFIG,
          uploadRelay: { host: net.uploadRelay, sendTip: { max: 10000 } },
        }),
      )

      const flow = client.walrus.writeFilesFlow({
        files: [WalrusFile.from({ contents: bytes, identifier: file?.name ?? 'file' })],
      })

      setDetail('Encoding file (WASM RedStuff)...')
      await flow.encode()

      setStep('register')
      setDetail('Sign register transaction in wallet...')
      const registerTx = flow.register({ epochs, owner: addr, deletable })
      await sharedHost.signAndExecuteTransaction(registerTx)

      setStep('upload')
      setDetail('Uploading slivers to storage nodes...')
      await flow.upload()

      setStep('certify')
      setDetail('Sign certify transaction in wallet...')
      const certifyTx = flow.certify()
      await sharedHost.signAndExecuteTransaction(certifyTx)

      const files = await flow.listFiles()
      return files[0]?.blobId ?? ''
    },
    [network, net, epochs, deletable, file?.name],
  )

  // --- Main upload handler ---
  const handleUpload = useCallback(async () => {
    if (!file || !walletAddr || !sharedHost) return
    setError(null)
    setResult(null)

    try {
      const client = new SuiGrpcClient({ network, baseUrl: net.rpc })

      // Check WAL balance (for direct mode)
      if (mode === 'direct') {
        setStep('check-wal')
        setDetail('')
        const balRes = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
        const bal = Number(balRes.balance.balance) / 1e9
        setWalBalance(bal)

        const cost = estimateCost(file.size, epochs)
        if (bal < cost.total) {
          setStep('acquire-wal')
          await acquireWal(client, walletAddr, cost.total - bal + 0.1)
          const newBal = await client.core.getBalance({ owner: walletAddr, coinType: net.walType })
          setWalBalance(Number(newBal.balance.balance) / 1e9)
        }
      }

      setStep('encode')
      setDetail('Reading file...')
      const bytes = new Uint8Array(await file.arrayBuffer())

      const blobId =
        mode === 'publisher'
          ? await uploadViaPublisher(bytes)
          : await uploadDirect(bytes, walletAddr)

      if (!blobId) throw new Error('No blob ID returned')

      const uploadResult: UploadResult = {
        blobId,
        url: `${net.aggregator}/v1/blobs/${blobId}`,
        size: file.size,
        fileName: file.name,
        mode,
      }
      setResult(uploadResult)
      setHistory((prev) => {
        const next = [uploadResult, ...prev.slice(0, 9)]
        if (sharedHost) sharedHost.setSharedData('walrusUploads', next)
        return next
      })
      setStep('done')
      setDetail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('idle')
    }
  }, [
    file,
    epochs,
    deletable,
    walletAddr,
    network,
    net,
    mode,
    acquireWal,
    uploadViaPublisher,
    uploadDirect,
  ])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const activeSteps: StepId[] =
    mode === 'publisher'
      ? ['encode', 'uploading', 'done']
      : ['check-wal', 'acquire-wal', 'encode', 'register', 'upload', 'certify', 'done']

  return (
    <div className="sui-wup">
      <div className="sui-wup__header">
        <h3 className="sui-wup__title">Walrus Upload</h3>
        <p className="sui-wup__desc">Upload files to Walrus decentralized storage · {network}</p>
      </div>

      {error && <div className="sui-wup__error">{error}</div>}

      {!isConnected && (
        <div
          className="sui-wup__error"
          style={{ background: '#2a1a0a', borderColor: '#5c3a1a', color: '#fbbf24' }}
        >
          ⚠ Connect wallet via <strong>Wallet Profile</strong> plugin
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
        </div>
      )}

      {/* Upload mode selector */}
      {!uploading && !result && (
        <div className="sui-wup__modes">
          <button
            className={`sui-wup__mode ${mode === 'publisher' ? 'sui-wup__mode--active' : ''}`}
            onClick={() => setMode('publisher')}
          >
            <div className="sui-wup__mode-title">📡 Publisher</div>
            <div className="sui-wup__mode-desc">Fast · No signing · Publisher owns blob</div>
          </button>
          <button
            className={`sui-wup__mode ${mode === 'direct' ? 'sui-wup__mode--active' : ''}`}
            onClick={() => setMode('direct')}
          >
            <div className="sui-wup__mode-title">🔐 Direct</div>
            <div className="sui-wup__mode-desc">You own blob · Needs WAL · 2 signatures</div>
          </button>
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
          <div className="sui-wup__drop-hint">
            {mode === 'publisher'
              ? 'Publisher mode · No WAL needed'
              : 'Direct mode · WASM encoding · You own the blob'}
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
          {file.type.startsWith('image/') ? (
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="sui-wup__preview-thumb"
              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
            />
          ) : (
            <div className="sui-wup__file-icon">{fileIcon(file.type)}</div>
          )}
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

      {/* Cost estimate (direct mode) */}
      {file &&
        !uploading &&
        !result &&
        (() => {
          const c = estimateCost(file.size, epochs)
          return (
            <div className="sui-wup__cost">
              {mode === 'direct' ? (
                <>
                  <div className="sui-wup__cost-row">
                    <span className="sui-wup__cost-label">Est. Cost</span>
                    <span className="sui-wup__cost-val">~{c.total.toFixed(4)} WAL</span>
                  </div>
                  <div className="sui-wup__cost-row">
                    <span className="sui-wup__cost-label">Formula</span>
                    <span className="sui-wup__cost-val" style={{ fontSize: 10 }}>
                      ⌈{formatSize(file.size)}/1MiB⌉ × {PRICE_PER_UNIT_EPOCH} × {epochs}
                    </span>
                  </div>
                  <div className="sui-wup__cost-row">
                    <span className="sui-wup__cost-label">Blob Owner</span>
                    <span className="sui-wup__cost-val" style={{ color: '#34d399' }}>
                      You (wallet)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="sui-wup__cost-row">
                    <span className="sui-wup__cost-label">Cost</span>
                    <span className="sui-wup__cost-val" style={{ color: '#34d399' }}>
                      Free (publisher pays)
                    </span>
                  </div>
                  <div className="sui-wup__cost-row">
                    <span className="sui-wup__cost-label">Blob Owner</span>
                    <span className="sui-wup__cost-val" style={{ color: '#fbbf24' }}>
                      Publisher
                    </span>
                  </div>
                </>
              )}
            </div>
          )
        })()}

      {/* Step progress */}
      {uploading && (
        <div className="sui-wup__steps">
          {activeSteps.map((sid) => {
            const isCurrent = step === sid
            const isDone = activeSteps.indexOf(sid) < activeSteps.indexOf(step)
            const labels: Record<string, string> = {
              'check-wal': 'Check WAL',
              'acquire-wal': 'Get WAL',
              encode: 'Encode',
              register: 'Register (sign)',
              upload: 'Upload slivers',
              certify: 'Certify (sign)',
              uploading: 'Uploading...',
              done: 'Done',
            }
            return (
              <div
                key={sid}
                className={`sui-wup__step ${isCurrent ? 'sui-wup__step--active' : ''} ${isDone ? 'sui-wup__step--done' : ''}`}
              >
                <span className="sui-wup__step-icon">{isDone ? '✓' : isCurrent ? '⏳' : '○'}</span>
                <span className="sui-wup__step-label">{labels[sid] ?? sid}</span>
              </div>
            )
          })}
          {detail && <div className="sui-wup__step-detail">{detail}</div>}
          <div className="sui-wup__progress">
            <div className="sui-wup__progress-bar">
              <div
                className="sui-wup__progress-fill"
                style={{
                  width: `${Math.round(((activeSteps.indexOf(step) + 1) / activeSteps.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && !uploading && !result && (
        <button
          className="sui-wup__action"
          disabled={!isConnected && mode === 'direct'}
          onClick={handleUpload}
        >
          {mode === 'publisher'
            ? `Upload via Publisher (${epochs} epochs)`
            : `Upload Direct (${epochs} epochs)`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="sui-wup__result">
          <div className="sui-wup__result-title">✓ Upload Successful ({result.mode})</div>
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
          Walrus
        </a>
        {mode === 'direct' ? ' · WASM encoding · You own the blob' : ' · Publisher mode'}
      </div>
    </div>
  )
}

const SuiWalrusUploadPlugin: Plugin = {
  name: 'SuiWalrusUpload',
  version: '3.0.0',
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
