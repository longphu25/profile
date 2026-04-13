// SUI Swap Plugin
// Swap tokens via DeepBook v3 pools with real on-chain execution
// Builds swap transactions using @mysten/deepbook-v3 SDK
// Requires connected wallet (via SuiHostAPI) for execution

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPools,
  mainnetPackageIds,
  testnetCoins,
  testnetPools,
  testnetPackageIds,
} from '@mysten/deepbook-v3'
import './style.css'

const INDEXER = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

const EXPLORER = {
  mainnet: 'https://suiscan.xyz/mainnet',
  testnet: 'https://suiscan.xyz/testnet',
}

interface PoolInfo {
  pool_id: string
  pool_name: string
  base_asset_symbol: string
  quote_asset_symbol: string
  base_asset_decimals: number
  quote_asset_decimals: number
}

interface OrderBookData {
  bids: [string, string][]
  asks: [string, string][]
}

interface TickerEntry {
  last_price: number
  base_volume: number
  quote_volume: number
  isFrozen: number
}

let sharedHost: SuiHostAPI | null = null

// --- Helpers ---
function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

function formatNum(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(4)
}

/** Estimate output from orderbook depth (market order simulation) */
function estimateSwapOutput(
  amount: number,
  isBuy: boolean,
  orderbook: OrderBookData,
): { output: number; avgPrice: number; priceImpact: number } {
  if (amount <= 0) return { output: 0, avgPrice: 0, priceImpact: 0 }

  const levels = isBuy ? orderbook.asks : orderbook.bids
  if (levels.length === 0) return { output: 0, avgPrice: 0, priceImpact: 0 }

  const bestPrice = Number(levels[0][0])
  let remaining = amount
  let filled = 0

  for (const [priceStr, sizeStr] of levels) {
    const price = Number(priceStr)
    const size = Number(sizeStr)
    if (isBuy) {
      const levelCost = price * size
      if (remaining >= levelCost) {
        remaining -= levelCost
        filled += size
      } else {
        filled += remaining / price
        remaining = 0
        break
      }
    } else {
      if (remaining >= size) {
        remaining -= size
        filled += size * price
      } else {
        filled += remaining * price
        remaining = 0
        break
      }
    }
  }

  const spent = amount - remaining
  const avgPrice = isBuy ? spent / filled || 0 : filled / (amount - remaining) || 0
  const priceImpact = bestPrice > 0 ? Math.abs((avgPrice - bestPrice) / bestPrice) * 100 : 0

  return { output: filled, avgPrice, priceImpact }
}

/** Create a DeepBookClient for the given network and address */
function createDeepBook(network: 'mainnet' | 'testnet', address: string): DeepBookClient {
  const client = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
  return new DeepBookClient({
    client,
    address,
    network,
    coins: network === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: network === 'mainnet' ? mainnetPools : testnetPools,
    packageIds: network === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
  })
}

/** Check if a pool key exists in the SDK constants */
function isSdkPool(poolKey: string, network: 'mainnet' | 'testnet'): boolean {
  const pools = network === 'mainnet' ? mainnetPools : testnetPools
  return poolKey in pools
}

function SwapContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [pools, setPools] = useState<PoolInfo[]>([])
  const [selectedPool, setSelectedPool] = useState('')
  const [ticker, setTicker] = useState<Record<string, TickerEntry>>({})
  const [orderbook, setOrderbook] = useState<OrderBookData | null>(null)
  const [isBuy, setIsBuy] = useState(true)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5) // 0.5%
  const [loading, setLoading] = useState(true)
  const [obLoading, setObLoading] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  const base = INDEXER[network]
  const explorerBase = EXPLORER[network]

  // Track connection state
  useEffect(() => {
    if (!sharedHost) return
    const update = () => {
      const ctx = sharedHost!.getSuiContext()
      setIsConnected(ctx.isConnected)
      setWalletAddress(ctx.address)
    }
    update()
    return sharedHost.onSuiContextChange(update)
  }, [])

  const pool = useMemo(() => pools.find((p) => p.pool_name === selectedPool), [pools, selectedPool])
  const fromSymbol = isBuy ? (pool?.quote_asset_symbol ?? '—') : (pool?.base_asset_symbol ?? '—')
  const toSymbol = isBuy ? (pool?.base_asset_symbol ?? '—') : (pool?.quote_asset_symbol ?? '—')
  const lastPrice = ticker[selectedPool]?.last_price ?? 0
  const canUseSdk = isSdkPool(selectedPool, network)

  // Fetch pools + ticker
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${base}/get_pools`).then((r) => r.json()),
      fetch(`${base}/ticker`).then((r) => r.json()),
    ])
      .then(([poolData, tickerData]: [PoolInfo[], Record<string, TickerEntry>]) => {
        const active = poolData.filter((p) => tickerData[p.pool_name]?.isFrozen !== 1)
        setPools(active)
        setTicker(tickerData)
        if (active.length > 0 && !active.find((p) => p.pool_name === selectedPool)) {
          const def = active.find((p) => p.pool_name === 'SUI_USDC') ?? active[0]
          setSelectedPool(def.pool_name)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [base])

  // Fetch orderbook
  const fetchOrderbook = useCallback(async () => {
    if (!selectedPool) return
    setObLoading(true)
    try {
      const res = await fetch(`${base}/orderbook/${selectedPool}?level=2&depth=20`)
      if (!res.ok) throw new Error(`Orderbook: ${res.status}`)
      setOrderbook(await res.json())
    } catch {
      setOrderbook(null)
    } finally {
      setObLoading(false)
    }
  }, [base, selectedPool])

  useEffect(() => {
    fetchOrderbook()
  }, [fetchOrderbook])

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
    })
  }, [])

  const amountNum = Number(amount) || 0
  const estimate = orderbook ? estimateSwapOutput(amountNum, isBuy, orderbook) : null

  const handleFlip = () => {
    setIsBuy((b) => !b)
    setAmount('')
    setTxDigest(null)
    setSwapError(null)
  }

  const handleSwap = async () => {
    if (!sharedHost || !walletAddress || !estimate || estimate.output <= 0 || !canUseSdk) return

    setSwapping(true)
    setSwapError(null)
    setTxDigest(null)

    try {
      const dbClient = createDeepBook(network, walletAddress)
      const minOut = estimate.output * (1 - slippage / 100)

      // Build the swap transaction
      const tx = new Transaction()
      tx.setSender(walletAddress)

      if (isBuy) {
        // Buy base: spend quote → receive base
        // swapExactQuoteForBase: amount = quote amount, minOut = min base out
        dbClient.deepBook.swapExactQuoteForBase({
          poolKey: selectedPool,
          amount: amountNum,
          deepAmount: 0,
          minOut,
        })(tx)
      } else {
        // Sell base: spend base → receive quote
        // swapExactBaseForQuote: amount = base amount, minOut = min quote out
        dbClient.deepBook.swapExactBaseForQuote({
          poolKey: selectedPool,
          amount: amountNum,
          deepAmount: 0,
          minOut,
        })(tx)
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)

      // Refresh orderbook after swap
      fetchOrderbook()
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : String(err))
    } finally {
      setSwapping(false)
    }
  }

  return (
    <div className="sui-swap">
      <div className="sui-swap__header">
        <h3 className="sui-swap__title">Swap</h3>
        <p className="sui-swap__desc">Trade via DeepBook v3 orderbook</p>
      </div>

      {error && <div className="sui-swap__error">{error}</div>}
      {loading && <div className="sui-swap__loading">Loading pools...</div>}

      {!loading && (
        <>
          {/* From */}
          <div className="sui-swap__card">
            <div className="sui-swap__card-label">You pay</div>
            <div className="sui-swap__card-row">
              <input
                className="sui-swap__amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  setTxDigest(null)
                  setSwapError(null)
                }}
              />
              <select
                className="sui-swap__token-select"
                value={selectedPool}
                onChange={(e) => {
                  setSelectedPool(e.target.value)
                  setTxDigest(null)
                  setSwapError(null)
                }}
              >
                {pools.map((p) => (
                  <option key={p.pool_name} value={p.pool_name}>
                    {p.pool_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sui-swap__card-sub">
              <span>{fromSymbol}</span>
              <span>Price: {formatPrice(lastPrice)}</span>
            </div>
          </div>

          {/* Flip */}
          <div className="sui-swap__flip">
            <button className="sui-swap__flip-btn" onClick={handleFlip} title="Swap direction">
              ↕
            </button>
          </div>

          {/* To */}
          <div className="sui-swap__card">
            <div className="sui-swap__card-label">You receive</div>
            <div className="sui-swap__card-row">
              <input
                className="sui-swap__amount-input"
                type="text"
                placeholder="0"
                value={estimate && estimate.output > 0 ? formatNum(estimate.output) : ''}
                readOnly
              />
              <div className="sui-swap__token-select" style={{ cursor: 'default' }}>
                {toSymbol}
              </div>
            </div>
            <div className="sui-swap__card-sub">
              <span>{toSymbol}</span>
              {estimate && estimate.avgPrice > 0 && (
                <span>Avg: {formatPrice(estimate.avgPrice)}</span>
              )}
            </div>
          </div>

          {/* Quote details */}
          {estimate && amountNum > 0 && estimate.output > 0 && (
            <div className="sui-swap__quote">
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">Rate</span>
                <span className="sui-swap__quote-value">
                  1 {fromSymbol} ≈ {formatPrice(isBuy ? 1 / estimate.avgPrice : estimate.avgPrice)}{' '}
                  {toSymbol}
                </span>
              </div>
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">Price Impact</span>
                <span
                  className={`sui-swap__quote-value ${estimate.priceImpact > 1 ? 'sui-swap__quote-value--red' : 'sui-swap__quote-value--green'}`}
                >
                  {estimate.priceImpact.toFixed(3)}%
                </span>
              </div>
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">Min Received</span>
                <span className="sui-swap__quote-value">
                  {formatNum(estimate.output * (1 - slippage / 100))} {toSymbol}
                </span>
              </div>
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">Slippage</span>
                <span className="sui-swap__quote-value">
                  {[0.1, 0.5, 1.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      style={{
                        background: slippage === s ? '#4da2ff' : 'transparent',
                        color: slippage === s ? '#fff' : '#888',
                        border: `1px solid ${slippage === s ? '#4da2ff' : '#333'}`,
                        borderRadius: 4,
                        padding: '1px 6px',
                        marginLeft: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      {s}%
                    </button>
                  ))}
                </span>
              </div>
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">Route</span>
                <span className="sui-swap__quote-value">DeepBook v3 · {selectedPool}</span>
              </div>
            </div>
          )}

          {/* Swap error */}
          {swapError && <div className="sui-swap__error">{swapError}</div>}

          {/* Success */}
          {txDigest && (
            <div className="sui-swap__quote">
              <div className="sui-swap__quote-row">
                <span className="sui-swap__quote-label">✓ Swap successful</span>
                <span className="sui-swap__quote-value">
                  <a
                    href={`${explorerBase}/tx/${txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sui-swap__link"
                  >
                    {txDigest.slice(0, 10)}...{txDigest.slice(-6)}
                  </a>
                </span>
              </div>
            </div>
          )}

          {/* Action button */}
          {!isConnected && sharedHost ? (
            <button
              className="sui-swap__action sui-swap__action--connect"
              onClick={() => sharedHost!.requestConnect()}
            >
              Connect Wallet
            </button>
          ) : !canUseSdk && selectedPool ? (
            <button className="sui-swap__action" disabled>
              Pool not supported by SDK
            </button>
          ) : (
            <button
              className="sui-swap__action"
              disabled={amountNum <= 0 || !estimate || estimate.output <= 0 || swapping}
              onClick={handleSwap}
            >
              {swapping
                ? 'Swapping...'
                : amountNum <= 0
                  ? 'Enter amount'
                  : `Swap ${fromSymbol} → ${toSymbol}`}
            </button>
          )}

          {/* Mini orderbook */}
          {orderbook && (
            <div className="sui-swap__orderbook">
              <div className="sui-swap__ob-title">Orderbook {obLoading && '(refreshing...)'}</div>
              <div className="sui-swap__ob-grid">
                <div className="sui-swap__ob-side">
                  <div className="sui-swap__ob-label">Bids</div>
                  {orderbook.bids.slice(0, 5).map(([price, size], i) => (
                    <div key={i} className="sui-swap__ob-row sui-swap__ob-row--bid">
                      <span className="sui-swap__ob-price">{price}</span>
                      <span className="sui-swap__ob-size">{size}</span>
                    </div>
                  ))}
                </div>
                <div className="sui-swap__ob-side">
                  <div className="sui-swap__ob-label">Asks</div>
                  {orderbook.asks.slice(0, 5).map(([price, size], i) => (
                    <div key={i} className="sui-swap__ob-row sui-swap__ob-row--ask">
                      <span className="sui-swap__ob-price">{price}</span>
                      <span className="sui-swap__ob-size">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="sui-swap__footer">
        Powered by{' '}
        <a
          href="https://docs.sui.io/standards/deepbook"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-swap__link"
        >
          DeepBook v3
        </a>
        {' · Estimates from live orderbook'}
      </div>
    </div>
  )
}

const SuiSwapPlugin: Plugin = {
  name: 'SuiSwap',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-swap/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSwap', SwapContent)
    host.log('SuiSwap initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiSwap] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSwap] unmounted')
  },
}

export default SuiSwapPlugin
