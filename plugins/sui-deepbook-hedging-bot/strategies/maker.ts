/**
 * Maker Strategy — 2 wallets with Balance Managers, POST_ONLY limit orders, earn spread.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds, testnetCoins, testnetPools, testnetPackageIds, OrderType } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { StrategyDeps } from '../types'
import { INDEXER, RPC } from '../types'
import { formatOBPrice, formatUsd, randRange } from '../utils'

interface MakerDeps extends StrategyDeps {
  kpA: Ed25519Keypair
  kpB: Ed25519Keypair
  bmIdA: string
  bmIdB: string
  fetchAllCoins: (addr: string) => Promise<{ symbol: string; balance: string }[]>
  depositToManager: (kp: Ed25519Keypair, net: string, bmId: string, coinKey: string, amount: number) => Promise<void>
}

export async function executeMakerCycle(deps: MakerDeps): Promise<void> {
  const { kpA, kpB, bmIdA, bmIdB, network: net, config, addLog, stageRef, cycleRef, setCycleNum, fetchAllCoins, depositToManager } = deps
  const indexer = INDEXER[net]
  const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
  const aAddr = kpA.getPublicKey().toSuiAddress()
  const bAddr = kpB.getPublicKey().toSuiAddress()
  const poolKey = config.pool
  const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools

  stageRef.current = 'opening'; deps.setStage('opening')
  const num = cycleRef.current + 1
  cycleRef.current = num; setCycleNum(num)
  addLog('info', `Maker #${num} — Placing POST_ONLY orders...`)

  let bidPrice = 0, askPrice = 0, qty = 0

  const makeDb = (addr: string, bm: string) => new DeepBookClient({
    client, address: addr, network: net,
    coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: sdkPools, packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
    balanceManagers: { main: { address: bm } },
  })

  try {
    const [obRes, poolsRes] = await Promise.all([
      fetch(`${indexer}/orderbook/${poolKey}?level=2&depth=4`).then(r => r.json()),
      fetch(`${indexer}/get_pools`).then(r => r.json()),
    ])
    const ob = obRes as { bids: [string, string][]; asks: [string, string][] }
    if (!ob.bids.length || !ob.asks.length) throw new Error('Empty orderbook')
    bidPrice = parseFloat(ob.bids[0][0])
    askPrice = parseFloat(ob.asks[0][0])
    deps.setCurrentPrice((bidPrice + askPrice) / 2)

    const [base, quote] = poolKey.split('_')
    const poolsMeta = poolsRes as { pool_name: string; lot_size: number; min_size: number; base_asset_decimals: number }[]
    const poolMeta = poolsMeta.find((p) => p.pool_name === poolKey)
    const baseDec = poolMeta?.base_asset_decimals ?? 6
    const lotSize = (poolMeta?.lot_size ?? 1000000) / 10 ** baseDec
    const minSize = (poolMeta?.min_size ?? 10000000) / 10 ** baseDec

    if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

    const dbA = makeDb(aAddr, bmIdA)
    const dbB = makeDb(bAddr, bmIdB)

    // Cancel existing orders + settle
    for (const [kp, bm, addr] of [[kpA, bmIdA, aAddr] as const, [kpB, bmIdB, bAddr] as const]) {
      try {
        const tx = new Transaction()
        tx.add(makeDb(addr, bm).deepBook.cancelAllOrders(poolKey, 'main'))
        await deps.signAndExec(kp, tx, net)
      } catch {}
    }

    // Check + top-up manager balances
    const [mgrBalA, mgrBalB] = await Promise.all([
      dbA.checkManagerBalanceWithAddress(bmIdA, quote),
      dbB.checkManagerBalanceWithAddress(bmIdB, base),
    ])
    addLog('info', `Mgr A: ${mgrBalA.balance.toFixed(4)} ${quote} | Mgr B: ${mgrBalB.balance.toFixed(4)} ${base}`)

    const minQuoteNeeded = minSize * askPrice * 1.1
    const minBaseNeeded = minSize * 1.1

    // Top-up A (quote) if needed
    if (mgrBalA.balance < minQuoteNeeded) {
      const walletCoins = await fetchAllCoins(aAddr)
      const walletQuote = parseFloat(walletCoins.find((c) => c.symbol === quote)?.balance ?? '0')
      if ((walletQuote - 0.5) * 0.8 > 0.001) {
        const topUp = Math.min((walletQuote - 0.5) * 0.8, minQuoteNeeded * 5)
        await depositToManager(kpA, net, bmIdA, quote, topUp)
        mgrBalA.balance += topUp
      }
    }

    // Top-up B (base) if needed
    if (mgrBalB.balance < minBaseNeeded) {
      const walletCoins = await fetchAllCoins(bAddr)
      const walletBase = parseFloat(walletCoins.find((c) => c.symbol === base)?.balance ?? '0')
      if (walletBase * 0.8 > 0.001) {
        const topUp = Math.min(walletBase * 0.8, minBaseNeeded * 5)
        await depositToManager(kpB, net, bmIdB, base, topUp)
        mgrBalB.balance += topUp
      }
    }

    const maxQtyFromA = (mgrBalA.balance * 0.9) / bidPrice
    const maxQtyFromB = mgrBalB.balance * 0.9
    qty = Math.floor(Math.min(maxQtyFromA, maxQtyFromB) / lotSize) * lotSize
    if (qty < minSize) throw new Error(`Qty ${qty} < min ${minSize}`)

    const oid = Date.now().toString()

    // A: BUY at bid
    const txA = new Transaction()
    txA.add(makeDb(aAddr, bmIdA).deepBook.placeLimitOrder({
      poolKey, balanceManagerKey: 'main', clientOrderId: oid,
      price: bidPrice, quantity: qty, isBid: true,
      orderType: OrderType.POST_ONLY, payWithDeep: false,
    }))
    await deps.signAndExec(kpA, txA, net)
    addLog('success', `A: BUY at ${formatOBPrice(bidPrice)}`)

    // B: SELL at ask
    const txB = new Transaction()
    txB.add(makeDb(bAddr, bmIdB).deepBook.placeLimitOrder({
      poolKey, balanceManagerKey: 'main', clientOrderId: oid,
      price: askPrice, quantity: qty, isBid: false,
      orderType: OrderType.POST_ONLY, payWithDeep: false,
    }))
    await deps.signAndExec(kpB, txB, net)
    addLog('success', `B: SELL at ${formatOBPrice(askPrice)}`)

    deps.setOrderPrices({ bid: bidPrice, ask: askPrice })
    deps.setTotalVolume((v) => v + config.notionalUsd * 2)
  } catch (err) {
    addLog('error', `Maker open failed: ${err instanceof Error ? err.message : err}`)
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
    const txCA = new Transaction()
    txCA.add(makeDb(aAddr, bmIdA).deepBook.cancelAllOrders(poolKey, 'main'))
    await deps.signAndExec(kpA, txCA, net)
    const txCB = new Transaction()
    txCB.add(makeDb(bAddr, bmIdB).deepBook.cancelAllOrders(poolKey, 'main'))
    await deps.signAndExec(kpB, txCB, net)

    const pnl = (askPrice - bidPrice) * qty
    deps.setTotalPnl((p) => p + pnl)
    deps.setHistory((h) => [{ num, openPrice: bidPrice, closePrice: askPrice, pnl, duration: holdSec }, ...h.slice(0, 49)])
    addLog('success', `Maker #${num} done — Spread: ${formatUsd(pnl)}`)
  } catch (err) {
    addLog('error', `Maker close failed: ${err instanceof Error ? err.message : err}`)
    stageRef.current = 'error'; deps.setStage('error'); return
  }

  deps.setHoldEnd(null); deps.setHoldStart(null); deps.setOrderPrices({ bid: null, ask: null })
  if (config.maxCycles && num >= config.maxCycles) { stageRef.current = 'idle'; deps.setStage('idle'); return }
  stageRef.current = 'idle'; deps.setStage('idle')
}
