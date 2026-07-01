// BTC Chart — automatic Entry / SL / TP calculation from indicator confluence.

import type { Candle, NWE, MLResult, TradeSetup } from './types'
import type { BoucherResult } from './boucher-scalping'
import type { LienResult } from './lien-reversal'
import type { NadarayaWatsonResult } from './nadaraya-watson'
import type { ICTResult } from './ict-sessions'
import type { LiquidityResult } from './liquidity'

export type { TradeSetup }

/** Extra signals from Boucher + Lien + Lux NWE + ICT + Liquidity for confluence. */
export interface TradeSetupExtra {
  boucher?: BoucherResult
  lien?: LienResult
  luxNwe?: NadarayaWatsonResult
  ict?: ICTResult
  liquidity?: LiquidityResult
}

/**
 * Compute a suggested trade setup based on confluence of:
 * ML signal, RSI, NWE zone, ADX trend strength,
 * Boucher M1 scalping signals, and Kathy Lien reversal signals.
 *
 * Returns null direction when no clear setup exists.
 */
export function calcTradeSetup(
  data: Candle[],
  nwe: NWE,
  rsi: (number | null)[],
  adx: { adx: (number | null)[] },
  ml: MLResult,
  extra?: TradeSetupExtra,
): TradeSetup {
  const i = data.length - 1
  const c = data[i]
  const price = c.close

  const rsiV = rsi[i]
  const adxV = adx.adx[i]
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]

  // Count bullish / bearish confluence signals
  let bull = 0
  let bear = 0
  const reasons: string[] = []

  // ML signal
  if (ml.score >= 0.65) {
    bull++
    reasons.push('ML Bullish')
  } else if (ml.score <= 0.35) {
    bear++
    reasons.push('ML Bearish')
  }

  // RSI
  if (rsiV != null && rsiV < 35) {
    bull++
    reasons.push(`RSI ${rsiV.toFixed(0)} (oversold)`)
  } else if (rsiV != null && rsiV > 65) {
    bear++
    reasons.push(`RSI ${rsiV.toFixed(0)} (overbought)`)
  }

  // NWE zone position
  if (nweLo != null && price <= nweLo * 1.005) {
    bull++
    reasons.push('Price at NWE lower')
  } else if (nweUp != null && price >= nweUp * 0.995) {
    bear++
    reasons.push('Price at NWE upper')
  }

  // ADX trend strength (confirms direction)
  if (adxV != null && adxV >= 25) {
    reasons.push(`ADX ${adxV.toFixed(0)} (trending)`)
  }

  // ── Boucher M1 Scalping signals ──
  if (extra?.boucher) {
    const b = extra.boucher
    const lastEntry = b.entries[b.entries.length - 1]
    // Recent entry signal (within last 3 bars)
    if (lastEntry && lastEntry.time >= data[Math.max(0, i - 3)].time) {
      if (lastEntry.dir === 'long') {
        bull++
        reasons.push('Boucher Buy')
      } else {
        bear++
        reasons.push('Boucher Sell')
      }
    }
    // Three-bar reversal (within last 3 bars)
    const last3b = b.threeBar[b.threeBar.length - 1]
    if (last3b && last3b.time >= data[Math.max(0, i - 3)].time) {
      if (last3b.dir === 'long') {
        bull++
        reasons.push('3-Bar Reversal+')
      } else {
        bear++
        reasons.push('3-Bar Reversal-')
      }
    }
    // Speed: fast box = momentum continuation
    if (b.speed === 'fast' && lastEntry) {
      if (lastEntry.dir === 'long') bull++
      else bear++
      reasons.push('Box Speed Fast')
    }
  }

  // ── Kathy Lien Reversal signals ──
  if (extra?.lien) {
    const l = extra.lien
    // Recent reversal signal (within last 5 bars)
    if (l.latestSignal) {
      if (l.latestSignal.type === 'bullish') {
        bull++
        reasons.push('Lien Bullish Rev')
      } else {
        bear++
        reasons.push('Lien Bearish Rev')
      }
      // High confidence reversal adds extra weight
      if (l.latestSignal.confidence >= 70) {
        if (l.latestSignal.type === 'bullish') bull++
        else bear++
        reasons.push('Lien High Conf')
      }
    }
    // Squeeze breakout
    if (l.squeeze.breakout === 'up') {
      bull++
      reasons.push('Squeeze Breakout+')
    } else if (l.squeeze.breakout === 'down') {
      bear++
      reasons.push('Squeeze Breakout-')
    }
    // Momentum exhaustion at band edge = reversal signal
    if (l.exhaustion && l.bandTouch === 'upper') {
      bear++
      reasons.push('Exhaustion at Top')
    } else if (l.exhaustion && l.bandTouch === 'lower') {
      bull++
      reasons.push('Exhaustion at Bottom')
    }
  }

  // ── Lux NWE (Nadaraya-Watson Envelope) signals ──
  if (extra?.luxNwe) {
    const lnwe = extra.luxNwe
    // Recent crossover signal (within last 3 bars)
    const recentSigs = lnwe.signals.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastSig = recentSigs[recentSigs.length - 1]
    if (lastSig) {
      if (lastSig.type === 'buy') {
        bull++
        reasons.push('NWE Cross Buy')
      } else {
        bear++
        reasons.push('NWE Cross Sell')
      }
    }
    // Band position: price near Lux NWE bands confirms reversal zone
    const luxUp = lnwe.upper[i]
    const luxLo = lnwe.lower[i]
    const luxMid = lnwe.mid[i]
    if (luxLo != null && price <= luxLo * 1.003) {
      bull++
      reasons.push('Price at Lux NWE lower')
    } else if (luxUp != null && price >= luxUp * 0.997) {
      bear++
      reasons.push('Price at Lux NWE upper')
    }
    // Trend bias: price relative to Lux NWE mid
    if (luxMid != null) {
      if (price > luxMid * 1.002) {
        reasons.push('Above Lux NWE mid (bullish bias)')
      } else if (price < luxMid * 0.998) {
        reasons.push('Below Lux NWE mid (bearish bias)')
      }
    }
  }

  // ── ICT Judas Swing + Killzone signals ──
  if (extra?.ict) {
    const ict = extra.ict
    // Recent Judas swing (within last 3 bars) — a stop-hunt reversal.
    const recentJudas = ict.judas.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastJudas = recentJudas[recentJudas.length - 1]
    if (lastJudas) {
      if (lastJudas.type === 'bullish') {
        bull++
        reasons.push('Judas Swing Long (sweep Asia low)')
        if (lastJudas.volConfirm) {
          bull++
          reasons.push('VOL confirms sweep')
        }
      } else {
        bear++
        reasons.push('Judas Swing Short (sweep Asia high)')
        if (lastJudas.volConfirm) {
          bear++
          reasons.push('VOL confirms sweep')
        }
      }
    }
    // Trading inside an active killzone raises conviction (no direction change).
    const activeKz = ict.killzones.find((k) => k.active)
    if (activeKz) {
      reasons.push(`In ${activeKz.name === 'london' ? 'London' : 'NY'} Killzone`)
    }
    // Overextended day: warn when >85% of ADR is spent (mean-reversion risk).
    if (ict.adrPct > 85) {
      reasons.push(`ADR ${ict.adrPct.toFixed(0)}% spent (extended)`)
    }
  }

  // ── ICT Liquidity: external sweeps + premium/discount + draw target ──
  if (extra?.liquidity) {
    const liq = extra.liquidity
    // A liquidity sweep of an external edge within the last ~3 bars is the
    // strongest smart-money entry signal — strongest when inside a killzone.
    const recentSweep = liq.sweeps.filter((s) => s.index >= Math.max(0, i - 3) && s.index <= i)
    const lastSweep = recentSweep[recentSweep.length - 1]
    if (lastSweep) {
      if (lastSweep.type === 'bullish') {
        bull++
        reasons.push('Liquidity Sweep Long (external low)')
        if (lastSweep.inKillzone) {
          bull++
          reasons.push('Sweep in London/NY Killzone')
        }
      } else {
        bear++
        reasons.push('Liquidity Sweep Short (external high)')
        if (lastSweep.inKillzone) {
          bear++
          reasons.push('Sweep in London/NY Killzone')
        }
      }
    }
    // Premium/discount bias: buying discount, selling premium (ICT rule).
    if (liq.range) {
      const price = c.close
      const hasBullFvg = liq.levels.some((l) => l.kind === 'fvg' && l.price > price)
      const hasBearFvg = liq.levels.some((l) => l.kind === 'fvg' && l.price < price)
      if (price < liq.range.equilibrium && hasBullFvg) {
        bull++
        reasons.push('Discount + bullish FVG target')
      } else if (price > liq.range.equilibrium && hasBearFvg) {
        bear++
        reasons.push('Premium + bearish FVG target')
      }
    }
    // Directional draw (context, no vote): where liquidity is being pulled.
    if (liq.nextTarget) {
      reasons.push(`Draw → ${liq.nextTarget.label}`)
    }
  }

  // Swing high/low for SL (last 20 bars)
  const lookback = data.slice(Math.max(0, i - 20), i + 1)
  const swingLow = Math.min(...lookback.map((d) => d.low))
  const swingHigh = Math.max(...lookback.map((d) => d.high))

  // Volume confirmation: current bar vs 20-bar average
  let volSum = 0
  const volPeriod = Math.min(20, i)
  for (let j = i - volPeriod; j < i; j++) volSum += data[j].volume
  const volAvg = volPeriod > 0 ? volSum / volPeriod : 1
  const volRatio = volAvg > 0 ? c.volume / volAvg : 1

  // Determine direction: need at least 2 confluence signals
  let dir: 'long' | 'short' | null = null
  if (bull >= 2 && bull > bear) dir = 'long'
  else if (bear >= 2 && bear > bull) dir = 'short'

  const confidence = Math.min(100, Math.max(bull, bear) * 20 + Math.abs(bull - bear) * 10)

  if (dir === 'long') {
    const entry = price
    const luxLo = extra?.luxNwe?.lower[i]
    const luxUp = extra?.luxNwe?.upper[i]
    const sl = Math.min(swingLow, nweLo ?? swingLow, luxLo ?? swingLow) * 0.998
    const risk = entry - sl
    const bestUp = luxUp != null && nweUp != null ? Math.max(luxUp, nweUp) : (luxUp ?? nweUp)
    const tp1 = entry + risk * 2
    const tp2 = bestUp != null ? Math.max(bestUp, entry + risk * 3) : entry + risk * 3
    const rr = risk > 0 ? (tp1 - entry) / risk : 2
    return { dir, entry, sl, tp1, tp2, rr, confidence, reasons, volRatio }
  }
  if (dir === 'short') {
    const entry = price
    const luxUp = extra?.luxNwe?.upper[i]
    const luxLo = extra?.luxNwe?.lower[i]
    const sl = Math.max(swingHigh, nweUp ?? swingHigh, luxUp ?? swingHigh) * 1.002
    const risk = sl - entry
    const bestLo = luxLo != null && nweLo != null ? Math.min(luxLo, nweLo) : (luxLo ?? nweLo)
    const tp1 = entry - risk * 2
    const tp2 = bestLo != null ? Math.min(bestLo, entry - risk * 3) : entry - risk * 3
    const rr = risk > 0 ? (entry - tp1) / risk : 2
    return { dir, entry, sl, tp1, tp2, rr, confidence, reasons, volRatio }
  }

  // No setup
  return {
    dir: null,
    entry: price,
    sl: price,
    tp1: price,
    tp2: price,
    rr: 0,
    confidence: 0,
    reasons: ['No confluence'],
    volRatio,
  }
}

/** Compute SL/TP suggestions for an existing position based on NWE + ATR. */
export function suggestSlTp(
  pos: { side: 'long' | 'short'; entryPrice: number },
  data: Candle[],
  nwe: NWE,
): { sl: number; tp1: number; tp2: number } {
  const i = data.length - 1
  const nweUp = nwe.upper[i]
  const nweLo = nwe.lower[i]

  // ATR(14) for volatility-based stops
  let atrSum = 0
  const period = Math.min(14, data.length - 1)
  for (let j = data.length - period; j < data.length; j++) {
    const tr = Math.max(
      data[j].high - data[j].low,
      Math.abs(data[j].high - data[j - 1].close),
      Math.abs(data[j].low - data[j - 1].close),
    )
    atrSum += tr
  }
  const atr = atrSum / period

  if (pos.side === 'long') {
    const atrSl = pos.entryPrice - atr * 1.5
    // SL must be below entry: pick the higher of ATR-SL and NWE lower, but cap at entry
    const sl = nweLo != null && nweLo < pos.entryPrice ? Math.max(atrSl, nweLo) : atrSl
    const risk = pos.entryPrice - sl
    const tp1 = pos.entryPrice + risk * 2
    const tp2 = nweUp != null && nweUp > pos.entryPrice ? nweUp : pos.entryPrice + risk * 3
    return { sl, tp1, tp2 }
  }
  // short: SL must be above entry
  const atrSl = pos.entryPrice + atr * 1.5
  const sl = nweUp != null && nweUp > pos.entryPrice ? Math.min(atrSl, nweUp) : atrSl
  const risk = sl - pos.entryPrice
  const tp1 = pos.entryPrice - risk * 2
  const tp2 = nweLo != null && nweLo < pos.entryPrice ? nweLo : pos.entryPrice - risk * 3
  return { sl, tp1, tp2 }
}
