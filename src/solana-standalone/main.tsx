// Solana Standalone — all plugins bundled directly (no dynamic loading)
// This builds into a single HTML file that works offline/static.
/* eslint-disable react-refresh/only-export-components */

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './solana-standalone.css'

// Import plugins directly (bundled, not dynamic-loaded)
import SolanaWalletProfilePlugin from '../../plugins/solana-wallet-profile/plugin'
import SolanaFaucetPlugin from '../../plugins/solana-faucet/plugin'
import SolanaCreateWalletPlugin from '../../plugins/solana-create-wallet/plugin'

import type { ComponentType } from 'react'

// --- Inline host (no SuiHostAPI needed for standalone) ---
const componentRegistry: Record<string, ComponentType<unknown>> = {}
const sharedData: Record<string, unknown> = {}
const dataListeners: Record<string, Set<(value: unknown) => void>> = {}

const standaloneHost = {
  registerComponent(name: string, component: ComponentType<unknown>) {
    componentRegistry[name] = component
  },
  getComponent(name: string) {
    return componentRegistry[name]
  },
  log(msg: string) {
    console.log(msg)
  },
  // SuiHostAPI compat (so isSuiHostAPI returns true)
  getSuiContext: () => ({ address: null, network: 'devnet', isConnected: false, accounts: [] }),
  onSuiContextChange: () => () => {},
  requestConnect() {},
  requestDisconnect() {},
  requestNetworkSwitch() {},
  async signAndExecuteTransaction() {
    throw new Error('Not supported')
  },
  async signPersonalMessage() {
    throw new Error('Not supported')
  },
  registerSigner() {},
  setSharedData(key: string, value: unknown) {
    sharedData[key] = value
    dataListeners[key]?.forEach((l) => l(value))
  },
  getSharedData(key: string) {
    return sharedData[key]
  },
  onSharedDataChange(key: string, listener: (value: unknown) => void) {
    if (!dataListeners[key]) dataListeners[key] = new Set()
    dataListeners[key].add(listener)
    return () => {
      dataListeners[key]?.delete(listener)
    }
  },
}

// Init all plugins
SolanaCreateWalletPlugin.init(standaloneHost as never)
SolanaWalletProfilePlugin.init(standaloneHost as never)
SolanaFaucetPlugin.init(standaloneHost as never)

// Mount
SolanaCreateWalletPlugin.mount?.()
SolanaWalletProfilePlugin.mount?.()
SolanaFaucetPlugin.mount?.()

// --- App ---
const TABS = [
  { id: 'wallet-profile', label: 'Wallet Profile', component: 'SolanaWalletProfile' },
  { id: 'create-wallet', label: 'Create Wallet', component: 'SolanaCreateWallet' },
  { id: 'faucet', label: 'Faucet', component: 'SolanaFaucet' },
]

function App() {
  const [activeTab, setActiveTab] = useState('wallet-profile')
  const tab = TABS.find((t) => t.id === activeTab)!
  const Component = componentRegistry[tab.component]

  return (
    <div className="sol-app">
      <header className="sol-app__header">
        <div className="sol-app__header-inner">
          <h1 className="sol-app__title">Solana Dev Tools</h1>
          <span className="sol-app__subtitle">Standalone (offline-capable)</span>
        </div>
      </header>

      <nav className="sol-app__tabs">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`sol-app__tab ${t.id === activeTab ? 'sol-app__tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="sol-app__main">
        {Component ? <Component /> : <div>Plugin not loaded</div>}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
