// Solana Create Wallet Plugin
// Generate Ed25519 keypairs using @noble/curves (WASM-grade crypto)
// Stored in localStorage for devnet/testnet use only.
// Supports: random generation, mnemonic (BIP-39), import/export.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback } from 'react'
import { ed25519 } from '@noble/curves/ed25519.js'
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDKey } from '@scure/bip32'
import './style.css'

let sharedHost: SuiHostAPI | null = null

// --- Constants ---
const STORAGE_KEY = 'solana_dev_wallets'
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'"

// --- Types ---
interface StoredWallet {
  address: string
  publicKey: string
  secretKey: string // base64 encoded 64-byte keypair
  mnemonic: string | null
  createdAt: number
}

// --- Crypto Helpers ---

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBs58(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = BigInt('0x' + bytesToHex(bytes))
  let result = ''
  while (num > 0n) {
    const mod = Number(num % 58n)
    result = ALPHABET[mod] + result
    num = num / 58n
  }
  // Leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result = '1' + result
  return result
}

function bs58ToBytes(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = 0n
  for (const c of str) {
    const idx = ALPHABET.indexOf(c)
    if (idx === -1) throw new Error('Invalid base58 character')
    num = num * 58n + BigInt(idx)
  }
  const hex = num.toString(16).padStart(2, '0')
  const bytes = new Uint8Array(hex.length / 2 + (hex.length % 2 ? 1 : 0))
  const padded = hex.length % 2 ? '0' + hex : hex
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  // Leading 1s = leading zeros
  let leadingZeros = 0
  for (const c of str) {
    if (c === '1') leadingZeros++
    else break
  }
  const result = new Uint8Array(leadingZeros + bytes.length)
  result.set(bytes, leadingZeros)
  return result
}

/** Derive Ed25519 keypair from seed using Solana's derivation */
function deriveKeypairFromSeed(seed: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array } {
  // Solana uses the first 32 bytes of the derived HD key as the Ed25519 seed
  const hd = HDKey.fromMasterSeed(seed)
  const derived = hd.derive(SOLANA_DERIVATION_PATH)
  const edSeed = derived.privateKey!
  const publicKey = ed25519.getPublicKey(edSeed)
  // Solana keypair = 32-byte secret + 32-byte public = 64 bytes
  const secretKey = new Uint8Array(64)
  secretKey.set(edSeed, 0)
  secretKey.set(publicKey, 32)
  return { secretKey, publicKey }
}

/** Generate random Ed25519 keypair */
function generateRandomKeypair(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  const seed = crypto.getRandomValues(new Uint8Array(32))
  const publicKey = ed25519.getPublicKey(seed)
  const secretKey = new Uint8Array(64)
  secretKey.set(seed, 0)
  secretKey.set(publicKey, 32)
  return { secretKey, publicKey }
}

/** Get Solana address (base58 of public key) */
function pubkeyToAddress(publicKey: Uint8Array): string {
  return bytesToBs58(publicKey)
}

// --- Storage ---

function loadWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWallets(wallets: StoredWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
}

// --- Component ---

function SolanaCreateWalletContent() {
  const [wallets, setWallets] = useState<StoredWallet[]>(loadWallets)
  const [lastCreated, setLastCreated] = useState<StoredWallet | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMode, setImportMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const persist = (updated: StoredWallet[]) => {
    setWallets(updated)
    saveWallets(updated)
  }

  // Generate with mnemonic
  const handleGenerateMnemonic = useCallback(() => {
    setError(null)
    setSuccess(null)
    try {
      const mnemonic = generateMnemonic(wordlist, 128) // 12 words
      const seed = mnemonicToSeedSync(mnemonic)
      const { secretKey, publicKey } = deriveKeypairFromSeed(seed)
      const wallet: StoredWallet = {
        address: pubkeyToAddress(publicKey),
        publicKey: bytesToBs58(publicKey),
        secretKey: bytesToBase64(secretKey),
        mnemonic,
        createdAt: Date.now(),
      }
      const updated = [...wallets, wallet]
      persist(updated)
      setLastCreated(wallet)
      setShowMnemonic(true)
      setSuccess('Wallet created with mnemonic')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }, [wallets])

  // Generate random (no mnemonic)
  const handleGenerateRandom = useCallback(() => {
    setError(null)
    setSuccess(null)
    try {
      const { secretKey, publicKey } = generateRandomKeypair()
      const wallet: StoredWallet = {
        address: pubkeyToAddress(publicKey),
        publicKey: bytesToBs58(publicKey),
        secretKey: bytesToBase64(secretKey),
        mnemonic: null,
        createdAt: Date.now(),
      }
      const updated = [...wallets, wallet]
      persist(updated)
      setLastCreated(wallet)
      setShowMnemonic(false)
      setSuccess('Random wallet created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }, [wallets])

  // Import from mnemonic or base58 secret key
  const handleImport = useCallback(() => {
    setError(null)
    setSuccess(null)
    const input = importText.trim()
    if (!input) {
      setError('Enter a mnemonic or base58 secret key')
      return
    }

    try {
      let wallet: StoredWallet

      // Check if it's a mnemonic (multiple words)
      if (input.split(/\s+/).length >= 12) {
        if (!validateMnemonic(input, wordlist)) {
          setError('Invalid mnemonic phrase')
          return
        }
        const seed = mnemonicToSeedSync(input)
        const { secretKey, publicKey } = deriveKeypairFromSeed(seed)
        wallet = {
          address: pubkeyToAddress(publicKey),
          publicKey: bytesToBs58(publicKey),
          secretKey: bytesToBase64(secretKey),
          mnemonic: input,
          createdAt: Date.now(),
        }
      } else {
        // Assume base58 secret key (64 bytes)
        const keyBytes = bs58ToBytes(input)
        if (keyBytes.length !== 64) {
          setError('Secret key must be 64 bytes (base58 encoded)')
          return
        }
        const publicKey = keyBytes.slice(32)
        wallet = {
          address: pubkeyToAddress(publicKey),
          publicKey: bytesToBs58(publicKey),
          secretKey: bytesToBase64(keyBytes),
          mnemonic: null,
          createdAt: Date.now(),
        }
      }

      // Check duplicate
      if (wallets.some((w) => w.address === wallet.address)) {
        setError('Wallet already exists')
        return
      }

      const updated = [...wallets, wallet]
      persist(updated)
      setLastCreated(wallet)
      setImportText('')
      setImportMode(false)
      setSuccess('Wallet imported')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [importText, wallets])

  // Export (download JSON)
  const handleExport = (wallet: StoredWallet) => {
    const secretBytes = base64ToBytes(wallet.secretKey)
    const exportData = {
      address: wallet.address,
      publicKey: wallet.publicKey,
      secretKeyBase58: bytesToBs58(secretBytes),
      mnemonic: wallet.mnemonic,
      network: 'devnet/testnet only',
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `solana-wallet-${wallet.address.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Delete
  const handleDelete = (address: string) => {
    const updated = wallets.filter((w) => w.address !== address)
    persist(updated)
    if (lastCreated?.address === address) setLastCreated(null)
  }

  // Copy
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="sol-cw">
      <h3 className="sol-cw__title">Create Solana Wallet</h3>
      <p className="sol-cw__desc">
        Generate Ed25519 keypairs, stored in browser (devnet/testnet only)
      </p>

      <div className="sol-cw__warning">
        These wallets are for devnet/testnet development only. Do NOT use for mainnet funds. Keys
        are stored in localStorage and can be lost if you clear browser data.
      </div>

      {/* Actions */}
      <div className="sol-cw__actions">
        <button className="sol-cw__btn sol-cw__btn--primary" onClick={handleGenerateMnemonic}>
          Generate (Mnemonic)
        </button>
        <button className="sol-cw__btn" onClick={handleGenerateRandom}>
          Generate (Random)
        </button>
        <button className="sol-cw__btn" onClick={() => setImportMode(!importMode)}>
          {importMode ? 'Cancel' : 'Import'}
        </button>
      </div>

      {/* Import */}
      {importMode && (
        <div className="sol-cw__card">
          <div className="sol-cw__card-label">Import Wallet</div>
          <textarea
            className="sol-cw__import-area"
            placeholder="12-word mnemonic or base58 secret key (64 bytes)"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            className="sol-cw__btn sol-cw__btn--primary"
            onClick={handleImport}
            style={{ marginTop: 8 }}
          >
            Import
          </button>
        </div>
      )}

      {/* Last created */}
      {lastCreated && (
        <div className="sol-cw__card">
          <div className="sol-cw__card-header">
            <span className="sol-cw__card-label">Last Created</span>
            <span className="sol-cw__card-badge">Ed25519</span>
          </div>

          <div className="sol-cw__field">
            <div className="sol-cw__field-label">
              Address
              <button
                className="sol-cw__copy-btn"
                onClick={() => handleCopy(lastCreated.address, 'addr')}
              >
                {copied === 'addr' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="sol-cw__mono">{lastCreated.address}</div>
          </div>

          <div className="sol-cw__field">
            <div className="sol-cw__field-label">
              Public Key
              <button
                className="sol-cw__copy-btn"
                onClick={() => handleCopy(lastCreated.publicKey, 'pub')}
              >
                {copied === 'pub' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="sol-cw__mono">{lastCreated.publicKey}</div>
          </div>

          {lastCreated.mnemonic && showMnemonic && (
            <div className="sol-cw__field">
              <div className="sol-cw__field-label">
                Mnemonic (save this!)
                <button
                  className="sol-cw__copy-btn"
                  onClick={() => handleCopy(lastCreated.mnemonic!, 'mne')}
                >
                  {copied === 'mne' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="sol-cw__mnemonic">{lastCreated.mnemonic}</div>
            </div>
          )}
        </div>
      )}

      {/* Stored wallets */}
      {wallets.length > 0 && (
        <>
          <hr className="sol-cw__divider" />
          <h4 className="sol-cw__section-title">Stored Wallets ({wallets.length})</h4>
          <div className="sol-cw__stored-list">
            {wallets.map((w) => (
              <div key={w.address} className="sol-cw__stored-item">
                <span className="sol-cw__stored-addr">
                  {w.address.slice(0, 8)}...{w.address.slice(-6)}
                </span>
                <div className="sol-cw__stored-actions">
                  <button
                    className="sol-cw__small-btn"
                    onClick={() => handleCopy(w.address, w.address)}
                  >
                    {copied === w.address ? '...' : 'Copy'}
                  </button>
                  <button className="sol-cw__small-btn" onClick={() => handleExport(w)}>
                    Export
                  </button>
                  <button
                    className="sol-cw__small-btn sol-cw__small-btn--del"
                    onClick={() => handleDelete(w.address)}
                  >
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <div className="sol-cw__error">{error}</div>}
      {success && <div className="sol-cw__success">{success}</div>}
    </div>
  )
}

// --- Plugin Export ---
const SolanaCreateWalletPlugin: Plugin = {
  name: 'SolanaCreateWallet',
  version: '1.0.0',
  styleUrls: ['plugins/solana-create-wallet/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) sharedHost = host as SuiHostAPI
    host.registerComponent('SolanaCreateWallet', SolanaCreateWalletContent as never)
    host.log(
      `[SolanaCreateWallet] Plugin initialized (Ed25519 + BIP39 + localStorage) host=${!!sharedHost}`,
    )
  },

  mount() {},
  unmount() {
    sharedHost = null
  },
}

export default SolanaCreateWalletPlugin
