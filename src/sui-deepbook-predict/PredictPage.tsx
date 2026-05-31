import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { suiHostAPI, registerActions, updateSuiContext } from '../sui-dashboard/sui-host'
import { ShadowContainer } from '../plugins/ShadowContainer'

// --- DAppKit instance ---
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'testnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

// --- Plugin config ---
interface PluginEntry {
  id: string
  name: string
  label: string
  src: string
  styleUrl: string
}

const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

const PLUGINS: PluginEntry[] = [
  {
    id: 'predict',
    name: 'SuiDeepBookPredict',
    label: 'Predict Market',
    src: pluginPath('sui-deepbook-predict'),
    styleUrl: '/plugins/sui-deepbook-predict/style.css',
  },
  {
    id: 'swap',
    name: 'SuiSwap',
    label: 'Swap',
    src: pluginPath('sui-swap'),
    styleUrl: '/plugins/sui-swap/style.css',
  },
]

// --- Inner page (has access to DAppKit hooks) ---
function PredictInner() {
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showWallets, setShowWallets] = useState(false)
  const initRef = useRef(false)

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  useEffect(() => {
    updateSuiContext({
      address: account?.address ?? null,
      network,
      isConnected: connection.isConnected,
      accounts: [],
    })
    suiHostAPI.setSharedData(
      'walletProfile',
      account?.address ? { address: account.address } : null,
    )
  }, [account?.address, network, connection.isConnected])

  useEffect(() => {
    registerActions({
      onConnect: () => setShowWallets(true),
      onDisconnect: () => dAppKitInstance.disconnectWallet(),
      onNetworkSwitch: (net) =>
        dAppKitInstance.switchNetwork(net as 'mainnet' | 'testnet' | 'devnet'),
      onSignAndExecuteTransaction: async (transaction) => {
        const result = await dAppKitInstance.signAndExecuteTransaction({ transaction })
        const tx = result.Transaction ?? result.FailedTransaction
        if (result.$kind === 'FailedTransaction') {
          throw new Error(`Transaction failed: ${tx?.digest}`)
        }
        return { digest: tx!.digest, effects: tx }
      },
      onSignPersonalMessage: async (message) => {
        const result = await dAppKitInstance.signPersonalMessage({ message })
        return { signature: result.signature, bytes: result.bytes }
      },
    })
  }, [dAppKitInstance])

  const handleConnect = async (wallet: (typeof wallets)[0]) => {
    try {
      await dAppKitInstance.connectWallet({ wallet })
      setShowWallets(false)
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        wallet: err instanceof Error ? err.message : 'Failed to connect',
      }))
    }
  }

  const loadPlugin = useCallback(async (p: PluginEntry) => {
    try {
      const bustUrl = `${p.src}${p.src.includes('?') ? '&' : '?'}t=${Date.now()}`
      const module = await import(/* @vite-ignore */ bustUrl)
      const plugin = module.default
      if (!plugin?.name || !plugin?.init) throw new Error('Invalid plugin')
      plugin.init(suiHostAPI)
      plugin.mount?.()
      if (!suiHostAPI.getComponent(p.name)) throw new Error(`Component ${p.name} not registered`)
      setLoaded((prev) => new Set(prev).add(p.id))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [p.id]: err instanceof Error ? err.message : String(err) }))
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    PLUGINS.forEach(loadPlugin)
  }, [loadPlugin])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-ink)' }}>
      {/* Floating Navigation */}
      <header className="sticky top-0 z-40 mx-4 mt-4">
        <div
          className="mx-auto max-w-[1200px] flex items-center justify-between px-5 py-3 rounded-full border"
          style={{
            background: 'var(--color-panel)',
            borderColor: 'var(--color-line)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              style={{ color: 'var(--color-mint)' }}
            >
              <path
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
            >
              DeepBook Predict
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                background: 'rgba(128, 255, 213, 0.08)',
                color: 'var(--color-mint)',
                border: '1px solid rgba(128, 255, 213, 0.2)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--color-mint)' }}
              />
              Testnet
            </span>

            {connection.isConnected && account ? (
              <button type="button"
                onClick={() => dAppKitInstance.disconnectWallet()}
                className="rounded-full px-4 py-1.5 text-[11px] font-medium transition-all cursor-pointer"
                style={{
                  background: 'var(--color-panel-strong)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-line)',
                  fontFamily: 'var(--font-ui-mono)',
                }}
              >
                {account.address.slice(0, 6)}…{account.address.slice(-4)}
              </button>
            ) : (
              <button type="button"
                onClick={() => setShowWallets(true)}
                className="rounded-full px-4 py-1.5 text-[11px] font-bold transition-all cursor-pointer hover:shadow-[0_0_20px_rgba(128,255,213,0.2)]"
                style={{
                  background: 'linear-gradient(135deg, var(--color-mint), var(--color-teal))',
                  color: '#06231d',
                  fontFamily: 'var(--font-satoshi)',
                }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wallet picker overlay */}
      {showWallets && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(7, 16, 17, 0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowWallets(false)}
        >
          <div
            className="w-80 rounded-2xl p-6 shadow-2xl"
            style={{
              background: 'var(--color-panel-strong)',
              border: '1px solid var(--color-line-strong)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-4 text-sm font-bold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
            >
              Connect Wallet
            </h3>
            {wallets.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                No wallets detected. Install a Sui wallet extension.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {wallets.map((w) => (
                  <button type="button"
                    key={w.name}
                    onClick={() => handleConnect(w)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-xs transition-all cursor-pointer"
                    style={{
                      background: 'var(--color-ink)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-line)',
                      fontFamily: 'var(--font-satoshi)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-mint)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-line)')}
                  >
                    {w.icon && <img src={w.icon} alt="" className="h-6 w-6 rounded" />}
                    <span className="font-medium">{w.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button"
              onClick={() => setShowWallets(false)}
              className="mt-4 w-full rounded-lg py-2 text-xs transition-colors cursor-pointer"
              style={{
                border: '1px solid var(--color-line)',
                color: 'var(--color-muted)',
                background: 'transparent',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content — 3-column trading layout */}
      <main className="flex-1 overflow-hidden mt-4">
        <div
          className="h-full mx-auto max-w-[1600px] grid grid-cols-[240px_1fr_320px] gap-px"
          style={{ background: 'var(--color-line)' }}
        >
          {/* Left sidebar */}
          <aside className="overflow-y-auto p-3" style={{ background: 'var(--color-ink)' }}>
            <AccountPanel
              address={account?.address ?? null}
              isConnected={connection.isConnected}
              network={network}
              onConnect={() => setShowWallets(true)}
            />
          </aside>

          {/* Center: Predict plugin */}
          <section className="overflow-y-auto p-4" style={{ background: 'var(--color-ink)' }}>
            {(() => {
              const p = PLUGINS.find((x) => x.id === 'predict')!
              return (
                <div>
                  {errors[p.id] && (
                    <div
                      className="mb-3 rounded-lg px-3 py-2 text-xs"
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                      }}
                    >
                      {errors[p.id]}
                    </div>
                  )}
                  {loaded.has(p.id) ? (
                    <ShadowContainer styleUrls={[p.styleUrl]}>
                      {(() => {
                        const C = suiHostAPI.getComponent(p.name)
                        return C ? <C /> : null
                      })()}
                    </ShadowContainer>
                  ) : !errors[p.id] ? (
                    <div
                      className="text-center py-12 text-xs"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      Loading {p.label}…
                    </div>
                  ) : null}
                </div>
              )
            })()}
          </section>

          {/* Right sidebar: Swap plugin */}
          <aside className="overflow-y-auto p-3" style={{ background: 'var(--color-ink)' }}>
            {(() => {
              const p = PLUGINS.find((x) => x.id === 'swap')!
              return (
                <div>
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                      style={{ color: 'var(--color-teal)' }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                      />
                    </svg>
                    <span
                      className="text-xs font-bold"
                      style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
                    >
                      Swap
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      DeepBook v3
                    </span>
                  </div>
                  {errors[p.id] && (
                    <div
                      className="mb-2 rounded px-2 py-1 text-[10px]"
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                      }}
                    >
                      {errors[p.id]}
                    </div>
                  )}
                  {loaded.has(p.id) ? (
                    <ShadowContainer styleUrls={[p.styleUrl]}>
                      {(() => {
                        const C = suiHostAPI.getComponent(p.name)
                        return C ? <C /> : null
                      })()}
                    </ShadowContainer>
                  ) : !errors[p.id] ? (
                    <div
                      className="text-center py-8 text-[10px]"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      Loading {p.label}…
                    </div>
                  ) : null}
                </div>
              )
            })()}
          </aside>
        </div>
      </main>
    </div>
  )
}

// --- Account Panel ---
const REQUIRED_COINS = [
  { symbol: 'SUI', desc: 'Gas fees', type: '0x2::sui::SUI' },
  {
    symbol: 'DUSDC',
    desc: 'Quote asset for Predict',
    type: '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
  },
  {
    symbol: 'PLP',
    desc: 'Vault LP shares',
    type: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP',
  },
]

function AccountPanel({
  address,
  isConnected,
  network,
  onConnect,
}: {
  address: string | null
  isConnected: boolean
  network: string
  onConnect: () => void
}) {
  const [coins, setCoins] = useState<{ symbol: string; balance: string; coinType: string }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBalances = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const rpc = GRPC_URLS[network] || GRPC_URLS.testnet
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getAllBalances',
          params: [address],
        }),
      })
      const data = (await res.json()) as { result?: { coinType: string; totalBalance: string }[] }
      const parsed = (data.result ?? [])
        .map((c) => {
          const parts = c.coinType.split('::')
          const symbol = parts[parts.length - 1]
          const dec = ['SUI', 'WAL'].includes(symbol) ? 9 : 6
          return {
            symbol,
            balance: parseFloat((parseInt(c.totalBalance, 10) / 10 ** dec).toFixed(4)).toString(),
            coinType: c.coinType,
          }
        })
        .filter((c) => parseFloat(c.balance) > 0)
      setCoins(parsed)
    } catch {
      setCoins([])
    }
    setLoading(false)
  }, [address, network])

  useEffect(() => {
    const id = setTimeout(fetchBalances, 0)
    return () => clearTimeout(id)
  }, [fetchBalances])

  // Re-fetch when plugin signals a successful TX
  useEffect(() => {
    return suiHostAPI.onSharedDataChange('txRefresh', () => {
      setTimeout(fetchBalances, 2000) // delay for indexer
    })
  }, [fetchBalances])

  const cardStyle = {
    background: 'var(--color-panel)',
    border: '1px solid var(--color-line)',
    backdropFilter: 'blur(8px)',
  }

  if (!isConnected) {
    return (
      <div className="sticky top-4">
        <div className="rounded-xl p-4" style={cardStyle}>
          <h3
            className="text-[11px] font-bold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-satoshi)' }}
          >
            Account
          </h3>
          <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
            Connect wallet to view balances and trade.
          </p>
          <button type="button"
            onClick={onConnect}
            className="w-full rounded-lg py-2 text-xs font-bold transition-all cursor-pointer hover:shadow-[0_0_16px_rgba(128,255,213,0.15)]"
            style={{
              background: 'linear-gradient(135deg, var(--color-mint), var(--color-teal))',
              color: '#06231d',
              fontFamily: 'var(--font-satoshi)',
            }}
          >
            Connect Wallet
          </button>
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-line)' }}>
            <h4
              className="text-[10px] font-bold uppercase mb-2"
              style={{ color: 'var(--color-muted)' }}
            >
              Required Tokens
            </h4>
            {REQUIRED_COINS.map((c) => (
              <div key={c.symbol} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                    {c.symbol}
                  </span>
                  <span className="text-[10px] ml-2" style={{ color: 'var(--color-muted)' }}>
                    {c.desc}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                  —
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-4 flex flex-col gap-3">
      {/* Address card */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <h3
          className="text-[11px] font-bold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-satoshi)' }}
        >
          Account
        </h3>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--color-mint)' }} />
          <span
            className="text-xs"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-ui-mono)' }}
          >
            {address?.slice(0, 10)}…{address?.slice(-6)}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          Network: {network}
        </span>
      </div>

      {/* Balances */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-satoshi)' }}
          >
            Balances
          </h3>
          <button type="button"
            onClick={fetchBalances}
            className="text-[10px] cursor-pointer transition-colors"
            style={{ color: 'var(--color-muted)' }}
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
        {coins.length === 0 && !loading ? (
          <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            No tokens found
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {coins.map((c) => (
              <div
                key={c.coinType}
                className="flex items-center justify-between py-1"
                style={{ borderBottom: '1px solid var(--color-line)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {c.symbol}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-sui)', fontFamily: 'var(--font-ui-mono)' }}
                >
                  {c.balance}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Required for Predict */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <h3
          className="text-[11px] font-bold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-satoshi)' }}
        >
          Required for Predict
        </h3>
        {REQUIRED_COINS.map((req) => {
          const found = coins.find(
            (c) => c.symbol === req.symbol || c.coinType.includes(req.symbol.toLowerCase()),
          )
          const hasBalance = found && parseFloat(found.balance) > 0
          return (
            <div
              key={req.symbol}
              className="flex items-center justify-between py-1.5"
              style={{ borderBottom: '1px solid var(--color-line)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: hasBalance ? 'var(--color-mint)' : 'var(--color-amber)' }}
                />
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                    {req.symbol}
                  </span>
                  <span className="text-[10px] ml-1.5" style={{ color: 'var(--color-muted)' }}>
                    {req.desc}
                  </span>
                </div>
              </div>
              <span
                className="text-xs"
                style={{
                  color: hasBalance ? 'var(--color-mint)' : 'var(--color-amber)',
                  fontFamily: 'var(--font-ui-mono)',
                }}
              >
                {found ? found.balance : '0'}
              </span>
            </div>
          )
        })}
        <p className="text-[10px] mt-2" style={{ color: 'var(--color-muted)' }}>
          Request DUSDC:{' '}
          <a
            href="https://tally.so/r/Xx102L"
            target="_blank"
            rel="noopener"
            className="hover:underline"
            style={{ color: 'var(--color-sui)' }}
          >
            tally.so/r/Xx102L
          </a>
        </p>
      </div>
    </div>
  )
}

// --- Exported page component ---
export function PredictPage() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <PredictInner />
    </DAppKitProvider>
  )
}
