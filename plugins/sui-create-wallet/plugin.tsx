// SUI Create Wallet Plugin
// Generate Secp256k1 keypairs using @noble/curves (WASM-grade crypto)
// Supports: random generation, mnemonic (BIP-39/BIP-32), and seed import
// Crypto stack: @noble/curves/secp256k1 + @noble/hashes/blake2b + @scure/bip39/bip32

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback } from 'react'
import './style.css'

// Crypto imports — same stack that @mysten/sui uses internally
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'

// --- Constants ---
const DEFAULT_SECP256K1_DERIVATION_PATH = "m/54'/784'/0'/0/0"
const SECP256K1_SCHEME_FLAG = 0x01 // Sui scheme flag for Secp256k1

// --- Types ---
interface WalletData {
  address: string
  publicKey: string
  privateKey: string
  mnemonic: string | null
  derivationPath: string | null
  scheme: string
}

// --- Crypto helpers (using @noble/curves — WASM-grade performance) ---

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Derive Sui address from Secp256k1 compressed public key: BLAKE2b-256(flag || pubkey) */
function deriveSuiAddress(compressedPubKey: Uint8Array): string {
  const payload = new Uint8Array(1 + compressedPubKey.length)
  payload[0] = SECP256K1_SCHEME_FLAG
  payload.set(compressedPubKey, 1)
  const hash = blake2b(payload, { dkLen: 32 })
  return `0x${bytesToHex(hash)}`
}

/** Generate a random Secp256k1 wallet (no mnemonic) */
function generateRandomWallet(): WalletData {
   
  const utils = secp256k1.utils as Record<string, unknown>
  const secretKey =
    typeof utils.randomPrivateKey === 'function'
      ? (utils.randomPrivateKey as () => Uint8Array)()
      : secp256k1.utils.randomSecretKey()
  const publicKey = secp256k1.getPublicKey(secretKey, true) // compressed
  const address = deriveSuiAddress(publicKey)

  return {
    address,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(secretKey),
    mnemonic: null,
    derivationPath: null,
    scheme: 'Secp256k1',
  }
}

/** Generate wallet from BIP-39 mnemonic via BIP-32 HD derivation */
function generateMnemonicWallet(
  mnemonic?: string,
  path: string = DEFAULT_SECP256K1_DERIVATION_PATH,
): WalletData {
  const mn = mnemonic || generateMnemonic(wordlist, 128) // 12 words
  if (!validateMnemonic(mn, wordlist)) {
    throw new Error('Invalid mnemonic phrase')
  }

  const seed = mnemonicToSeedSync(mn, '')
  const hdKey = HDKey.fromMasterSeed(seed).derive(path)

  if (!hdKey.privateKey || !hdKey.publicKey) {
    throw new Error('Failed to derive key from mnemonic')
  }

  const address = deriveSuiAddress(hdKey.publicKey)

  return {
    address,
    publicKey: bytesToHex(hdKey.publicKey),
    privateKey: bytesToHex(hdKey.privateKey),
    mnemonic: mn,
    derivationPath: path,
    scheme: 'Secp256k1',
  }
}

// --- Store shared host ref ---
let sharedHost: SuiHostAPI | null = null

// --- UI Component ---
function CreateWalletContent() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [mode, setMode] = useState<'random' | 'mnemonic' | 'import'>('mnemonic')
  const [importMnemonic, setImportMnemonic] = useState('')
  const [derivationPath, setDerivationPath] = useState(DEFAULT_SECP256K1_DERIVATION_PATH)
  const [error, setError] = useState<string | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const handleGenerate = useCallback(() => {
    setError(null)
    setShowPrivateKey(false)
    setCopied(null)
    try {
      if (mode === 'random') {
        setWallet(generateRandomWallet())
      } else if (mode === 'mnemonic') {
        setWallet(generateMnemonicWallet(undefined, derivationPath))
      } else if (mode === 'import') {
        if (!importMnemonic.trim()) {
          setError('Please enter a mnemonic phrase')
          return
        }
        setWallet(generateMnemonicWallet(importMnemonic.trim(), derivationPath))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [mode, importMnemonic, derivationPath])

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback for Shadow DOM / insecure context
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    }
  }, [])

  const handleClear = useCallback(() => {
    setWallet(null)
    setError(null)
    setShowPrivateKey(false)
    setCopied(null)
    setImportMnemonic('')
  }, [])

  return (
    <div className="sui-cw">
      <div className="sui-cw__header">
        <h3 className="sui-cw__title">Create Sui Wallet</h3>
        <p className="sui-cw__desc">
          Generate Secp256k1 keypairs using WASM-grade crypto (<code>@noble/curves</code>)
        </p>
      </div>

      {/* Mode selector */}
      <div className="sui-cw__modes">
        <button
          className={`sui-cw__mode ${mode === 'mnemonic' ? 'sui-cw__mode--active' : ''}`}
          onClick={() => {
            setMode('mnemonic')
            setError(null)
          }}
        >
          New Mnemonic
        </button>
        <button
          className={`sui-cw__mode ${mode === 'random' ? 'sui-cw__mode--active' : ''}`}
          onClick={() => {
            setMode('random')
            setError(null)
          }}
        >
          Random Key
        </button>
        <button
          className={`sui-cw__mode ${mode === 'import' ? 'sui-cw__mode--active' : ''}`}
          onClick={() => {
            setMode('import')
            setError(null)
          }}
        >
          Import Mnemonic
        </button>
      </div>

      {/* Import mnemonic input */}
      {mode === 'import' && (
        <div className="sui-cw__field">
          <label className="sui-cw__label">Mnemonic Phrase (12 words)</label>
          <textarea
            className="sui-cw__textarea"
            rows={3}
            placeholder="Enter your 12-word mnemonic phrase separated by spaces..."
            value={importMnemonic}
            onChange={(e) => setImportMnemonic(e.target.value)}
          />
        </div>
      )}

      {/* Derivation path (for mnemonic modes) */}
      {mode !== 'random' && (
        <div className="sui-cw__field">
          <label className="sui-cw__label">Derivation Path</label>
          <input
            className="sui-cw__input"
            type="text"
            value={derivationPath}
            onChange={(e) => setDerivationPath(e.target.value)}
          />
        </div>
      )}

      {/* Generate button */}
      <button className="sui-cw__btn" onClick={handleGenerate}>
        {mode === 'import' ? 'Derive Wallet' : 'Generate Wallet'}
      </button>

      {/* Error */}
      {error && <div className="sui-cw__error">{error}</div>}

      {/* Wallet result */}
      {wallet && (
        <div className="sui-cw__result">
          <div className="sui-cw__result-header">
            <span className="sui-cw__scheme-badge">Secp256k1</span>
            <button className="sui-cw__clear" onClick={handleClear}>
              Clear
            </button>
          </div>

          {/* Warning */}
          <div className="sui-cw__warning">
            <svg
              className="sui-cw__warning-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              width="14"
              height="14"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span>Save your mnemonic and private key securely. They will not be stored.</span>
          </div>

          {/* Mnemonic */}
          {wallet.mnemonic && (
            <div className="sui-cw__field-group">
              <div className="sui-cw__field-label">
                <span>Mnemonic</span>
                <button
                  className="sui-cw__copy"
                  onClick={() => handleCopy(wallet.mnemonic!, 'mnemonic')}
                >
                  {copied === 'mnemonic' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="sui-cw__mnemonic">
                {wallet.mnemonic.split(' ').map((word, i) => (
                  <span key={i} className="sui-cw__word">
                    <span className="sui-cw__word-num">{i + 1}</span>
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          <div className="sui-cw__field-group">
            <div className="sui-cw__field-label">
              <span>Address</span>
              <button
                className="sui-cw__copy"
                onClick={() => handleCopy(wallet.address, 'address')}
              >
                {copied === 'address' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="sui-cw__mono">{wallet.address}</div>
          </div>

          {/* Public Key */}
          <div className="sui-cw__field-group">
            <div className="sui-cw__field-label">
              <span>Public Key (compressed)</span>
              <button
                className="sui-cw__copy"
                onClick={() => handleCopy(wallet.publicKey, 'pubkey')}
              >
                {copied === 'pubkey' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="sui-cw__mono sui-cw__mono--sm">{wallet.publicKey}</div>
          </div>

          {/* Private Key */}
          <div className="sui-cw__field-group">
            <div className="sui-cw__field-label">
              <span>Private Key</span>
              <div className="sui-cw__field-actions">
                <button
                  className="sui-cw__toggle"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? 'Hide' : 'Show'}
                </button>
                {showPrivateKey && (
                  <button
                    className="sui-cw__copy"
                    onClick={() => handleCopy(wallet.privateKey, 'privkey')}
                  >
                    {copied === 'privkey' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
            <div className="sui-cw__mono sui-cw__mono--sm">
              {showPrivateKey ? wallet.privateKey : '•'.repeat(64)}
            </div>
          </div>

          {/* Derivation path */}
          {wallet.derivationPath && (
            <div className="sui-cw__field-group">
              <div className="sui-cw__field-label">
                <span>Derivation Path</span>
              </div>
              <div className="sui-cw__mono sui-cw__mono--sm">{wallet.derivationPath}</div>
            </div>
          )}
        </div>
      )}

      <div className="sui-cw__footer">
        Crypto: <code>@noble/curves</code> secp256k1 + <code>@noble/hashes</code> BLAKE2b +{' '}
        <code>@scure/bip39</code>
      </div>
    </div>
  )
}

const SuiCreateWalletPlugin: Plugin = {
  name: 'SuiCreateWallet',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-create-wallet/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiCreateWallet', CreateWalletContent)
    host.log(
      'SuiCreateWallet plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[SuiCreateWallet] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[SuiCreateWallet] unmounted')
  },
}

export default SuiCreateWalletPlugin
