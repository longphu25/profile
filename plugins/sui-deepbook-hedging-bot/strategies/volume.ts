/**
 * Volume Farm Strategy — 1 wallet, buy+sell same amount, earn points from volume.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds, testnetCoins, testnetPools, testnetPackageIds } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { StrategyDeps } from '../types'
import { INDEXER, RPC } from '../types'
import { formatOBPrice, formatUsd, randRange } from '../utils'
import { buildSwapBuy, buildSwapSell } from '../sdk'

interface VolumeDeps extends StrategyDeps {
  kpA: Ed25519Keypair
  fetchAllCoins: (addr: string) => Promise<{ symbol: string; balance: string }[]>
}

export async function executeVolumeCycle(deps: VolumeDeps): Promise<void> {
  const { kpA, network: net, config, addLog, stageRef, cycleRef, setCycleNum, fetchAllCoins } = deps
  const indexer = INDEXER[net]
  const aAddr = kpA.getPublicKey().toSuiAddress()
  const poolKey = config.pool
  const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools
  const [base, quote] = poolKey.split('_')

  stageRef.current = 'opening'; deps.setStage('opening')
  const num = cycleRef.current + 1
  cycleRef.current = num; setCycleNum(num)

  try {
    if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

    const ticker = await fetch(`${indexer}/ticker`).then(r => r.json()) as Record<string, { last_price: number }>
    const price = ticker[poolKey]?.last_price ?? 0
    if (!price) throw new Error('No price')
    deps.setCurrentPrice(price)

    const suiUsd = ticker['SUI_USDC']?.last_price ?? 1
    const walletCoins = await fetchAllCoins(aAddr)
    const walletQuote = parseFloat(walletCoins.find((c) => c.symbol === quote)?.balance ?? '0')

    let swapQuote: number
    if (quote === 'SUI') swapQuote = Math.min((config.notionalUsd / suiUsd) * 0.8, (walletQuote - 0.3) * 0.5)
    else swapQuote = Math.min(config.notionalUsd * 0.8, walletQuote * 0.5)
    if (swapQuote <= 0) throw new Error(`Not enough ${quote}. Have: ${walletQuote.toFixed(4)}`)

    addLog('info', `Vol #${num} — BUY ${(swapQuote / price).toFixed(1)} ${base}`)

    const plainDb = new DeepBookClient({
      client: new SuiGrpcClient({ network: net, baseUrl: RPC[net] }),
      address: aAddr, network: net,
      coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
      pools: sdkPools, packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
    })
    const txBuy = new Transaction()
    buildSwapBuy(plainDb, poolKey, swapQuote, aAddr, txBuy)
    await deps.signAndExec(kpA, txBuy, net)
    addLog('success', `BUY filled at ${formatOBPrice(price)}`)

    // Short hold
    stageRef.current = 'holding'; deps.setStage('holding')
    const holdSec = randRange(5, 15)
    deps.setHoldStart(Date.now()); deps.setHoldEnd(Date.now() + holdSec * 1000)
    await new Promise((r) => setTimeout(r, holdSec * 1000))
    if (stageRef.current !== 'holding') return

    // SELL back
    stageRef.current = 'closing'; deps.setStage('closing')
    const freshCoins = await fetchAllCoins(aAddr)
    const sellQty = parseFloat(freshCoins.find((c) => c.symbol === base)?.balance ?? '0') * 0.95
    if (sellQty < 0.001) throw new Error(`No ${base} to sell`)

    const txSell = new Transaction()
    buildSwapSell(plainDb, poolKey, sellQty, aAddr, txSell)
    await deps.signAndExec(kpA, txSell, net)

    const volumeUsd = (quote === 'SUI' ? swapQuote * suiUsd : swapQuote) * 2
    deps.setTotalVolume((v) => v + volumeUsd)
    const pnl = -volumeUsd * 0.001
    deps.setTotalPnl((p) => p + pnl)
    deps.setHistory((h) => [{ num, openPrice: price, closePrice: price, pnl, duration: holdSec }, ...h.slice(0, 49)])
    addLog('success', `Vol #${num} done — Vol: ${formatUsd(volumeUsd)}`)
  } catch (err) {
    addLog('error', `Vol #${num} failed: ${err instanceof Error ? err.message : err}`)
    stageRef.current = 'error'; deps.setStage('error'); return
  }

  deps.setHoldEnd(null); deps.setHoldStart(null); deps.setOrderPrices({ bid: null, ask: null })
  if (config.maxCycles && num >= config.maxCycles) { stageRef.current = 'idle'; deps.setStage('idle'); return }
  stageRef.current = 'idle'; deps.setStage('idle')
}
