// BTC Chart — TradingView-style trade setup canvas overlay (risk/reward zones).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { fmtP } from './format'
import type { Candle, TradeSetup } from './types'

/** Default width reserved for the right price scale (matches --btc-price-scale-w). */
const PRICE_SCALE_W = 54

/** Width of risk/reward rectangles beside the last candle. */
const BOX_W = 76

/** Gap between the last candle body and the overlay column. */
const CANDLE_GAP = 10

/** Short tick length at the nearest cutting candle (does not reach overlay). */
export const LEVEL_TICK_LEN = 40

/** Minimum gap between level tick end and overlay column. */
export const OVERLAY_LINE_GAP = 14

/** Minimum total overlay height before switching to expanded compressed layout. */
export const MIN_SETUP_TOTAL_PX = 96

/** Minimum height for each risk/reward zone when compressed. */
export const MIN_ZONE_PX = 22

/** Minimum vertical gap between stacked price tags (px). */
export const MIN_TAG_GAP_PX = 16

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
 * Required order: sl < entry < tp1 <= tp2 <= tp3.
 */
export function isDrawableLongSetup(setup: TradeSetup): boolean {
  if (setup.dir !== 'long') return false
  const { sl, entry, tp1, tp2, tp3 } = setup
  if (![sl, entry, tp1, tp2, tp3].every((p) => Number.isFinite(p) && p > 0)) return false
  return sl < entry && entry < tp1 && tp1 <= tp2 && tp2 <= tp3
}

/**
 * Returns true when the setup is a valid SHORT with ordered price levels.
 * Required order: tp3 <= tp2 <= tp1 < entry < sl.
 */
export function isDrawableShortSetup(setup: TradeSetup): boolean {
  if (setup.dir !== 'short') return false
  const { sl, entry, tp1, tp2, tp3 } = setup
  if (![sl, entry, tp1, tp2, tp3].every((p) => Number.isFinite(p) && p > 0)) return false
  return tp3 <= tp2 && tp2 <= tp1 && tp1 < entry && entry < sl
}

/** True when the setup can be painted on chart (LONG or SHORT). */
export function isDrawableTradeSetup(setup: TradeSetup): boolean {
  return isDrawableLongSetup(setup) || isDrawableShortSetup(setup)
}

/** Pixel layout for risk/reward zones (may expand when price scale compresses levels). */
export interface SetupZoneLayout {
  readonly riskTop: number
  readonly riskH: number
  readonly rewardTop: number
  readonly rewardH: number
  readonly compressed: boolean
  readonly entryY: number
  readonly slY: number
  readonly tp1Y: number
  readonly tp2Y: number
  readonly tp3Y: number
}

/**
 * Index of the most recent candle whose range contains `price`, scanning backward.
 * Returns -1 when no candle intersects the level.
 */
export function findNearestCuttingCandleIndex(candles: Candle[], price: number): number {
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i]
    if (c.low <= price && c.high >= price) return i
  }
  return -1
}

export function resolveSetupBoxLeft(
  lastCandleX: number,
  barSpacing: number,
  plotRight: number,
  boxW = BOX_W,
): number {
  const candleHalfW = Math.max(4, barSpacing * 0.45)
  const anchorLeft = lastCandleX + candleHalfW + CANDLE_GAP
  const maxLeft = Math.max(0, plotRight - boxW)
  return Math.min(Math.max(8, anchorLeft), maxLeft)
}

/**
 * Follow the last candle when it is on-screen; otherwise dock beside the plot edge.
 * Prevents the overlay from collapsing when panning away from the live bar.
 */
export function resolveSetupBoxLeftForViewport(
  lastCandleX: number | null,
  barSpacing: number,
  plotRight: number,
  boxW = BOX_W,
): number {
  const maxLeft = Math.max(0, plotRight - boxW)
  if (lastCandleX == null) return maxLeft
  const candleHalfW = Math.max(4, barSpacing * 0.45)
  const onScreen = lastCandleX + candleHalfW >= 0 && lastCandleX <= plotRight + candleHalfW
  if (!onScreen) return maxLeft
  return resolveSetupBoxLeft(lastCandleX, barSpacing, plotRight, boxW)
}

/**
 * Build zone rectangles from price Y coordinates, expanding when pan/zoom compresses them.
 */
export function layoutSetupZones(
  ySl: number,
  yEntry: number,
  yTp1: number,
  yTp2: number,
  yTp3: number,
  prices: { sl: number; entry: number; tp1: number; tp2: number; tp3: number },
  isLong: boolean,
): SetupZoneLayout {
  const naturalRiskH = isLong ? Math.abs(ySl - yEntry) : Math.abs(yEntry - ySl)
  const naturalRewardH = isLong ? Math.abs(yEntry - yTp3) : Math.abs(yTp3 - yEntry)
  const naturalTotal = naturalRiskH + naturalRewardH

  if (naturalTotal >= MIN_SETUP_TOTAL_PX) {
    if (isLong) {
      return {
        riskTop: Math.min(ySl, yEntry),
        riskH: naturalRiskH,
        rewardTop: Math.min(yEntry, yTp3),
        rewardH: naturalRewardH,
        compressed: false,
        entryY: yEntry,
        slY: ySl,
        tp1Y: yTp1,
        tp2Y: yTp2,
        tp3Y: yTp3,
      }
    }
    return {
      riskTop: Math.min(yEntry, ySl),
      riskH: naturalRiskH,
      rewardTop: Math.min(yTp3, yEntry),
      rewardH: naturalRewardH,
      compressed: false,
      entryY: yEntry,
      slY: ySl,
      tp1Y: yTp1,
      tp2Y: yTp2,
      tp3Y: yTp3,
    }
  }

  const riskShare = isLong ? Math.abs(prices.entry - prices.sl) : Math.abs(prices.sl - prices.entry)
  const rewardShare = isLong
    ? Math.abs(prices.tp3 - prices.entry)
    : Math.abs(prices.entry - prices.tp3)
  const totalShare = riskShare + rewardShare || 1
  const riskH = Math.max(MIN_ZONE_PX, (riskShare / totalShare) * MIN_SETUP_TOTAL_PX)
  const rewardH = Math.max(MIN_ZONE_PX, MIN_SETUP_TOTAL_PX - riskH)

  if (isLong) {
    return {
      riskTop: yEntry,
      riskH,
      rewardTop: yEntry - rewardH,
      rewardH,
      compressed: true,
      entryY: yEntry,
      slY: yEntry + riskH * 0.82,
      tp1Y: yEntry - rewardH * 0.3,
      tp2Y: yEntry - rewardH * 0.6,
      tp3Y: yEntry - rewardH * 0.92,
    }
  }
  return {
    rewardTop: yEntry,
    rewardH,
    riskTop: yEntry - riskH,
    riskH,
    compressed: true,
    entryY: yEntry,
    slY: yEntry - riskH * 0.82,
    tp1Y: yEntry + rewardH * 0.3,
    tp2Y: yEntry + rewardH * 0.6,
    tp3Y: yEntry + rewardH * 0.92,
  }
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

/**
 * Push tag Y coordinates apart when multiple levels share the same pixel row.
 * Ticks stay on true prices; only labels are staggered.
 */
export function staggerLevelTagYs(
  levels: readonly { id: string; y: number }[],
  minGap = MIN_TAG_GAP_PX,
): Map<string, number> {
  const sorted = [...levels].sort((a, b) => a.y - b.y)
  const out = new Map<string, number>()
  let prev = -Infinity
  for (const lvl of sorted) {
    let tagY = lvl.y
    if (tagY - prev < minGap) tagY = prev + minGap
    out.set(lvl.id, tagY)
    prev = tagY
  }
  return out
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

function drawZoneRect(
  ctx: CanvasRenderingContext2D,
  boxLeft: number,
  top: number,
  h: number,
  fill: string,
  stroke: string,
) {
  if (h < 1) return
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.fillRect(boxLeft, top, BOX_W, h)
  ctx.strokeRect(boxLeft, top, BOX_W, h)
  return top
}

/**
 * Short tick immediately left of the overlay column (fixed width, never spans the chart).
 */
export function resolveOverlayAdjacentTickSpan(
  boxLeft: number,
  tickLen = LEVEL_TICK_LEN,
  gap = OVERLAY_LINE_GAP,
): { x0: number; x1: number } | null {
  const x1 = boxLeft - gap
  if (!Number.isFinite(x1) || x1 <= 0) return null
  const x0 = Math.max(0, x1 - tickLen)
  if (x1 - x0 < 4) return null
  return { x0, x1 }
}

function drawLevelTick(
  ctx: CanvasRenderingContext2D,
  y: number | null,
  boxLeft: number,
  color: string,
  dashed: boolean,
) {
  if (y == null) return
  const span = resolveOverlayAdjacentTickSpan(boxLeft)
  if (!span) return
  drawHLine(ctx, y, span.x0, span.x1, color, dashed)
}

function resolveLastCandleX(chart: any, candles: Candle[]): number | null {
  if (!candles.length) return null
  const timeScale = chart?.timeScale?.()
  if (!timeScale) return null
  const last = candles[candles.length - 1]
  const x = timeScale.timeToCoordinate(last.time)
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/**
 * Paint risk/reward rectangles beside the last candle plus short level ticks
 * hugging the overlay column (no chart-spanning guides).
 * LONG: risk below entry (SL→Entry), reward above (Entry→TP3).
 * SHORT: reward below entry (TP3→Entry), risk above (Entry→SL).
 */
export function drawTradeSetupOverlay(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  chart: any,
  series: any,
  candles: Candle[],
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

  const { sl, entry, tp1, tp2, tp3 } = setup
  const ySl = toY(sl)
  const yEntry = toY(entry)
  const yTp1 = toY(tp1)
  const yTp2 = toY(tp2)
  const yTp3 = toY(tp3)
  if (ySl == null || yEntry == null || yTp1 == null || yTp2 == null || yTp3 == null) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }

  const scaleW = readPriceScaleWidth(mainEl)
  const plotRight = Math.max(0, rect.width - scaleW)
  const lastX = resolveLastCandleX(chart, candles)
  const barSpacing =
    typeof chart?.timeScale?.()?.barSpacing === 'function' ? chart.timeScale().barSpacing() : 8
  const boxLeft = resolveSetupBoxLeftForViewport(lastX, barSpacing, plotRight)
  const layout = layoutSetupZones(
    ySl,
    yEntry,
    yTp1,
    yTp2,
    yTp3,
    { sl, entry, tp1, tp2, tp3 },
    isLong,
  )
  const entryColor = isLong ? COLORS.entryLong : COLORS.entryShort
  const badgeLabel = isLong ? 'LONG' : 'SHORT'
  const badgeColor = isLong ? COLORS.badgeLong : COLORS.badgeShort

  const riskTop =
    drawZoneRect(ctx, boxLeft, layout.riskTop, layout.riskH, COLORS.riskFill, COLORS.riskStroke) ??
    layout.riskTop

  drawZoneRect(
    ctx,
    boxLeft,
    layout.rewardTop,
    layout.rewardH,
    COLORS.rewardFill,
    COLORS.rewardStroke,
  )

  const drawRewardDivider = (y: number) => {
    const inReward = y > layout.rewardTop && y < layout.rewardTop + layout.rewardH
    if (!inReward) return
    ctx.strokeStyle = COLORS.tp
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(boxLeft, y)
    ctx.lineTo(boxLeft + BOX_W, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  drawRewardDivider(layout.tp1Y)
  drawRewardDivider(layout.tp2Y)

  drawLevelTick(ctx, layout.entryY, boxLeft, entryColor, false)
  drawLevelTick(ctx, layout.slY, boxLeft, COLORS.sl, true)
  drawLevelTick(ctx, layout.tp1Y, boxLeft, COLORS.tp, true)
  drawLevelTick(ctx, layout.tp2Y, boxLeft, COLORS.tp, true)
  drawLevelTick(ctx, layout.tp3Y, boxLeft, COLORS.tp, true)

  const tagAnchor = boxLeft + 4
  const tagYs = staggerLevelTagYs([
    { id: 'sl', y: layout.slY },
    { id: 'entry', y: layout.entryY },
    { id: 'tp1', y: layout.tp1Y },
    { id: 'tp2', y: layout.tp2Y },
    { id: 'tp3', y: layout.tp3Y },
  ])
  drawPriceTag(ctx, tagAnchor, tagYs.get('entry') ?? layout.entryY, 'Entry', entry, entryColor)
  drawPriceTag(ctx, tagAnchor, tagYs.get('sl') ?? layout.slY, 'SL', sl, COLORS.sl)
  drawPriceTag(ctx, tagAnchor, tagYs.get('tp1') ?? layout.tp1Y, 'TP1', tp1, COLORS.tp)
  drawPriceTag(ctx, tagAnchor, tagYs.get('tp2') ?? layout.tp2Y, 'TP2', tp2, COLORS.tp)
  drawPriceTag(ctx, tagAnchor, tagYs.get('tp3') ?? layout.tp3Y, 'TP3', tp3, COLORS.tp)

  ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = badgeColor
  ctx.fillText(badgeLabel, boxLeft + 6, riskTop + 12)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
