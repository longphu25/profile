// Polymarket Wallet Plugin
// 3 modes: Connect browser wallet (MetaMask/Rabby) | Create new | Import private key
// Broadcasts wallet data via shared data for other plugins

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Wallet, HDNodeWallet } from 'ethers'
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import './style.css'

let sharedHost: SuiHostAPI | null = null

const POLYGON_CHAIN_ID = '0x89' // 137
const POLYGON_CONFIG = {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon Mainnet',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
}

type WalletMode = 'browser' | 'generated' | 'imported'
type Tab = 'browser' | 'create' | 'import'

interface WalletData {
  address: string
  privateKey?: string
  mnemonic?: string
  mode: WalletMode
  chainId?: string
  providerName?: string
}

function shortenAddr(a: string): string {
  return a.slice(0, 6) + '...' + a.slice(-4)
}

function detectProviderName(): string {
  const w = window as any
  if (w.ethereum?.isRabby) return 'Rabby'
  if (w.ethereum?.isCoinbaseWallet) return 'Coinbase'
  if (w.ethereum?.isBraveWallet) return 'Brave'
  if (w.ethereum?.isMetaMask) return 'MetaMask'
  if (w.ethereum) return 'Browser Wallet'
  return 'Unknown'
}

function PolymarketWalletComponent() {
  const [tab, setTab] = useState<Tab>('browser')
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [importKey, setImportKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPK, setShowPK] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [hasProvider, setHasProvider] = useState(false)
  const listenerRef = useRef(false)

  // Detect browser wallet
  useEffect(() => {
    setHasProvider(typeof (window as any).ethereum !== 'undefined')
  }, [])

  // Listen for account/chain changes from browser wallet
  useEffect(() => {
    if (!wallet || wallet.mode !== 'browser' || listenerRef.current) return
    const eth = (window as any).ethereum
    if (!eth) return
    listenerRef.current = true

    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        handleDisconnect()
      } else {
        const updated: WalletData = { ...wallet, address: accounts[0] }
        setWallet(updated)
        broadcast(updated)
      }
    }

    const onChainChanged = (chainId: string) => {
      setWallet((prev) => (prev ? { ...prev, chainId } : prev))
    }

    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)

    return () => {
      eth.removeListener('accountsChanged', onAccountsChanged)
      eth.removeListener('chainChanged', onChainChanged)
      listenerRef.current = false
    }
  }, [wallet])

  const broadcast = (data: WalletData) => {
    if (sharedHost) {
      sharedHost.setSharedData('polymarket:wallet', {
        address: data.address,
        privateKey: data.privateKey || null,
        mode: data.mode,
        providerName: data.providerName,
      })
    }
  }

  // --- Browser wallet connect ---
  const handleBrowserConnect = useCallback(async () => {
    const eth = (window as any).ethereum
    if (!eth) {
      setError('No browser wallet detected. Install MetaMask or Rabby.')
      return
    }
    setError(null)
    setConnecting(true)
    try {
      // Request accounts
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
      if (!accounts.length) throw new Error('No accounts returned')

      // Get current chain
      const chainId: string = await eth.request({ method: 'eth_chainId' })

      // Switch to Polygon if not already
      if (chainId !== POLYGON_CHAIN_ID) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: POLYGON_CHAIN_ID }],
          })
        } catch (switchErr: any) {
          // 4902 = chain not added
          if (switchErr.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [POLYGON_CONFIG],
            })
          } else {
            throw switchErr
          }
        }
      }

      const data: WalletData = {
        address: accounts[0],
        mode: 'browser',
        chainId: POLYGON_CHAIN_ID,
        providerName: detectProviderName(),
      }
      setWallet(data)
      broadcast(data)
    } catch (e: any) {
      if (e.code === 4001) {
        setError('Connection rejected by user')
      } else {
        setError(e.message || String(e))
      }
    } finally {
      setConnecting(false)
    }
  }, [])

  // --- Create new wallet ---
  const handleCreate = useCallback(() => {
    setError(null)
    try {
      const mnemonic = generateMnemonic(wordlist, 128)
      const seed = mnemonicToSeedSync(mnemonic)
      const hd = HDNodeWallet.fromSeed(seed).derivePath("m/44'/60'/0'/0/0")
      const data: WalletData = {
        address: hd.address,
        privateKey: hd.privateKey,
        mnemonic,
        mode: 'generated',
      }
      setWallet(data)
      broadcast(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // --- Import private key ---
  const handleImport = useCallback(() => {
    setError(null)
    const key = importKey.trim()
    if (!key) {
      setError('Enter a private key')
      return
    }
    try {
      const prefixed = key.startsWith('0x') ? key : '0x' + key
      const w = new Wallet(prefixed)
      const data: WalletData = {
        address: w.address,
        privateKey: w.privateKey,
        mode: 'imported',
      }
      setWallet(data)
      setImportKey('')
      broadcast(data)
    } catch (e) {
      setError('Invalid private key')
    }
  }, [importKey])

  const handleDisconnect = () => {
    setWallet(null)
    setShowPK(false)
    setShowMnemonic(false)
    listenerRef.current = false
    if (sharedHost) sharedHost.setSharedData('polymarket:wallet', null)
  }

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const modeLabel: Record<WalletMode, string> = {
    browser: 'Browser Wallet',
    generated: 'HD Wallet (BIP-39)',
    imported: 'Imported Key',
  }

  // ========== CONNECTED STATE ==========
  if (wallet) {
    const isBrowser = wallet.mode === 'browser'
    const hasPK = !!wallet.privateKey

    return (
      <div className="pmw-root">
        <div className="pmw-connected">
          <div
            className={'pmw-connected__icon' + (isBrowser ? ' pmw-connected__icon--browser' : '')}
          >
            {isBrowser ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8247e5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M22 10H2M7 15h.01" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3fb950"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div className="pmw-connected__info">
            <div className="pmw-connected__label">
              {isBrowser ? wallet.providerName || 'Browser Wallet' : 'Polygon Wallet'} Connected
            </div>
            <div className="pmw-connected__addr" title={wallet.address}>
              {shortenAddr(wallet.address)}
              <button
                type="button"
                className="pmw-copy"
                onClick={() => copy(wallet.address, 'addr')}
                title="Copy"
              >
                {copied === 'addr' ? '✓' : '⧉'}
              </button>
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="pmw-info-row">
          <span className="pmw-info-row__label">Network</span>
          <span className="pmw-info-row__val">Polygon (137)</span>
        </div>
        <div className="pmw-info-row">
          <span className="pmw-info-row__label">Type</span>
          <span className="pmw-info-row__val">{modeLabel[wallet.mode]}</span>
        </div>
        {isBrowser && wallet.providerName && (
          <div className="pmw-info-row">
            <span className="pmw-info-row__label">Provider</span>
            <span className="pmw-info-row__val">{wallet.providerName}</span>
          </div>
        )}
        <div className="pmw-info-row">
          <span className="pmw-info-row__label">CLOB</span>
          <span className="pmw-info-row__val">clob.polymarket.com</span>
        </div>

        {/* Private key (only for generated/imported) */}
        {hasPK && (
          <div className="pmw-secret-section">
            <button type="button" className="pmw-reveal-btn" onClick={() => setShowPK(!showPK)}>
              {showPK ? 'Hide' : 'Show'} Private Key
            </button>
            {showPK && (
              <div className="pmw-secret-box">
                <code className="pmw-secret-box__code">{wallet.privateKey}</code>
                <button
                  type="button"
                  className="pmw-copy"
                  onClick={() => copy(wallet.privateKey!, 'pk')}
                >
                  {copied === 'pk' ? '✓' : '⧉'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mnemonic (only for generated) */}
        {wallet.mnemonic && (
          <div className="pmw-secret-section">
            <button
              type="button"
              className="pmw-reveal-btn"
              onClick={() => setShowMnemonic(!showMnemonic)}
            >
              {showMnemonic ? 'Hide' : 'Show'} Recovery Phrase
            </button>
            {showMnemonic && (
              <div className="pmw-mnemonic">
                {wallet.mnemonic.split(' ').map((word, i) => (
                  <span key={i} className="pmw-mnemonic__word">
                    <span className="pmw-mnemonic__idx">{i + 1}</span>
                    {word}
                  </span>
                ))}
                <button
                  type="button"
                  className="pmw-copy pmw-copy--block"
                  onClick={() => copy(wallet.mnemonic!, 'mn')}
                >
                  {copied === 'mn' ? 'Copied!' : 'Copy phrase'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Browser wallet note */}
        {isBrowser && (
          <div className="pmw-info-note">
            Connected via {wallet.providerName}. To trade on Polymarket CLOB API, you'll need to
            export your private key from the wallet extension and use "Import Key" mode.
          </div>
        )}

        {/* Warning for key holders */}
        {hasPK && (
          <div className="pmw-warning">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Never share your private key or recovery phrase.
          </div>
        )}

        <button type="button" className="pmw-disconnect" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    )
  }

  // ========== NOT CONNECTED — TABS ==========
  return (
    <div className="pmw-root">
      <div className="pmw-header">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8247e5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
        <span>Polygon Wallet</span>
      </div>

      <div className="pmw-tabs">
        <button
          type="button"
          className={'pmw-tab' + (tab === 'browser' ? ' pmw-tab--active' : '')}
          onClick={() => {
            setTab('browser')
            setError(null)
          }}
        >
          Browser
        </button>
        <button
          type="button"
          className={'pmw-tab' + (tab === 'create' ? ' pmw-tab--active' : '')}
          onClick={() => {
            setTab('create')
            setError(null)
          }}
        >
          Create
        </button>
        <button
          type="button"
          className={'pmw-tab' + (tab === 'import' ? ' pmw-tab--active' : '')}
          onClick={() => {
            setTab('import')
            setError(null)
          }}
        >
          Import
        </button>
      </div>

      {error && <div className="pmw-error">{error}</div>}

      {tab === 'browser' && (
        <div className="pmw-panel">
          <p className="pmw-panel__desc">
            Connect your MetaMask, Rabby, or other browser wallet. The plugin will auto-switch to
            Polygon network.
          </p>
          {hasProvider ? (
            <button
              type="button"
              className="pmw-btn pmw-btn--browser"
              onClick={handleBrowserConnect}
              disabled={connecting}
            >
              {connecting ? (
                <span className="pmw-btn__loading">Connecting...</span>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="6" width="20" height="14" rx="2" />
                    <path d="M22 10H2M7 15h.01" />
                  </svg>
                  Connect {detectProviderName()}
                </>
              )}
            </button>
          ) : (
            <div className="pmw-no-provider">
              <p>No browser wallet detected.</p>
              <div className="pmw-provider-links">
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                  Install MetaMask
                </a>
                <a href="https://rabby.io/" target="_blank" rel="noopener noreferrer">
                  Install Rabby
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="pmw-panel">
          <p className="pmw-panel__desc">
            Generate a new Polygon wallet with a 12-word recovery phrase for Polymarket CLOB
            trading.
          </p>
          <button type="button" className="pmw-btn pmw-btn--primary" onClick={handleCreate}>
            Generate Wallet
          </button>
        </div>
      )}

      {tab === 'import' && (
        <div className="pmw-panel">
          <p className="pmw-panel__desc">
            Import an existing wallet using its private key (from MetaMask export or Polymarket
            account).
          </p>
          <label className="pmw-label">Private Key</label>
          <input
            className="pmw-input"
            type="password"
            placeholder="0x..."
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="pmw-btn pmw-btn--primary" onClick={handleImport}>
            Import Wallet
          </button>
        </div>
      )}

      <div className="pmw-footer">Keys are stored in memory only — never sent to any server.</div>
    </div>
  )
}

const PolymarketWalletPlugin: Plugin = {
  name: 'PolymarketWallet',
  version: '2.0.0',
  styleUrls: ['/plugins/polymarket-wallet/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('PolymarketWallet', PolymarketWalletComponent)
    host.log('PolymarketWallet v2 initialized')
  },

  mount() {
    console.log('[PolymarketWallet] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[PolymarketWallet] unmounted')
  },
}

export default PolymarketWalletPlugin
