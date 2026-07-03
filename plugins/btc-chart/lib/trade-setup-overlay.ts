// BTC Chart — TradingView-style trade setup canvas overlay (risk/reward zones).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { fmtP } from './format'
import type { TradeSetup } from './types'

/** Default width reserved for the right price scale (matches --btc-price-scale-w). */
const PRICE_SCALE_W = 54

/** Width of right-anchored risk/reward rectangles. */
const BOX_W = 76

const COLORS = {
  riskFill: 'rgba(242, 54, 69, 0.2)',
  riskStroke: 'rgba(242, 54, 69, 0.65)',
  rewardFill: 'rgba(49, 121, 245, 0.2)',
  rewardStroke: 'rgba(49, 121, 245, 0.65)',
  entryLong: 'rgba(8, 153, 129, 0.9)',
  entryShort: 'rgba(242, 54, 69, 0.9)',
  sl: 'rgba(242, 54, 69, 0.85)',
  tp: 'rgba(49, 121, 245, 0.75)',
  badgeLong: 'rgba(242, 54, 69, 0.9)',
  badgeShort: 'rgba(49, 121, 245, 0.9)',
  labelBg: 'rgba(15, 17, 23, 0.82)',
  labelText: '#e8eaed',
} as const

/**
 * Returns true when the setup is a valid LONG with ordered price levels.
 * Required order: sl < entry < tp1 <= tp2.
 */
export function isDrawableLongSetup(setup: TradeSetup): boolean {
  if (setup.dir !== 'long') return false
  const { sl, entry, tp1, tp2 } = setup
  if (![sl, entry, tp1, tp2].every((p) => Number.isFinite(p) && p > 0)) return false
  return sl < entry && entry < tp1 && tp1 <= tp2
}

/**
 * Returns true when the setup is a valid SHORT with ordered price levels.
 * Required order: tp2 <= tp1 < entry < sl.
 */
export function isDrawableShortSetup(setup: TradeSetup): boolean {
  if (setup.dir !== 'short') return false
  const { sl, entry, tp1, tp2 } = setup
  if (![sl, entry, tp1, tp2].every((p) => Number.isFinite(p) && p > 0)) return false
  return tp2 <= tp1 && tp1 < entry && entry < sl
}

/** True when the setup can be painted on chart (LONG or SHORT). */
export function isDrawableTradeSetup(setup: TradeSetup): boolean {
  return isDrawableLongSetup(setup) || isDrawableShortSetup(setup)
}

function readPriceScaleWidth(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue('--btc-price-scale-w').trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : PRICE_SCALE_W
}

function drawHLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x0: number,
  x1: number,
  color: string,
  dashed: boolean,
) {
  if (!Number.isFinite(y)) return
  ctx.strokeStyle = color
  ctx.lineWidth = dashed ? 1 : 1.5
  ctx.setLineDash(dashed ? [6, 4] : [])
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawPriceTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  price: number,
  accent: string,
) {
  if (!Number.isFinite(y)) return
  const text = `${label} ${fmtP(price)}`
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
  const padX = 5
  const padY = 3
  const tw = ctx.measureText(text).width
  const th = 12
  const bx = x + 4
  const by = y - th / 2 - padY

  ctx.fillStyle = COLORS.labelBg
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(bx, by, tw + padX * 2, th + padY * 2, 3)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = COLORS.labelText
  ctx.fillText(text, bx + padX, by + th + padY - 2)
}

function drawZoneBox(
  ctx: CanvasRenderingContext2D,
  boxLeft: number,
  yA: number,
  yB: number,
  fill: string,
  stroke: string,
) {
  const top = Math.min(yA, yB)
  const h = Math.abs(yA - yB)
  if (h < 1) return
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.fillRect(boxLeft, top, BOX_W, h)
  ctx.strokeRect(boxLeft, top, BOX_W, h)
  return top
}

/**
 * Paint right-anchored risk/reward rectangles plus full-width horizontal guides.
 * LONG: risk below entry (SL→Entry), reward above (Entry→TP2).
 * SHORT: reward below entry (TP2→Entry), risk above (Entry→SL).
 */
export function drawTradeSetupOverlay(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  _chart: any,
  series: any,
  setup: TradeSetup,
  visible: boolean,
) {
  const rect = mainEl.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  canvas.style.top = '0'
  canvas.style.left = '0'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const isLong = isDrawableLongSetup(setup)
  const isShort = isDrawableShortSetup(setup)
  if (!visible || (!isLong && !isShort)) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }

  const toY = (price: number) => {
    const y = series.priceToCoordinate(price)
    return typeof y === 'number' ? y : null
  }

  const { sl, entry, tp1, tp2 } = setup
  const ySl = toY(sl)
  const yEntry = toY(entry)
  const yTp1 = toY(tp1)
  const yTp2 = toY(tp2)
  if (ySl == null || yEntry == null || yTp1 == null || yTp2 == null) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }

  const scaleW = readPriceScaleWidth(mainEl)
  const plotRight = Math.max(0, rect.width - scaleW)
  const boxLeft = Math.max(0, plotRight - BOX_W)
  const lineRight = plotRight

  const entryColor = isLong ? COLORS.entryLong : COLORS.entryShort
  const badgeLabel = isLong ? 'LONG' : 'SHORT'
  const badgeColor = isLong ? COLORS.badgeLong : COLORS.badgeShort

  let riskTop: number
  let rewardTop: number
  let rewardH: number

  if (isLong) {
    riskTop = drawZoneBox(ctx, boxLeft, ySl, yEntry, COLORS.riskFill, COLORS.riskStroke) ?? 0
    rewardTop = drawZoneBox(ctx, boxLeft, yEntry, yTp2, COLORS.rewardFill, COLORS.rewardStroke) ?? 0
    rewardH = Math.abs(yEntry - yTp2)
  } else {
    rewardTop = drawZoneBox(ctx, boxLeft, yTp2, yEntry, COLORS.rewardFill, COLORS.rewardStroke) ?? 0
    riskTop = drawZoneBox(ctx, boxLeft, yEntry, ySl, COLORS.riskFill, COLORS.riskStroke) ?? 0
    rewardH = Math.abs(yTp2 - yEntry)
  }

  if (yTp1 > rewardTop && yTp1 < rewardTop + rewardH) {
    ctx.strokeStyle = COLORS.tp
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(boxLeft, yTp1)
    ctx.lineTo(boxLeft + BOX_W, yTp1)
    ctx.stroke()
    ctx.setLineDash([])
  }

  drawHLine(ctx, yEntry, 0, lineRight, entryColor, false)
  drawHLine(ctx, ySl, 0, lineRight, COLORS.sl, true)
  drawHLine(ctx, yTp1, 0, lineRight, COLORS.tp, true)
  drawHLine(ctx, yTp2, 0, lineRight, COLORS.tp, true)

  drawPriceTag(ctx, boxLeft + BOX_W, yEntry, 'Entry', entry, entryColor)
  drawPriceTag(ctx, boxLeft + BOX_W, ySl, 'SL', sl, COLORS.sl)
  drawPriceTag(ctx, boxLeft + BOX_W, yTp1, 'TP1', tp1, COLORS.tp)
  drawPriceTag(ctx, boxLeft + BOX_W, yTp2, 'TP2', tp2, COLORS.tp)

  ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = badgeColor
  ctx.fillText(badgeLabel, boxLeft + 6, riskTop + 12)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
