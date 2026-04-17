// SUI Seal Decrypt Plugin
// Decrypt Seal-encrypted data using SessionKey + wallet signing

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal'
import { fromHex } from '@mysten/bcs'
import {
  WALLET_KEY,
  TESTNET_KEY_SERVERS,
  RPC_URLS,
  formatBytes,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

function SealDecryptContent() {
  const [encryptedHex, setEncryptedHex] = useState('')
  const [packageId, setPackageId] = useState('')
  const [moduleName, setModuleName] = useState('')
  const [ttl, setTtl] = useState(10)
  const [decrypting, setDecrypting] = useState(false)
  const [decryptedText, setDecryptedText] = useState<string | null>(null)
  const [decryptedBytes, setDecryptedBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'session' | 'signing' | 'decrypting' | 'done'>('idle')
  const [network, setNetwork] = useState<NetworkKey>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [copied, setCopied] = useState(false)
  const sessionKeyRef = useRef<SessionKey | null>(null)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey)
    })
  }, [])

  const handleDecrypt = async () => {
    setError(null)
    setDecryptedText(null)
    setDecryptedBytes(null)

    if (!walletAddr) {
      setError('Connect wallet first')
      return
    }
    if (!encryptedHex.trim()) {
      setError('Paste encrypted data (hex)')
      return
    }
    if (!packageId.trim()) {
      setError('Package ID required')
      return
    }
    if (!moduleName.trim()) {
      setError('Module name required')
      return
    }

    setDecrypting(true)
    try {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const encBytes = fromHex(encryptedHex.replace(/^0x/, ''))
      const parsed = EncryptedObject.parse(encBytes)

      // Step 1: Create session key
      setStep('session')
      const sessionKey = await SessionKey.create({
        address: walletAddr,
        packageId: packageId.trim(),
        ttlMin: ttl,
        suiClient,
      })
      sessionKeyRef.current = sessionKey

      // Step 2: Sign personal message
      setStep('signing')
      if (!sharedHost) throw new Error('Host not available')
      const message = sessionKey.getPersonalMessage()
      const { signature } = await sharedHost.signPersonalMessage(message)
      await sessionKey.setPersonalMessageSignature(signature)

      // Step 3: Build approval transaction
      setStep('decrypting')
      const tx = new Transaction()
      tx.moveCall({
        target: `${packageId}::${moduleName}::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id))],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      // Step 4: Decrypt
      const plaintext = await sealClient.decrypt({
        data: encBytes,
        sessionKey,
        txBytes,
      })

      setDecryptedBytes(plaintext)
      // Try to decode as text
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
        setDecryptedText(decoded)
      } catch {
        setDecryptedText(null)
      }
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('idle')
    } finally {
      setDecrypting(false)
    }
  }

  const downloadDecrypted = () => {
    if (!decryptedBytes) return
    const blob = new Blob([decryptedBytes.slice().buffer])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'decrypted-data.bin'
    a.click()
    URL.revokeObjectURL(url)
  }

  const stepLabels: Record<string, string> = {
    idle: 'Ready',
    session: 'Creating session key…',
    signing: 'Waiting for wallet signature…',
    decrypting: 'Decrypting with key servers…',
    done: 'Decrypted!',
  }

  return (
    <div className="sui-sd">
      <div className="sui-sd__header">
        <h3 className="sui-sd__title">Seal Decrypt</h3>
        <p className="sui-sd__desc">Decrypt Seal-encrypted data with wallet approval</p>
      </div>

      {!walletAddr && <div className="sui-sd__warn">Connect wallet to decrypt data</div>}

      <div className="sui-sd__field">
        <label className="sui-sd__label">Encrypted Data (hex)</label>
        <textarea
          className="sui-sd__textarea"
          placeholder="Paste encrypted hex data…"
          value={encryptedHex}
          onChange={(e) => setEncryptedHex(e.target.value)}
          rows={4}
        />
      </div>

      <div className="sui-sd__field">
        <label className="sui-sd__label">Package ID</label>
        <input
          className="sui-sd__input"
          placeholder="0x…"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
        />
      </div>
      <div className="sui-sd__field">
        <label className="sui-sd__label">Module Name</label>
        <input
          className="sui-sd__input"
          placeholder="e.g. whitelist"
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
        />
      </div>
      <div className="sui-sd__field">
        <label className="sui-sd__label">Session TTL (min)</label>
        <input
          className="sui-sd__input sui-sd__input--sm"
          type="number"
          min={1}
          max={60}
          value={ttl}
          onChange={(e) => setTtl(Number(e.target.value))}
        />
      </div>

      <div className="sui-sd__step">{stepLabels[step]}</div>

      <button className="sui-sd__btn" onClick={handleDecrypt} disabled={decrypting || !walletAddr}>
        {decrypting ? 'Decrypting…' : 'Decrypt'}
      </button>

      {error && <div className="sui-sd__error">{error}</div>}

      {step === 'done' && (
        <div className="sui-sd__result">
          <div className="sui-sd__result-title">Decrypted Data</div>
          {decryptedText !== null ? (
            <div className="sui-sd__preview-text">{decryptedText}</div>
          ) : (
            <div className="sui-sd__preview-binary">
              Binary data — {decryptedBytes ? formatBytes(decryptedBytes.length) : ''}
            </div>
          )}
          <div className="sui-sd__actions">
            {decryptedText !== null && (
              <button
                className="sui-sd__copy"
                onClick={() => {
                  navigator.clipboard.writeText(decryptedText)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            )}
            <button className="sui-sd__btn-sm" onClick={downloadDecrypted}>
              Download
            </button>
          </div>
        </div>
      )}

      <div className="sui-sd__footer">
        <span className="sui-sd__net">{network}</span>
        <a
          href="https://seal-docs.wal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-sd__link"
        >
          Seal Docs
        </a>
      </div>
    </div>
  )
}

const SuiSealDecryptPlugin: Plugin = {
  name: 'SuiSealDecrypt',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-decrypt/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealDecrypt', SealDecryptContent)
    host.log('SuiSealDecrypt initialized')
  },
  mount() {
    console.log('[SuiSealDecrypt] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealDecrypt] unmounted')
  },
}

export default SuiSealDecryptPlugin
