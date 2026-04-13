// SUI WAL Swap Plugin
// Swap WAL ↔ SUI and WAL ↔ USDC via DeepBook v3 pools
// Uses DeepBook SDK for transaction building + Indexer for orderbook quotes

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds } from '@mysten/deepbook-v3'
import './style.css'

const INDEXER = 'https://deepbook-indexer.mainnet.mystenlabs.com'
const RPC_URL = 'https://fullnode.mainnet.sui.io:443'
const EXPLORER = 'https://suiscan.xyz/mainnet'

const PAIRS = [
  { key: 'WAL_SUI', label: 'WAL / SUI', base: 'WAL', quote: 'SUI' },
  { key: 'WAL_USDC', label: 'WAL / USDC', base: 'WAL', quote: 'USDC' },
] as const

type PairKey = (typeof PAIRS)[number]['key']

interface OrderBookData {
  bids: [string, string][]
  asks: [string, string][]
}

let sharedHost: SuiHostAPI | null = null

function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  return v.toFixed(6)
}

function formatNum(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(4)
}

function estimateOutput(
  amount: number,
  isBuy: boolean,
  ob: OrderBookData,
): { output: number; avgPrice: number; impact: number } {
  if (amount <= 0) return { output: 0, avgPrice: 0, impact: 0 }
  const levels = isBuy ? ob.asks : ob.bids
  if (levels.length === 0) return { output: 0, avgPrice: 0, impact: 0 }

  const best = Number(levels[0][0])
  let remaining = amount
  let filled = 0

  for (const [p, s] of levels) {
    const price = Number(p)
    const size = Number(s)
    if (isBuy) {
      const cost = price * size
      if (remaining >= cost) {
        remaining -= cost
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
  const avg = isBuy ? spent / filled || 0 : filled / (amount - remaining) || 0
  const impact = best > 0 ? Math.abs((avg - best) / best) * 100 : 0
  return { output: filled, avgPrice: avg, impact }
}

const WAL_TYPE = mainnetCoins.WAL.type

function WalSwapContent() {
  const [pair, setPair] = useState<PairKey>('WAL_SUI')
  const [isBuy, setIsBuy] = useState(true) // buy WAL (spend SUI/USDC)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [ob, setOb] = useState<OrderBookData | null>(null)
  const [walBal, setWalBal] = useState(0)
  const [quoteBal, setQuoteBal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swapping, setSwapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (!sharedHost) return null
    const d = sharedHost.getSharedData('walletProfile') as { address: string } | null
    return d?.address ?? null
  })

  const pairInfo = useMemo(() => PAIRS.find((p) => p.key === pair)!, [pair])
  const fromSymbol = isBuy ? pairInfo.quote : pairInfo.base
  const toSymbol = isBuy ? pairInfo.base : pairInfo.quote
  const fromBal = isBuy ? quoteBal : walBal

  // Track wallet from shared data
  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange('walletProfile', (v) => {
      const p = v as { address: string } | null
      setWalletAddress(p?.address ?? null)
      setIsConnected(!!p?.address)
    })
  }, [])

  // Fetch balances
  const fetchBalances = useCallback(
    async (addr: string) => {
      try {
        const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC_URL })
        const [walRes, quoteRes] = await Promise.all([
          client.core.getBalance({ owner: addr, coinType: WAL_TYPE }),
          client.core.getBalance({
            owner: addr,
            coinType: pairInfo.quote === 'SUI' ? '0x2::sui::SUI' : mainnetCoins.USDC.type,
          }),
        ])
        setWalBal(Number(walRes.balance.balance) / 1e9)
        const qDec = pairInfo.quote === 'SUI' ? 1e9 : 1e6
        setQuoteBal(Number(quoteRes.balance.balance) / qDec)
      } catch {
        /* ignore */
      }
    },
    [pairInfo],
  )

  useEffect(() => {
    if (walletAddress) fetchBalances(walletAddress)
  }, [walletAddress, fetchBalances])

  // Fetch orderbook
  const fetchOb = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${INDEXER}/orderbook/${pair}?level=2&depth=20`)
      if (!res.ok) throw new Error(`Orderbook: ${res.status}`)
      setOb(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [pair])

  useEffect(() => {
    fetchOb()
  }, [fetchOb])

  const amountNum = Number(amount) || 0
  const est = ob ? estimateOutput(amountNum, isBuy, ob) : null
  const minOut = est ? est.output * (1 - slippage / 100) : 0

  const handleFlip = () => {
    setIsBuy((b) => !b)
    setAmount('')
    setTxDigest(null)
    setError(null)
  }

  const handleSwap = async () => {
    if (!sharedHost || !walletAddress || !est || est.output <= 0) return

    setSwapping(true)
    setError(null)
    setTxDigest(null)

    try {
      const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC_URL })
      const dbClient = new DeepBookClient({
        client,
        address: walletAddress,
        network: 'mainnet',
        coins: mainnetCoins,
        pools: mainnetPools,
        packageIds: mainnetPackageIds,
      })

      const tx = new Transaction()
      tx.setSender(walletAddress)

      if (isBuy) {
        // Buy WAL: spend quote → receive WAL
        dbClient.deepBook.swapExactQuoteForBase({
          poolKey: pair,
          amount: amountNum,
          deepAmount: 0,
          minOut,
        })(tx)
      } else {
        // Sell WAL: spend WAL → receive quote
        dbClient.deepBook.swapExactBaseForQuote({
          poolKey: pair,
          amount: amountNum,
          deepAmount: 0,
          minOut,
        })(tx)
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
      setAmount('')
      if (walletAddress) fetchBalances(walletAddress)
      fetchOb()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSwapping(false)
    }
  }

  return (
    <div className="sui-walswap">
      <div className="sui-walswap__header">
        <h3 className="sui-walswap__title">WAL Swap</h3>
        <p className="sui-walswap__desc">Swap WAL via DeepBook v3 on-chain orderbook</p>
      </div>

      {/* Pair tabs */}
      <div className="sui-walswap__pairs">
        {PAIRS.map((p) => (
          <button
            key={p.key}
            className={`sui-walswap__pair-btn ${pair === p.key ? 'sui-walswap__pair-btn--active' : ''}`}
            onClick={() => {
              setPair(p.key)
              setAmount('')
              setTxDigest(null)
              setError(null)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="sui-walswap__error">{error}</div>}

      {txDigest && (
        <div className="sui-walswap__success">
          <span>✓ Swap successful</span>
          <a
            href={`${EXPLORER}/tx/${txDigest}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sui-walswap__link"
          >
            {txDigest.slice(0, 10)}...{txDigest.slice(-6)}
          </a>
        </div>
      )}

      {loading ? (
        <div className="sui-walswap__loading">Loading orderbook...</div>
      ) : (
        <>
          {/* From */}
          <div className="sui-walswap__card">
            <div className="sui-walswap__card-label">You pay</div>
            <div className="sui-walswap__card-row">
              <input
                className="sui-walswap__amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  setTxDigest(null)
                  setError(null)
                }}
              />
              <div className="sui-walswap__token">{fromSymbol}</div>
            </div>
            <div className="sui-walswap__card-sub">
              <span>Balance: {formatNum(fromBal)}</span>
              <button
                className="sui-walswap__balance-btn"
                onClick={() => setAmount(String(fromBal))}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Flip */}
          <div className="sui-walswap__flip">
            <button className="sui-walswap__flip-btn" onClick={handleFlip}>
              ↕
            </button>
          </div>

          {/* To */}
          <div className="sui-walswap__card">
            <div className="sui-walswap__card-label">You receive</div>
            <div className="sui-walswap__card-row">
              <input
                className="sui-walswap__amount"
                type="text"
                placeholder="0"
                value={est && est.output > 0 ? formatNum(est.output) : ''}
                readOnly
              />
              <div className="sui-walswap__token">{toSymbol}</div>
            </div>
            <div className="sui-walswap__card-sub">
              <span>Balance: {formatNum(isBuy ? walBal : quoteBal)}</span>
              {est && est.avgPrice > 0 && <span>Avg: {formatPrice(est.avgPrice)}</span>}
            </div>
          </div>

          {/* Quote */}
          {est && amountNum > 0 && est.output > 0 && (
            <div className="sui-walswap__quote">
              <div className="sui-walswap__quote-row">
                <span className="sui-walswap__quote-label">Rate</span>
                <span className="sui-walswap__quote-val">
                  1 {fromSymbol} ≈ {formatPrice(isBuy ? 1 / est.avgPrice : est.avgPrice)} {toSymbol}
                </span>
              </div>
              <div className="sui-walswap__quote-row">
                <span className="sui-walswap__quote-label">Price Impact</span>
                <span
                  className={`sui-walswap__quote-val ${est.impact > 1 ? 'sui-walswap__quote-val--red' : 'sui-walswap__quote-val--green'}`}
                >
                  {est.impact.toFixed(3)}%
                </span>
              </div>
              <div className="sui-walswap__quote-row">
                <span className="sui-walswap__quote-label">Min Received</span>
                <span className="sui-walswap__quote-val">
                  {formatNum(minOut)} {toSymbol}
                </span>
              </div>
              <div className="sui-walswap__quote-row">
                <span className="sui-walswap__quote-label">Slippage</span>
                <span className="sui-walswap__slippage">
                  {[0.1, 0.5, 1.0].map((s) => (
                    <button
                      key={s}
                      className={`sui-walswap__slip-btn ${slippage === s ? 'sui-walswap__slip-btn--active' : ''}`}
                      onClick={() => setSlippage(s)}
                    >
                      {s}%
                    </button>
                  ))}
                </span>
              </div>
              <div className="sui-walswap__quote-row">
                <span className="sui-walswap__quote-label">Route</span>
                <span className="sui-walswap__quote-val">DeepBook v3 · {pair}</span>
              </div>
            </div>
          )}

          {/* Action */}
          {!isConnected && sharedHost ? (
            <button
              className="sui-walswap__action sui-walswap__action--connect"
              onClick={() => sharedHost!.requestConnect()}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              className="sui-walswap__action"
              disabled={
                amountNum <= 0 || !est || est.output <= 0 || swapping || amountNum > fromBal
              }
              onClick={handleSwap}
            >
              {swapping
                ? 'Swapping...'
                : amountNum <= 0
                  ? 'Enter amount'
                  : amountNum > fromBal
                    ? 'Insufficient balance'
                    : `Swap ${fromSymbol} → ${toSymbol}`}
            </button>
          )}
        </>
      )}

      <div className="sui-walswap__footer">
        Powered by{' '}
        <a
          href="https://docs.sui.io/standards/deepbook"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-walswap__link"
        >
          DeepBook v3
        </a>
        {' · WAL_SUI + WAL_USDC pools'}
      </div>
    </div>
  )
}

const SuiWalSwapPlugin: Plugin = {
  name: 'SuiWalSwap',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-wal-swap/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiWalSwap', WalSwapContent)
    host.log('SuiWalSwap initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiWalSwap] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiWalSwap] unmounted')
  },
}

export default SuiWalSwapPlugin
