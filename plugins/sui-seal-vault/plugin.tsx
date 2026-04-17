// SUI Seal Vault Plugin
// Personal encrypted secrets vault — encrypt/store/decrypt key-value secrets
// Uses browser localStorage for encrypted blob storage + Seal for encryption

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/bcs'
import {
  WALLET_KEY,
  TESTNET_KEY_SERVERS,
  DEFAULT_THRESHOLD,
  RPC_URLS,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

const VAULT_STORAGE_PREFIX = 'seal-vault:'

interface VaultEntry {
  label: string
  encryptedHex: string
  createdAt: number
}

function loadVault(addr: string): VaultEntry[] {
  try {
    const raw = localStorage.getItem(`${VAULT_STORAGE_PREFIX}${addr}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveVault(addr: string, entries: VaultEntry[]) {
  localStorage.setItem(`${VAULT_STORAGE_PREFIX}${addr}`, JSON.stringify(entries))
}

function SealVaultContent() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [packageId, setPackageId] = useState('')
  const [moduleName, setModuleName] = useState('')
  const [saving, setSaving] = useState(false)
  const [decryptingIdx, setDecryptingIdx] = useState<number | null>(null)
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null)
  const [revealedText, setRevealedText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [network, setNetwork] = useState<NetworkKey>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey)
    })
  }, [])

  // Load vault when wallet changes
  useEffect(() => {
    if (walletAddr) setEntries(loadVault(walletAddr))
    else setEntries([])
    setRevealedIdx(null)
    setRevealedText(null)
  }, [walletAddr])

  const handleAdd = async () => {
    setError(null)
    if (!walletAddr) {
      setError('Connect wallet first')
      return
    }
    if (!label.trim() || !secret.trim()) {
      setError('Label and secret required')
      return
    }
    if (!packageId.trim()) {
      setError('Package ID required')
      return
    }

    setSaving(true)
    try {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const data = new TextEncoder().encode(secret)
      // Use wallet address + label as identity
      const identityHex = toHex(new TextEncoder().encode(`${walletAddr}:${label}`))

      const { encryptedObject } = await sealClient.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: packageId.trim(),
        id: identityHex,
        data,
      })

      const entry: VaultEntry = {
        label: label.trim(),
        encryptedHex: toHex(encryptedObject),
        createdAt: Date.now(),
      }
      const updated = [entry, ...entries]
      setEntries(updated)
      saveVault(walletAddr, updated)
      setLabel('')
      setSecret('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleReveal = async (idx: number) => {
    setError(null)
    if (!walletAddr || !sharedHost) return
    if (!packageId.trim() || !moduleName.trim()) {
      setError('Package ID and module name required')
      return
    }

    setDecryptingIdx(idx)
    setRevealedIdx(null)
    setRevealedText(null)
    try {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sealClient = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })

      const entry = entries[idx]
      const encBytes = fromHex(entry.encryptedHex)
      const parsed = EncryptedObject.parse(encBytes)

      const sessionKey = await SessionKey.create({
        address: walletAddr,
        packageId: packageId.trim(),
        ttlMin: 5,
        suiClient,
      })

      const message = sessionKey.getPersonalMessage()
      const { signature } = await sharedHost.signPersonalMessage(message)
      await sessionKey.setPersonalMessageSignature(signature)

      const tx = new Transaction()
      tx.moveCall({
        target: `${packageId}::${moduleName}::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id))],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      const plaintext = await sealClient.decrypt({ data: encBytes, sessionKey, txBytes })
      const decoded = new TextDecoder().decode(plaintext)
      setRevealedIdx(idx)
      setRevealedText(decoded)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDecryptingIdx(null)
    }
  }

  const handleDelete = (idx: number) => {
    if (!walletAddr) return
    const updated = entries.filter((_, i) => i !== idx)
    setEntries(updated)
    saveVault(walletAddr, updated)
    if (revealedIdx === idx) {
      setRevealedIdx(null)
      setRevealedText(null)
    }
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="sui-sv">
      <div className="sui-sv__header">
        <h3 className="sui-sv__title">Seal Vault</h3>
        <p className="sui-sv__desc">Encrypted secrets vault powered by Seal</p>
      </div>

      {!walletAddr && <div className="sui-sv__warn">Connect wallet to use vault</div>}

      {/* Config */}
      <div className="sui-sv__config">
        <div className="sui-sv__field">
          <label className="sui-sv__label">Package ID</label>
          <input
            className="sui-sv__input"
            placeholder="0x…"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
          />
        </div>
        <div className="sui-sv__field">
          <label className="sui-sv__label">Module Name</label>
          <input
            className="sui-sv__input"
            placeholder="e.g. private_data"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
          />
        </div>
      </div>

      {/* Add secret */}
      <div className="sui-sv__add">
        <input
          className="sui-sv__input"
          placeholder="Label (e.g. API Key)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="sui-sv__input"
          type="password"
          placeholder="Secret value"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button className="sui-sv__btn" onClick={handleAdd} disabled={saving || !walletAddr}>
          {saving ? 'Encrypting…' : 'Add Secret'}
        </button>
      </div>

      {error && <div className="sui-sv__error">{error}</div>}

      {/* Entries */}
      <div className="sui-sv__list">
        {entries.length === 0 && walletAddr && (
          <div className="sui-sv__empty">No secrets stored yet</div>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="sui-sv__entry">
            <div className="sui-sv__entry-header">
              <span className="sui-sv__entry-label">{entry.label}</span>
              <span className="sui-sv__entry-date">{formatDate(entry.createdAt)}</span>
            </div>
            {revealedIdx === i && revealedText !== null ? (
              <div className="sui-sv__revealed">
                <code className="sui-sv__revealed-text">{revealedText}</code>
                <button
                  className="sui-sv__copy"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedText)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="sui-sv__btn-sm sui-sv__btn-hide"
                  onClick={() => {
                    setRevealedIdx(null)
                    setRevealedText(null)
                  }}
                >
                  Hide
                </button>
              </div>
            ) : (
              <div className="sui-sv__entry-actions">
                <button
                  className="sui-sv__btn-sm"
                  onClick={() => handleReveal(i)}
                  disabled={decryptingIdx !== null || !walletAddr}
                >
                  {decryptingIdx === i ? 'Decrypting…' : 'Reveal'}
                </button>
                <button className="sui-sv__btn-sm sui-sv__btn-del" onClick={() => handleDelete(i)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sui-sv__footer">
        <span className="sui-sv__net">{network}</span>
        <span className="sui-sv__count">
          {entries.length} secret{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

const SuiSealVaultPlugin: Plugin = {
  name: 'SuiSealVault',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-vault/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealVault', SealVaultContent)
    host.log('SuiSealVault initialized')
  },
  mount() {
    console.log('[SuiSealVault] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealVault] unmounted')
  },
}

export default SuiSealVaultPlugin
