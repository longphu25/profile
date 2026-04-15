/**
 * Margin Strategy — extracted from plugin.tsx
 *
 * Uses MarginManager + PoolProxy for POST_ONLY orders with borrowing.
 * Earns DeepBook points via: margin borrowing, interest, leverage, duration.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { OrderType, SelfMatchingOptions } from '@mysten/deepbook-v3'
import type { StrategyDeps } from '../types'
import { INDEXER, RPC } from '../types'
import { formatOBPrice, formatUsd, findBal, randRange, fetchAllBalances } from '../utils'
import { makeMarginDb as _makeMarginDb, makeSwapDb } from '../sdk'
import type { Network } from '../sdk'

interface MarginCycleDeps extends StrategyDeps {
  kpA: Ed25519Keypair
  kpB: Ed25519Keypair
  mmIdA: string
  mmIdB: string
  cleanupMargin: () => Promise<void>
}

export async function executeMarginCycle(deps: MarginCycleDeps): Promise<void> {
  const { kpA, kpB, mmIdA, mmIdB, network: net, config, addLog, stageRef, cycleRef, setCycleNum, cleanupMargin } = deps
  const indexer = INDEXER[net]
  const aAddr = kpA.getPublicKey().toSuiAddress()
  const bAddr = kpB.getPublicKey().toSuiAddress()
  const poolKey = config.pool
  const makeDb = (addr: string, mmId: string) => _makeMarginDb(addr, mmId, poolKey, net)

  stageRef.current = 'opening'
  deps.setStage('opening')
  const num = cycleRef.current + 1
  cycleRef.current = num
  setCycleNum(num)
  addLog('info', `Margin #${num} — POST_ONLY + borrow...`)

  let bidPrice = 0, askPrice = 0, qty = 0, holdSec = 0, safeBid = 0, safeAsk = 0

  try {
    // Fetch all balances for both wallets
    const [balResA, balResB] = await Promise.all([
      fetchAllBalances(RPC[net], aAddr),
      fetchAllBalances(RPC[net], bAddr),
    ])
    const aSui = findBal(balResA, 'SUI', 9)
    const bSui = findBal(balResB, 'SUI', 9)

    // Auto-topup gas
    const minGas = 0.2, topupAmount = 0.3
    if (bSui < minGas && aSui > minGas + topupAmount) {
      addLog('info', `B low on gas (${bSui.toFixed(4)} SUI) — transferring ${topupAmount} SUI from A`)
      const tx = new Transaction()
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(Math.floor(topupAmount * 1e9))])
      tx.transferObjects([coin], bAddr)
      await deps.signAndExec(kpA, tx, net)
    } else if (aSui < minGas && bSui > minGas + topupAmount) {
      addLog('info', `A low on gas (${aSui.toFixed(4)} SUI) — transferring ${topupAmount} SUI from B`)
      const tx = new Transaction()
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(Math.floor(topupAmount * 1e9))])
      tx.transferObjects([coin], aAddr)
      await deps.signAndExec(kpB, tx, net)
    } else if (aSui < minGas && bSui < minGas) {
      throw new Error(`Both wallets low on SUI gas (A: ${aSui.toFixed(4)}, B: ${bSui.toFixed(4)}). Deposit more SUI.`)
    }

    // Auto-rebalance
    const [baseSymbol, quoteSymbol] = poolKey.split('_')
    const quoteDec0 = quoteSymbol === 'USDC' || quoteSymbol === 'USDT' ? 6 : 9
    const baseDec0 = baseSymbol === 'USDC' || baseSymbol === 'USDT' ? 6 : 9
    const aQuote = findBal(balResA, quoteSymbol, quoteDec0)
    const bBase = findBal(balResB, baseSymbol, baseDec0)
    const halfNotional = config.notionalUsd * 0.5

    const tickerPre = await fetch(`${indexer}/ticker`).then(r => r.json()) as Record<string, { last_price: number }>
    const midEst = tickerPre[poolKey]?.last_price ?? tickerPre['SUI_USDC']?.last_price ?? 1
    // Need enough collateral so qty >= minSize after borrowFactor
    const borrowFactor = 2
    const aQuoteNeeded = Math.max(halfNotional / borrowFactor, 1 * midEst / borrowFactor) * 1.3
    const bBaseNeeded = Math.max(halfNotional / borrowFactor / midEst, 1 / borrowFactor) * 1.3

    if (aQuote < aQuoteNeeded * 0.9) {
      const surplus = findBal(balResA, baseSymbol, baseDec0) - (baseSymbol === 'SUI' ? 0.3 : 0)
      if (surplus > 0.01) {
        const deficit = aQuoteNeeded - aQuote
        const swapAmt = Math.min(surplus * 0.9, deficit / midEst * 1.2)
        addLog('info', `A: swapping ${swapAmt.toFixed(4)} ${baseSymbol} → ${quoteSymbol}`)
        try {
          const txS = new Transaction()
          const r = makeSwapDb(aAddr, net).deepBook.swapExactBaseForQuote({ poolKey, amount: swapAmt, deepAmount: 0, minOut: 0 })(txS)
          txS.transferObjects([...r], aAddr)
          await deps.signAndExec(kpA, txS, net)
        } catch (e) { addLog('warn', `A: swap failed — ${e instanceof Error ? e.message.slice(0, 60) : e}`) }
      }
    }

    if (bBase < bBaseNeeded * 0.9) {
      const surplus = findBal(balResB, quoteSymbol, quoteDec0) - (quoteSymbol === 'SUI' ? 0.3 : 0)
      if (surplus > 0.01) {
        const deficit = bBaseNeeded - bBase
        const swapAmt = Math.min(surplus * 0.9, deficit * midEst * 1.2)
        addLog('info', `B: swapping ${swapAmt.toFixed(4)} ${quoteSymbol} → ${baseSymbol}`)
        try {
          const txS = new Transaction()
          const r = makeSwapDb(bAddr, net).deepBook.swapExactQuoteForBase({ poolKey, amount: swapAmt, deepAmount: 0, minOut: 0 })(txS)
          txS.transferObjects([...r], bAddr)
          await deps.signAndExec(kpB, txS, net)
          addLog('info', `B: swap done, waiting for settle...`)
        } catch (e) { addLog('warn', `B: swap failed — ${e instanceof Error ? e.message.slice(0, 60) : e}`) }
      }
    }

    // Wait for swaps to settle before re-fetching balances
    await new Promise(r => setTimeout(r, 2000))

    // Re-fetch balances
    const [balResA2, balResB2] = await Promise.all([
      fetchAllBalances(RPC[net], aAddr),
      fetchAllBalances(RPC[net], bAddr),
    ])

    // Fetch orderbook + ticker + pools
    const [obRes, tickerRes, poolsRes] = await Promise.all([
      fetch(`${indexer}/orderbook/${poolKey}?level=2&depth=4`).then(r => r.json()),
      fetch(`${indexer}/ticker`).then(r => r.json()),
      fetch(`${indexer}/get_pools`).then(r => r.json()),
    ])
    const ob = obRes as { bids: [string, string][]; asks: [string, string][] }
    if (!ob.bids.length || !ob.asks.length) throw new Error('Empty orderbook')
    bidPrice = parseFloat(ob.bids[0][0])
    askPrice = parseFloat(ob.asks[0][0])
    const mid = (bidPrice + askPrice) / 2
    deps.setCurrentPrice(mid)

    const ticker = tickerRes as Record<string, { last_price: number }>
    const suiUsd = ticker['SUI_USDC']?.last_price ?? 1
    let quotePerLeg: number
    if (quoteSymbol === 'USDC' || quoteSymbol === 'USDT') quotePerLeg = config.notionalUsd * 0.5
    else if (quoteSymbol === 'SUI') quotePerLeg = (config.notionalUsd * 0.5) / suiUsd
    else quotePerLeg = (config.notionalUsd * 0.5) / (ticker[`${quoteSymbol}_USDC`]?.last_price ?? 1)

    // Pool constraints
    const poolsMeta = poolsRes as { pool_name: string; lot_size: number; min_size: number; base_asset_decimals: number; quote_asset_decimals: number; tick_size: number }[]
    const poolMeta = poolsMeta.find((p) => p.pool_name === poolKey)
    const baseDec = poolMeta?.base_asset_decimals ?? 9
    const quoteDec = poolMeta?.quote_asset_decimals ?? 6
    const lotSize = (poolMeta?.lot_size ?? 100000000) / 10 ** baseDec
    const minSize = (poolMeta?.min_size ?? 1000000000) / 10 ** baseDec
    const tickSize = (poolMeta?.tick_size ?? 100) / 10 ** quoteDec
    qty = Math.floor((quotePerLeg / mid) / lotSize) * lotSize
    qty = parseFloat(qty.toFixed(9))
    if (qty < minSize) throw new Error(`Qty ${qty} < min ${minSize}`)

    const oid = Date.now().toString()

    // Balance check
    const gasReserve = 0.15
    const aQuoteBal = findBal(balResA2, quoteSymbol, quoteDec)
    const bBaseBal = findBal(balResB2, baseSymbol, baseDec)
    const aAvail = quoteSymbol === 'SUI' ? Math.max(aQuoteBal - gasReserve, 0) : aQuoteBal
    const bAvail = baseSymbol === 'SUI' ? Math.max(bBaseBal - gasReserve, 0) : bBaseBal
    const aDeposit = Math.min(quotePerLeg, aAvail * 0.95)
    const bDeposit = Math.min(qty, bAvail * 0.95)

    const effectiveQtyFromA = aDeposit * borrowFactor / mid
    const effectiveQtyFromB = bDeposit * borrowFactor
    qty = Math.floor(Math.min(qty, effectiveQtyFromA, effectiveQtyFromB) / lotSize) * lotSize
    qty = parseFloat(qty.toFixed(9))
    if (qty < minSize) throw new Error(`Qty ${qty} < min ${minSize} (A has ${aAvail.toFixed(4)} ${quoteSymbol}, B has ${bAvail.toFixed(4)} ${baseSymbol})`)

    const actualADeposit = Math.min(aDeposit, (qty * mid) / borrowFactor)
    const actualBDeposit = Math.min(bDeposit, qty / borrowFactor)

    safeBid = Math.min(bidPrice, askPrice - tickSize * 3)
    safeAsk = Math.max(askPrice, bidPrice + tickSize * 3)

    addLog('info', `Bid: ${formatOBPrice(safeBid)} Ask: ${formatOBPrice(safeAsk)} Qty: ${qty} Borrow: ${borrowFactor}× A:${actualADeposit.toFixed(4)}${quoteSymbol} B:${actualBDeposit.toFixed(4)}${baseSymbol}`)

    // Place orders with retry
    const placeOrder = async (label: string, kp: Ed25519Keypair, db: any, isBid: boolean, depositFn: string, borrowFn: string, depositAmt: number, price: number) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        let orderPrice = price
        if (attempt > 0) {
          const freshOb = await fetch(`${indexer}/orderbook/${poolKey}?level=2&depth=4`).then(r => r.json())
          const freshBid = parseFloat(freshOb.bids?.[0]?.[0] ?? '0')
          const freshAsk = parseFloat(freshOb.asks?.[0]?.[0] ?? '0')
          orderPrice = isBid ? Math.min(freshBid, freshAsk - tickSize * 5) : Math.max(freshAsk, freshBid + tickSize * 5)
          addLog('info', `${label}: retry #${attempt} at ${formatOBPrice(orderPrice)}`)
        }
        try {
          const tx = new Transaction()
          db.marginManager[depositFn]({ managerKey: 'main', amount: depositAmt })(tx)
          db.marginManager[borrowFn]('main', depositAmt * (borrowFactor - 1))(tx)
          db.poolProxy.updateCurrentPrice(poolKey)(tx)
          db.poolProxy.placeLimitOrder({
            poolKey, marginManagerKey: 'main', clientOrderId: oid, price: orderPrice, quantity: qty, isBid,
            orderType: OrderType.POST_ONLY, selfMatchingOption: SelfMatchingOptions.CANCEL_TAKER, payWithDeep: false,
          })(tx)
          await deps.signAndExec(kp, tx, net)
          addLog('success', `${label}: ${isBid ? 'BUY' : 'SELL'} at ${formatOBPrice(orderPrice)} (${borrowFactor}× leverage)`)
          return orderPrice
        } catch (e) {
          if ((e instanceof Error ? e.message : '').includes('abort code: 5') && attempt < 2) continue
          throw e
        }
      }
      throw new Error('POST_ONLY order failed after retries')
    }

    addLog('info', 'A: margin BUY (POST_ONLY + borrow)...')
    safeBid = await placeOrder('A', kpA, makeDb(aAddr, mmIdA), true, 'depositQuote', 'borrowQuote', actualADeposit, safeBid)
    addLog('info', 'B: margin SELL (POST_ONLY + borrow)...')
    safeAsk = await placeOrder('B', kpB, makeDb(bAddr, mmIdB), false, 'depositBase', 'borrowBase', actualBDeposit, safeAsk)

    deps.setOrderPrices({ bid: safeBid, ask: safeAsk })
    deps.setTotalVolume((v) => v + config.notionalUsd * 2 * borrowFactor)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    addLog('error', `Margin open failed: ${msg}`)
    addLog('info', 'Cleaning up margin positions...')
    await cleanupMargin()
    addLog('success', 'Margin positions closed after error')
    stageRef.current = 'error'
    deps.setStage('error')
    return
  }

  // HOLD
  stageRef.current = 'holding'
  deps.setStage('holding')
  holdSec = randRange(config.holdMinSec, config.holdMaxSec)
  deps.setHoldStart(Date.now())
  deps.setHoldEnd(Date.now() + holdSec * 1000)
  addLog('info', `Holding ${holdSec}s (earning interest → points)...`)
  await new Promise((r) => setTimeout(r, holdSec * 1000))
  if (stageRef.current !== 'holding') return

  // CLOSE
  stageRef.current = 'closing'
  deps.setStage('closing')
  addLog('info', `Margin #${num} — Cancel + repay + withdraw...`)
  try {
    for (const [label, kp, addr, mmId] of [
      ['A', kpA, aAddr, mmIdA] as const,
      ['B', kpB, bAddr, mmIdB] as const,
    ]) {
      const db = makeDb(addr, mmId)
      const tx1 = new Transaction()
      db.poolProxy.cancelAllOrders('main')(tx1)
      db.poolProxy.withdrawSettledAmounts('main')(tx1)
      await deps.signAndExec(kp, tx1, net)
      try { const tx = new Transaction(); db.marginManager.repayBase('main')(tx); await deps.signAndExec(kp, tx, net) } catch {}
      try { const tx = new Transaction(); db.marginManager.repayQuote('main')(tx); await deps.signAndExec(kp, tx, net) } catch {}
      try {
        const state = await db.getMarginManagerState('main')
        const hasBase = parseFloat(state.baseAsset) > 0
        const hasQuote = parseFloat(state.quoteAsset) > 0
        if (hasBase || hasQuote) {
          const tx = new Transaction()
          const coins: any[] = []
          if (hasBase) coins.push(db.marginManager.withdrawBase('main', parseFloat(state.baseAsset) * 0.999)(tx))
          if (hasQuote) coins.push(db.marginManager.withdrawQuote('main', parseFloat(state.quoteAsset) * 0.999)(tx))
          if (coins.length) tx.transferObjects(coins, addr)
          await deps.signAndExec(kp, tx, net)
        }
      } catch {}
      addLog('info', `${label}: closed`)
    }

    const spread = safeAsk - safeBid
    const pnl = spread * qty
    deps.setTotalPnl((p) => p + pnl)
    deps.setHistory((h) => [{ num, openPrice: safeBid, closePrice: safeAsk, pnl, duration: holdSec }, ...h.slice(0, 49)])
    addLog('success', `Margin #${num} done — Spread: ${formatUsd(pnl)} — Interest paid → points earned`)
  } catch (err) {
    addLog('error', `Margin close failed: ${err instanceof Error ? err.message : err}`)
    addLog('info', 'Retrying cleanup...')
    await cleanupMargin()
    stageRef.current = 'error'
    deps.setStage('error')
    return
  }

  deps.setHoldEnd(null)
  deps.setHoldStart(null)
  deps.setOrderPrices({ bid: null, ask: null })
  if (config.maxCycles && num >= config.maxCycles) {
    addLog('info', 'Max cycles reached')
    stageRef.current = 'idle'
    deps.setStage('idle')
    return
  }
  stageRef.current = 'idle'
  deps.setStage('idle')
}

/** Cleanup margin positions: cancel + repay (with auto-swap if needed) + withdraw */
export async function cleanupMarginPositions(
  kpA: Ed25519Keypair, kpB: Ed25519Keypair,
  mmIdA: string, mmIdB: string,
  net: Network, poolKey: string,
  addLog: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void,
  signAndExec: (kp: Ed25519Keypair, tx: any, net: string) => Promise<any>,
): Promise<void> {
  let ob: any = null
  try { ob = await fetch(`${INDEXER[net]}/orderbook/${poolKey}?level=2&depth=4`).then(r => r.json()) } catch {}

  for (const [label, kp, mmId] of [
    ['A', kpA, mmIdA] as const,
    ['B', kpB, mmIdB] as const,
  ]) {
    const addr = kp.getPublicKey().toSuiAddress()
    const db = _makeMarginDb(addr, mmId, poolKey, net)
    addLog('info', `${label}: cleanup MM ${mmId.slice(0, 12)}…`)

    // Cancel + settle
    try {
      const tx = new Transaction()
      db.poolProxy.cancelAllOrders('main')(tx)
      db.poolProxy.withdrawSettledAmounts('main')(tx)
      const r = await signAndExec(kp, tx, net) as any
      addLog('info', `${label}: cancel+settle tx: ${(r?.digest ?? '').slice(0, 16)}…`)
    } catch (e) { addLog('warn', `${label}: cancel+settle skipped — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }

    // Read state
    let mmState: any = null
    try {
      mmState = await db.getMarginManagerState('main')
      addLog('info', `${label}: state — base:${mmState.baseAsset} quote:${mmState.quoteAsset} baseDebt:${mmState.baseDebt} quoteDebt:${mmState.quoteDebt}`)
    } catch { addLog('warn', `${label}: could not read MM state`) }

    const baseDebt = parseFloat(mmState?.baseDebt ?? '0')
    const quoteDebt = parseFloat(mmState?.quoteDebt ?? '0')
    const [baseSymbol, quoteSymbol] = poolKey.split('_')

    const walletBal = async (coinSym: string) => {
      const r = await fetchAllBalances(RPC[net], addr)
      return findBal(r, coinSym, (coinSym === 'USDC' || coinSym === 'USDT') ? 6 : 9)
    }

    // Gas topup if needed
    const suiBal = await walletBal('SUI')
    if (suiBal < 0.2 && (baseDebt > 0 || quoteDebt > 0)) {
      const otherKp = kp === kpA ? kpB : kpA
      addLog('info', `${label}: low SUI (${suiBal.toFixed(4)}) — transferring 0.3 SUI for gas`)
      try {
        const txG = new Transaction()
        const [coin] = txG.splitCoins(txG.gas, [txG.pure.u64(300_000_000)])
        txG.transferObjects([coin], addr)
        const rG = await signAndExec(otherKp, txG, net) as any
        addLog('info', `${label}: gas transfer tx: ${(rG?.digest ?? '').slice(0, 16)}…`)
      } catch (e) { addLog('warn', `${label}: gas transfer failed — ${e instanceof Error ? e.message.slice(0, 60) : e}`) }
    }

    // Repay base debt (with swap if needed)
    if (baseDebt > 0) {
      const needed = baseDebt * 1.02
      const available = await walletBal(baseSymbol) - (baseSymbol === 'SUI' ? 0.15 : 0)
      if (available < needed) {
        const deficit = needed - Math.max(available, 0)
        const swapQuoteAmount = deficit * parseFloat(ob?.asks?.[0]?.[0] ?? '1') * 1.1
        addLog('info', `${label}: swapping ~${swapQuoteAmount.toFixed(4)} ${quoteSymbol} → ${baseSymbol} for repay`)
        try {
          const txS = new Transaction()
          const swapResult = makeSwapDb(addr, net).deepBook.swapExactQuoteForBase({ poolKey, amount: swapQuoteAmount, deepAmount: 0, minOut: 0 })(txS)
          txS.transferObjects([...swapResult], addr)
          const rS = await signAndExec(kp, txS, net) as any
          addLog('info', `${label}: swap tx: ${(rS?.digest ?? '').slice(0, 16)}…`)
        } catch (e) { addLog('warn', `${label}: swap failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
      }
      try {
        const freshBal = await walletBal(baseSymbol) - (baseSymbol === 'SUI' ? 0.15 : 0)
        const depositAmt = Math.min(needed, Math.max(freshBal, 0))
        if (depositAmt > 0) {
          const tx = new Transaction()
          db.marginManager.depositBase({ managerKey: 'main', amount: depositAmt })(tx)
          db.marginManager.repayBase('main')(tx)
          const r = await signAndExec(kp, tx, net) as any
          addLog('info', `${label}: deposit+repayBase tx: ${(r?.digest ?? '').slice(0, 16)}…`)
        }
      } catch (e) { addLog('warn', `${label}: repayBase failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
    }

    // Repay quote debt (with swap if needed)
    if (quoteDebt > 0) {
      const needed = quoteDebt * 1.02
      const available = await walletBal(quoteSymbol) - (quoteSymbol === 'SUI' ? 0.15 : 0)
      if (available < needed) {
        const deficit = needed - Math.max(available, 0)
        const midPrice = parseFloat(ob?.bids?.[0]?.[0] ?? '1')
        const swapBaseAmount = (deficit / midPrice) * 1.1
        addLog('info', `${label}: swapping ~${swapBaseAmount.toFixed(4)} ${baseSymbol} → ${quoteSymbol} for repay`)
        try {
          const txS = new Transaction()
          const swapResult = makeSwapDb(addr, net).deepBook.swapExactBaseForQuote({ poolKey, amount: swapBaseAmount, deepAmount: 0, minOut: 0 })(txS)
          txS.transferObjects([...swapResult], addr)
          const rS = await signAndExec(kp, txS, net) as any
          addLog('info', `${label}: swap tx: ${(rS?.digest ?? '').slice(0, 16)}…`)
        } catch (e) { addLog('warn', `${label}: swap failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
      }
      try {
        const freshBal = await walletBal(quoteSymbol) - (quoteSymbol === 'SUI' ? 0.15 : 0)
        const depositAmt = Math.min(needed, Math.max(freshBal, 0))
        if (depositAmt > 0) {
          const tx = new Transaction()
          db.marginManager.depositQuote({ managerKey: 'main', amount: depositAmt })(tx)
          db.marginManager.repayQuote('main')(tx)
          const r = await signAndExec(kp, tx, net) as any
          addLog('info', `${label}: deposit+repayQuote tx: ${(r?.digest ?? '').slice(0, 16)}…`)
        }
      } catch (e) { addLog('warn', `${label}: repayQuote failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
    }

    // Withdraw remaining
    try {
      const state = await db.getMarginManagerState('main')
      const hasBase = parseFloat(state.baseAsset) > 0
      const hasQuote = parseFloat(state.quoteAsset) > 0
      const hasDebt = parseFloat(state.baseDebt) > 0 || parseFloat(state.quoteDebt) > 0
      addLog('info', `${label}: post-repay state — base:${state.baseAsset} quote:${state.quoteAsset} bDebt:${state.baseDebt} qDebt:${state.quoteDebt}`)
      if (hasDebt) {
        addLog('warn', `${label}: residual debt remains — cannot withdraw yet`)
      } else if (hasBase || hasQuote) {
        const tx = new Transaction()
        const coins: any[] = []
        if (hasBase) coins.push(db.marginManager.withdrawBase('main', parseFloat(state.baseAsset) * 0.999)(tx))
        if (hasQuote) coins.push(db.marginManager.withdrawQuote('main', parseFloat(state.quoteAsset) * 0.999)(tx))
        if (coins.length) tx.transferObjects(coins, addr)
        const r = await signAndExec(kp, tx, net) as any
        addLog('success', `${label}: withdraw tx: ${(r?.digest ?? '').slice(0, 16)}…`)
      } else {
        addLog('info', `${label}: MM empty, nothing to withdraw`)
      }
    } catch (e) { addLog('warn', `${label}: withdraw failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`) }
    addLog('info', `${label}: margin cleanup done`)
  }
}
