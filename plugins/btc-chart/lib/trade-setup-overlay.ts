// BTC Chart — TradingView-style LONG trade setup canvas overlay (risk/reward zones).
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
  entry: 'rgba(8, 153, 129, 0.9)',
  sl: 'rgba(242, 54, 69, 0.85)',
  tp: 'rgba(49, 121, 245, 0.75)',
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

/**
 * Paint right-anchored risk (SL→Entry) and reward (Entry→TP2) rectangles plus
 * full-width horizontal guides for a LONG trade setup.
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

  if (!visible || !isDrawableLongSetup(setup)) {
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

  // Risk zone: SL (bottom) → Entry (top)
  const riskTop = Math.min(ySl, yEntry)
  const riskH = Math.abs(ySl - yEntry)
  if (riskH >= 1) {
    ctx.fillStyle = COLORS.riskFill
    ctx.strokeStyle = COLORS.riskStroke
    ctx.lineWidth = 1
    ctx.fillRect(boxLeft, riskTop, BOX_W, riskH)
    ctx.strokeRect(boxLeft, riskTop, BOX_W, riskH)
  }

  // Reward zone: Entry (bottom) → TP2 (top)
  const rewardTop = Math.min(yEntry, yTp2)
  const rewardH = Math.abs(yEntry - yTp2)
  if (rewardH >= 1) {
    ctx.fillStyle = COLORS.rewardFill
    ctx.strokeStyle = COLORS.rewardStroke
    ctx.lineWidth = 1
    ctx.fillRect(boxLeft, rewardTop, BOX_W, rewardH)
    ctx.strokeRect(boxLeft, rewardTop, BOX_W, rewardH)
  }

  // TP1 divider inside reward box
  if (yTp1 != null && yTp1 > rewardTop && yTp1 < rewardTop + rewardH) {
    ctx.strokeStyle = COLORS.tp
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(boxLeft, yTp1)
    ctx.lineTo(boxLeft + BOX_W, yTp1)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Full-width horizontal guides
  drawHLine(ctx, yEntry, 0, lineRight, COLORS.entry, false)
  drawHLine(ctx, ySl, 0, lineRight, COLORS.sl, true)
  drawHLine(ctx, yTp1, 0, lineRight, COLORS.tp, true)
  drawHLine(ctx, yTp2, 0, lineRight, COLORS.tp, true)

  // Price tags beside rectangles
  drawPriceTag(ctx, boxLeft + BOX_W, yEntry, 'Entry', entry, COLORS.entry)
  drawPriceTag(ctx, boxLeft + BOX_W, ySl, 'SL', sl, COLORS.sl)
  drawPriceTag(ctx, boxLeft + BOX_W, yTp1, 'TP1', tp1, COLORS.tp)
  drawPriceTag(ctx, boxLeft + BOX_W, yTp2, 'TP2', tp2, COLORS.tp)

  // LONG badge on risk box
  ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = 'rgba(242, 54, 69, 0.9)'
  ctx.fillText('LONG', boxLeft + 6, riskTop + 12)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
