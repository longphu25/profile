/**
 * Directional Strategy — 2 wallets, trend-follow, +PnL
 * A buys base (long), B sells base (short), weighted by trend signal.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds, testnetCoins, testnetPools, testnetPackageIds } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { StrategyDeps } from '../types'
import { INDEXER, RPC } from '../types'
import { formatUsd, randRange } from '../utils'
import { buildSwapBuy, buildSwapSell } from '../sdk'

interface DirectionalDeps extends StrategyDeps {
  kpA: Ed25519Keypair
  kpB: Ed25519Keypair
  fetchAllCoins: (addr: string) => Promise<{ symbol: string; balance: string }[]>
  sharedHost: any
}

export async function executeDirectionalCycle(deps: DirectionalDeps): Promise<void> {
  const { kpA, kpB, network: net, config, addLog, stageRef, cycleRef, setCycleNum, fetchAllCoins, sharedHost } = deps
  const indexer = INDEXER[net]
  const aAddr = kpA.getPublicKey().toSuiAddress()
  const bAddr = kpB.getPublicKey().toSuiAddress()
  const poolKey = config.pool
  const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools
  const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })

  stageRef.current = 'opening'
  deps.setStage('opening')
  const num = cycleRef.current + 1
  cycleRef.current = num
  setCycleNum(num)
  addLog('info', `Cycle #${num} — Opening positions...`)

  let openPrice = 0, quotePerLeg = 0, quoteLong = 0, quoteShort = 0

  try {
    const tickerRes = await fetch(`${indexer}/ticker`)
    const ticker: Record<string, { last_price: number }> = await tickerRes.json()
    openPrice = ticker[poolKey]?.last_price ?? 0
    deps.setCurrentPrice(openPrice)
    if (!openPrice) throw new Error('Cannot fetch price')

    const [base, quote] = poolKey.split('_')
    const aCoins = await fetchAllCoins(aAddr)
    const bCoins = await fetchAllCoins(bAddr)
    const suiUsd = ticker['SUI_USDC']?.last_price ?? 1

    const aQuoteBal = parseFloat(aCoins.find((c) => c.symbol === quote)?.balance ?? '0')
    const maxQuoteA = (aQuoteBal - (quote === 'SUI' ? 0.5 : 0)) * 0.8
    const bBaseBal = parseFloat(bCoins.find((c) => c.symbol === base)?.balance ?? '0')
    const maxBaseB = (bBaseBal - (base === 'SUI' ? 0.5 : 0)) * 0.8
    const maxUsdA = quote === 'SUI' ? maxQuoteA * suiUsd : maxQuoteA
    const maxUsdB = base === 'SUI' ? maxBaseB * suiUsd : maxBaseB * openPrice * (quote === 'SUI' ? suiUsd : 1)
    const effectiveUsd = Math.min(config.notionalUsd, maxUsdA, maxUsdB) * 0.9
    if (effectiveUsd <= 0.5) throw new Error(`Not enough funds. A: $${maxUsdA.toFixed(2)}, B: $${maxUsdB.toFixed(2)}`)
    quotePerLeg = quote === 'SUI' ? effectiveUsd / suiUsd : effectiveUsd

    if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

    // Trend detection
    let longPct = 50, shortPct = 50
    try {
      const shared = sharedHost?.getSharedData('deepbook:analysis') as any
      if (shared?.pool === poolKey && Date.now() - shared.ts < 30000) {
        longPct = shared.recommendation.longPct
        shortPct = shared.recommendation.shortPct
      } else {
        const { runAnalysis } = await import('../../sui-deepbook-analysis/analysis')
        const trend = await runAnalysis(poolKey, net)
        longPct = trend.recommendation.longPct
        shortPct = trend.recommendation.shortPct
      }
    } catch { /* 50/50 */ }

    quoteLong = Math.min(quotePerLeg * (longPct / 50), maxQuoteA)
    quoteShort = Math.min(quotePerLeg * (shortPct / 50), maxQuoteA)
    let qtyShort = Math.min(quoteShort / openPrice, maxBaseB)

    const makeDb = (addr: string) => new DeepBookClient({
      client, address: addr, network: net,
      coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
      pools: sdkPools, packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
    })

    const txA = new Transaction()
    buildSwapBuy(makeDb(aAddr), poolKey, quoteLong, aAddr, txA)
    await deps.signAndExec(kpA, txA, net)
    addLog('success', `A: BUY filled`)

    const txB = new Transaction()
    buildSwapSell(makeDb(bAddr), poolKey, qtyShort, bAddr, txB)
    await deps.signAndExec(kpB, txB, net)
    addLog('success', `B: SELL filled`)

    deps.setTotalVolume((v) => v + config.notionalUsd * 2)
  } catch (err) {
    addLog('error', `Open failed: ${err instanceof Error ? err.message : err}`)
    stageRef.current = 'error'; deps.setStage('error'); return
  }

  // HOLD
  stageRef.current = 'holding'; deps.setStage('holding')
  const holdSec = randRange(config.holdMinSec, config.holdMaxSec)
  deps.setHoldStart(Date.now()); deps.setHoldEnd(Date.now() + holdSec * 1000)
  await new Promise((r) => setTimeout(r, holdSec * 1000))
  if (stageRef.current !== 'holding') return

  // CLOSE
  stageRef.current = 'closing'; deps.setStage('closing')
  try {
    const ticker2 = await fetch(`${indexer}/ticker`).then(r => r.json()) as Record<string, { last_price: number }>
    const closePrice = ticker2[poolKey]?.last_price ?? openPrice
    deps.setCurrentPrice(closePrice)

    const [base, quote] = poolKey.split('_')
    const aCoins = await fetchAllCoins(aAddr)
    const sellQty = (parseFloat(aCoins.find((c) => c.symbol === base)?.balance ?? '0') - (base === 'SUI' ? 0.5 : 0)) * 0.9
    const makeDb = (addr: string) => new DeepBookClient({
      client, address: addr, network: net,
      coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
      pools: sdkPools, packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
    })
    const txA = new Transaction()
    buildSwapSell(makeDb(aAddr), poolKey, sellQty, aAddr, txA)
    await deps.signAndExec(kpA, txA, net)

    const bCoins = await fetchAllCoins(bAddr)
    const closeQuote = (parseFloat(bCoins.find((c) => c.symbol === quote)?.balance ?? '0') - (quote === 'SUI' ? 0.5 : 0)) * 0.9
    const txB = new Transaction()
    buildSwapBuy(makeDb(bAddr), poolKey, closeQuote, bAddr, txB)
    await deps.signAndExec(kpB, txB, net)

    const priceDiff = closePrice - openPrice
    const pctChange = openPrice > 0 ? priceDiff / openPrice : 0
    const pnl = pctChange * quoteLong + (-pctChange * quoteShort)
    const suiUsd = ticker2['SUI_USDC']?.last_price ?? 1
    const pnlUsd = poolKey.split('_')[1] === 'SUI' ? pnl * suiUsd : pnl
    deps.setTotalPnl((p) => p + pnlUsd)
    deps.setHistory((h) => [{ num, openPrice, closePrice, pnl: pnlUsd, duration: holdSec }, ...h.slice(0, 49)])
    addLog(pnl >= 0 ? 'success' : 'warn', `Cycle #${num} done — PnL: ${formatUsd(pnlUsd)}`)
  } catch (err) {
    addLog('error', `Close failed: ${err instanceof Error ? err.message : err}`)
    stageRef.current = 'error'; deps.setStage('error'); return
  }

  deps.setHoldEnd(null); deps.setHoldStart(null); deps.setOrderPrices({ bid: null, ask: null })
  if (config.maxCycles && num >= config.maxCycles) { stageRef.current = 'idle'; deps.setStage('idle'); return }
  stageRef.current = 'idle'; deps.setStage('idle')
}
