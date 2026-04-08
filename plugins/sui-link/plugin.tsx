// SuiLink Plugin
// View cross-chain wallet links (soulbound NFTs) for a connected Sui wallet
// Dual-mode: works standalone (plugin-demo) or with shared context (sui-dashboard)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentClient,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { useState, useEffect } from 'react'
import './style.css'

// --- Constants ---
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const NETWORKS = ['mainnet', 'testnet'] as const

const SUILINK_PACKAGES: Record<string, { ethSol: string; sui: string }> = {
  mainnet: {
    ethSol: '0xf857fa9df5811e6df2a0240a1029d365db24b5026896776ddd1c3c70803bccd3',
    sui: '0x73f5ab2461c5993408fff21354fa9831d4f4a66cc81382419ec29e3c80c384b5',
  },
  testnet: {
    ethSol: '0x0025bafa2e6afa511c19bd4e95626c897e798fde629b4782fe061bdc8bd65c8a',
    sui: '0x0025bafa2e6afa511c19bd4e95626c897e798fde629b4782fe061bdc8bd65c8a',
  },
}

const CHAIN_ICONS: Record<string, string> = {
  ethereum: '⟠',
  solana: '◎',
  sui: '💧',
}

// --- Standalone DAppKit (only used when NOT in sui-dashboard) ---
const standaloneDAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof standaloneDAppKit
  }
}

// --- Types ---
interface SuiLinkEntry {
  id: string
  chain: string
  linkedAddress: string
  timestamp: string
  objectType: string
}

// --- Helpers ---
function parseChainFromType(typeStr: string): string {
  const match = typeStr.match(/::(\w+)>$/)
  if (!match) return 'unknown'
  return match[1].toLowerCase()
}

function formatAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`
}

function formatDate(timestampMs: string): string {
  const date = new Date(Number(timestampMs))
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getExplorerUrl(chain: string, address: string): string | null {
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/address/${address}`
    case 'solana':
      return `https://solscan.io/account/${address}`
    case 'sui':
      return `https://suiscan.xyz/mainnet/account/${address}`
    default:
      return null
  }
}

// --- Core UI (used in both modes) ---
function SuiLinkContent() {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const dAppKitInstance = useDAppKit()

  const [links, setLinks] = useState<SuiLinkEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWallets, setShowWallets] = useState(false)

  const handleNetworkChange = (newNetwork: string) => {
    dAppKitInstance.switchNetwork(newNetwork as (typeof NETWORKS)[number])
  }

  useEffect(() => {
    if (!account?.address || !client) {
      setLinks([])
      return
    }

    const fetchLinks = async () => {
      setLoading(true)
      setError(null)

      try {
        const packages = SUILINK_PACKAGES[network]
        if (!packages) {
          setLinks([])
          setLoading(false)
          return
        }

        const allLinks: SuiLinkEntry[] = []

        const ethSolResult = await client.core.listOwnedObjects({
          owner: account.address,
          type: `${packages.ethSol}::suilink::SuiLink`,
          include: { json: true },
        })

        for (const obj of ethSolResult.objects) {
          if (obj.json) {
            const json = obj.json as Record<string, unknown>
            allLinks.push({
              id: (json.id as string) || obj.objectId,
              chain: parseChainFromType(obj.type),
              linkedAddress: (json.network_address as string) || '',
              timestamp: (json.timestamp_ms as string) || '',
              objectType: obj.type,
            })
          }
        }

        if (packages.sui !== packages.ethSol) {
          const suiResult = await client.core.listOwnedObjects({
            owner: account.address,
            type: `${packages.sui}::suilink::SuiLink`,
            include: { json: true },
          })

          for (const obj of suiResult.objects) {
            if (obj.json) {
              const json = obj.json as Record<string, unknown>
              allLinks.push({
                id: (json.id as string) || obj.objectId,
                chain: 'sui',
                linkedAddress: (json.network_address as string) || '',
                timestamp: (json.timestamp_ms as string) || '',
                objectType: obj.type,
              })
            }
          }
        }

        allLinks.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        setLinks(allLinks)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch SuiLinks')
      } finally {
        setLoading(false)
      }
    }

    fetchLinks()
  }, [account?.address, client, network])

  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      await dAppKitInstance.connectWallet({ wallet })
      setShowWallets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const handleDisconnect = async () => {
    try {
      await dAppKitInstance.disconnectWallet()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  if (!connection.isConnected) {
    return (
      <div className="sui-link">
        <div className="sui-link__header">
          <h3 className="sui-link__title">🔗 SuiLink</h3>
          <select
            className="sui-link__network-select"
            value={network}
            onChange={(e) => handleNetworkChange(e.target.value)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <p className="sui-link__desc">
          View your cross-chain wallet links. Connect your Sui wallet to see linked Ethereum,
          Solana, and Sui addresses.
        </p>

        {!showWallets ? (
          <button
            className="sui-link__connect-btn"
            onClick={() => setShowWallets(true)}
            disabled={connection.isConnecting}
          >
            {connection.isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="sui-link__wallets">
            {wallets.length === 0 ? (
              <div className="sui-link__empty">No wallets detected.</div>
            ) : (
              wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  className="sui-link__wallet-btn"
                  onClick={() => handleConnect(wallet)}
                >
                  {wallet.icon && (
                    <img src={wallet.icon} alt="" className="sui-link__wallet-icon" />
                  )}
                  {wallet.name}
                </button>
              ))
            )}
            <button className="sui-link__cancel-btn" onClick={() => setShowWallets(false)}>
              Cancel
            </button>
          </div>
        )}

        {error && <div className="sui-link__error">{error}</div>}
      </div>
    )
  }

  return (
    <div className="sui-link">
      <div className="sui-link__header">
        <h3 className="sui-link__title">🔗 SuiLink</h3>
        <div className="sui-link__header-actions">
          <select
            className="sui-link__network-select"
            value={network}
            onChange={(e) => handleNetworkChange(e.target.value)}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button className="sui-link__disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>

      <div className="sui-link__address">{account?.address}</div>

      {error && <div className="sui-link__error">{error}</div>}

      {loading ? (
        <div className="sui-link__loading">Fetching SuiLinks...</div>
      ) : links.length === 0 ? (
        <div className="sui-link__empty-state">
          <div className="sui-link__empty-icon">🔗</div>
          <p className="sui-link__empty-text">No SuiLinks found</p>
          <p className="sui-link__empty-hint">
            Visit{' '}
            <a
              href="https://www.suilink.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="sui-link__ext-link"
            >
              suilink.io
            </a>{' '}
            to link your Ethereum or Solana wallet.
          </p>
        </div>
      ) : (
        <div className="sui-link__section">
          <div className="sui-link__section-title">Linked Wallets ({links.length})</div>
          <div className="sui-link__list">
            {links.map((link) => {
              const explorerUrl = getExplorerUrl(link.chain, link.linkedAddress)
              return (
                <div key={link.id} className="sui-link__item">
                  <div className="sui-link__item-header">
                    <span className="sui-link__chain-badge">
                      <span className="sui-link__chain-icon">
                        {CHAIN_ICONS[link.chain] || '🔗'}
                      </span>
                      {link.chain.charAt(0).toUpperCase() + link.chain.slice(1)}
                    </span>
                    <span className="sui-link__nft-badge">Soulbound NFT</span>
                  </div>
                  <div className="sui-link__item-address">
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sui-link__address-link"
                        title={link.linkedAddress}
                      >
                        {formatAddress(link.linkedAddress)}
                        <span className="sui-link__external-arrow">↗</span>
                      </a>
                    ) : (
                      <span title={link.linkedAddress}>{formatAddress(link.linkedAddress)}</span>
                    )}
                  </div>
                  <div className="sui-link__item-meta">
                    {link.timestamp && (
                      <span className="sui-link__date">Linked {formatDate(link.timestamp)}</span>
                    )}
                    <span className="sui-link__obj-id" title={link.id}>
                      {formatAddress(link.id)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="sui-link__footer">
        <a
          href="https://www.suilink.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-link__footer-link"
        >
          Manage links on suilink.io ↗
        </a>
      </div>
    </div>
  )
}

// --- Standalone wrapper (plugin-demo: own DAppKitProvider) ---
function SuiLinkStandalone() {
  return (
    <DAppKitProvider dAppKit={standaloneDAppKit}>
      <SuiLinkContent />
    </DAppKitProvider>
  )
}

// --- Shared wrapper (sui-dashboard: DAppKitProvider already exists) ---
function SuiLinkShared() {
  return <SuiLinkContent />
}

const SuiLinkPlugin: Plugin = {
  name: 'SuiLink',
  version: '1.1.0',
  styleUrls: ['/plugins/sui-link/style.css'],

  init(host: HostAPI) {
    const Component = isSuiHostAPI(host) ? SuiLinkShared : SuiLinkStandalone
    host.registerComponent('SuiLink', Component)
    host.log(
      'SuiLink plugin initialized' + (isSuiHostAPI(host) ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[SuiLink] mounted')
  },

  unmount() {
    console.log('[SuiLink] unmounted')
  },
}

export default SuiLinkPlugin
