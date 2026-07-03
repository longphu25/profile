// BTC Chart — canvas overlay painters for SMC and Box-Flip structures.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BoxFlipResult } from '../box-flip'
import type { SMCResult } from '../smc-wasm'
import { fmtP } from './format'
import type { Candle } from './types'
import type { ICTResult, SessionName } from './ict-sessions'
import type { LiquidityResult } from './liquidity'
import type { SupplyDemandResult } from './supply-demand'

export function drawSMCOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  smc: SMCResult,
  show: boolean,
) {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!show) return

  ctx.scale(dpr, dpr)
  const ts = chart.timeScale()

  const toX = (time: number) => {
    const coord = ts.timeToCoordinate(time)
    return coord ?? -1
  }
  const toY = (price: number) => {
    const coord = series.priceToCoordinate(price)
    return coord ?? -1
  }

  // FVG boxes (Fair Value Gap)
  for (const fvg of smc.fvgs) {
    if (fvg.top === fvg.bottom) continue
    const x = toX(fvg.time)
    const y1 = toY(fvg.top)
    const y2 = toY(fvg.bottom)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    const isBull = fvg.bias === 'bull'
    ctx.fillStyle = isBull ? 'rgba(0,255,104,0.12)' : 'rgba(255,0,8,0.12)'
    ctx.strokeStyle = isBull ? 'rgba(0,255,104,0.45)' : 'rgba(255,0,8,0.45)'
    ctx.lineWidth = 1
    const boxW = Math.max(w - x, 60)
    const top = Math.min(y1, y2)
    const height = Math.abs(y2 - y1)
    ctx.fillRect(x, top, boxW, height)
    ctx.strokeRect(x, top, boxW, height)
    if (height >= 6) {
      ctx.font = '8px monospace'
      ctx.fillStyle = isBull ? '#089981' : '#F23645'
      ctx.fillText(isBull ? 'FVG+' : 'FVG-', x + 3, top + 10)
    }
  }

  // Order blocks
  for (const ob of smc.orderBlocks) {
    const x = toX(ob.startTime)
    const y1 = toY(ob.high)
    const y2 = toY(ob.low)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    ctx.fillStyle = ob.bias === 'bull' ? 'rgba(49,121,245,0.12)' : 'rgba(247,124,128,0.12)'
    ctx.strokeStyle = ob.bias === 'bull' ? 'rgba(49,121,245,0.5)' : 'rgba(247,124,128,0.5)'
    ctx.lineWidth = 1
    const boxW = Math.max(w - x, 40)
    ctx.fillRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
    ctx.strokeRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
  }

  // Structure lines (BOS/CHoCH)
  for (const s of smc.structures) {
    const x1 = toX(s.time)
    const x2 = toX(s.endTime)
    const y = toY(s.price)
    if (x1 < 0 || x2 < 0 || y < 0) continue
    ctx.strokeStyle = s.bias === 'bull' ? '#089981' : '#F23645'
    ctx.lineWidth = s.type === 'CHoCH' ? 2 : 1
    ctx.setLineDash(s.type === 'CHoCH' ? [] : [4, 3])
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
    ctx.setLineDash([])
    // Label
    ctx.font = '9px monospace'
    ctx.fillStyle = s.bias === 'bull' ? '#089981' : '#F23645'
    ctx.fillText(s.type, (x1 + x2) / 2 - 10, y - 4)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/**
 * Supply & Demand zones on the SMC canvas (demand = teal, supply = rose).
 * Call after {@link drawSMCOverlay} on the same context without clearing.
 */
export function drawSupplyDemandOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  sd: SupplyDemandResult,
  show: boolean,
  clearFirst = false,
) {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  if (clearFirst) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx0 = canvas.getContext('2d')!
    ctx0.clearRect(0, 0, canvas.width, canvas.height)
    if (!show) return
  } else if (!show || !sd.zones.length) {
    return
  }

  const ctx = canvas.getContext('2d')!
  if (!clearFirst) {
    ctx.save()
    ctx.scale(dpr, dpr)
  } else {
    ctx.scale(dpr, dpr)
  }

  const ts = chart.timeScale()
  const toX = (time: number) => {
    const coord = ts.timeToCoordinate(time)
    return coord ?? -1
  }
  const toY = (price: number) => {
    const coord = series.priceToCoordinate(price)
    return coord ?? -1
  }

  const mtfConfirmed = sd.mtfLong?.confirmed === true || sd.mtfShort?.confirmed === true

  for (const z of sd.zones) {
    if (!z.active) continue
    const x = toX(z.startTime)
    const y1 = toY(z.top)
    const y2 = toY(z.bottom)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    const isDemand = z.kind === 'demand'
    const isHtf = z.timeframe === 'htf'
    const htfConfirmed =
      (sd.mtfLong?.confirmed && sd.mtfLong.htfZone === z) ||
      (sd.mtfShort?.confirmed && sd.mtfShort.htfZone === z)
    ctx.fillStyle = isDemand
      ? isHtf
        ? 'rgba(52,216,164,0.06)'
        : 'rgba(52,216,164,0.1)'
      : isHtf
        ? 'rgba(255,122,133,0.06)'
        : 'rgba(255,122,133,0.1)'
    ctx.strokeStyle = htfConfirmed
      ? isDemand
        ? 'rgba(52,216,164,0.95)'
        : 'rgba(255,122,133,0.95)'
      : isDemand
        ? isHtf
          ? 'rgba(52,216,164,0.45)'
          : 'rgba(52,216,164,0.55)'
        : isHtf
          ? 'rgba(255,122,133,0.45)'
          : 'rgba(255,122,133,0.55)'
    ctx.lineWidth = htfConfirmed ? 2 : z.tested ? 1 : 1.5
    const boxW = Math.max(w - x, 48)
    const top = Math.min(y1, y2)
    const boxH = Math.abs(y2 - y1)
    if (isHtf) ctx.setLineDash([6, 4])
    ctx.fillRect(x, top, boxW, boxH)
    ctx.strokeRect(x, top, boxW, boxH)
    ctx.setLineDash([])

    const yMid = toY(z.mid)
    if (yMid >= 0) {
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = isDemand ? 'rgba(52,216,164,0.35)' : 'rgba(255,122,133,0.35)'
      ctx.beginPath()
      ctx.moveTo(x, yMid)
      ctx.lineTo(x + boxW, yMid)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.font = '9px monospace'
    ctx.fillStyle = isDemand ? 'rgba(52,216,164,0.9)' : 'rgba(255,122,133,0.9)'
    const side = isDemand ? 'DEM' : 'SUP'
    const tf = isHtf ? `HTF${z.intervalLabel ? ` ${z.intervalLabel}` : ''}` : 'LTF'
    ctx.fillText(`${tf} ${side} ${fmtP(z.bottom)}-${fmtP(z.top)}`, x + 4, top + 12)
  }

  for (const g of sd.grabs.slice(0, 6)) {
    const x = toX(g.time)
    const y = toY(g.level)
    if (x < 0 || y < 0) continue
    const color = g.type === 'bullish' ? '#34d8a4' : '#ff7a85'
    ctx.fillStyle = color
    ctx.font = 'bold 8px monospace'
    const isMtfGrab =
      mtfConfirmed &&
      g.zone.timeframe === 'ltf' &&
      (sd.mtfLong?.ltfGrab === g || sd.mtfShort?.ltfGrab === g)
    const tag = isMtfGrab ? 'MTF' : 'GRAB'
    const tw = ctx.measureText(tag).width
    ctx.fillText(tag, x - tw / 2, g.type === 'bullish' ? y + 14 : y - 6)
  }

  if (!clearFirst) {
    ctx.restore()
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}

/** Paint SMC and/or Supply & Demand on the shared SMC canvas. */
export function drawSmcStackOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  smc: SMCResult,
  sd: SupplyDemandResult,
  showSmc: boolean,
  showSd: boolean,
) {
  if (!showSmc && !showSd) {
    drawSMCOverlay(canvas, container, chart, series, smc, false)
    return
  }
  if (showSmc && showSd) {
    drawSMCOverlay(canvas, container, chart, series, smc, true)
    drawSupplyDemandOverlay(canvas, container, chart, series, sd, true, false)
    return
  }
  if (showSmc) {
    drawSMCOverlay(canvas, container, chart, series, smc, true)
    return
  }
  drawSupplyDemandOverlay(canvas, container, chart, series, sd, true, true)
}

export function drawBoxFlipOverlay(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  chart: any,
  series: any,
  candles: Candle[],
  boxFlip: BoxFlipResult,
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
  if (!visible || !candles.length) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }

  const timeScale = chart.timeScale()
  const visibleRange = timeScale.getVisibleLogicalRange?.()
  const visibleFrom =
    visibleRange && Number.isFinite(visibleRange.from)
      ? Math.max(0, Math.floor(visibleRange.from) - 8)
      : 0
  const visibleTo =
    visibleRange && Number.isFinite(visibleRange.to)
      ? Math.min(candles.length - 1, Math.ceil(visibleRange.to) + 8)
      : candles.length - 1
  const toX = (idx: number) => {
    const candle = candles[Math.max(0, Math.min(candles.length - 1, idx))]
    const x = timeScale.timeToCoordinate(candle.time)
    return typeof x === 'number' ? x : null
  }
  const toY = (price: number) => {
    const y = series.priceToCoordinate(price)
    return typeof y === 'number' ? y : null
  }

  const visibleBoxes = boxFlip.boxes
    .filter((box) => {
      const end = box.endIndex ?? candles.length - 1
      return end >= visibleFrom && box.startIndex <= visibleTo
    })
    .slice(-8)

  for (let idx = 0; idx < visibleBoxes.length; idx++) {
    const box = visibleBoxes[idx]
    const x1 = toX(box.startIndex)
    const x2 = toX(box.endIndex ?? candles.length - 1)
    const yHigh = toY(box.high)
    const yLow = toY(box.low)
    if (x1 == null || x2 == null || yHigh == null || yLow == null) continue

    const x = Math.min(x1, x2)
    const y = Math.min(yHigh, yLow)
    const w = Math.max(4, Math.abs(x2 - x1))
    const h = Math.max(2, Math.abs(yLow - yHigh))
    const isBull = box.dir === 'B'
    const isBear = box.dir === 'S'
    const isLatest = idx === visibleBoxes.length - 1

    ctx.fillStyle = isLatest
      ? isBull
        ? 'rgba(34,197,94,0.105)'
        : isBear
          ? 'rgba(249,115,22,0.105)'
          : 'rgba(148,163,184,0.095)'
      : isBull
        ? 'rgba(34,197,94,0.026)'
        : isBear
          ? 'rgba(249,115,22,0.026)'
          : 'rgba(148,163,184,0.018)'
    ctx.strokeStyle = isBull
      ? isLatest
        ? 'rgba(34,197,94,0.86)'
        : 'rgba(34,197,94,0.26)'
      : isBear
        ? isLatest
          ? 'rgba(249,115,22,0.86)'
          : 'rgba(249,115,22,0.26)'
        : isLatest
          ? 'rgba(203,213,225,0.76)'
          : 'rgba(148,163,184,0.16)'
    ctx.lineWidth = isLatest ? 2.5 : 1
    ctx.setLineDash(isLatest ? [] : [5, 4])
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)

    if (isLatest) {
      const guideColor = isBull
        ? 'rgba(34,197,94,0.72)'
        : isBear
          ? 'rgba(249,115,22,0.72)'
          : 'rgba(203,213,225,0.58)'
      ctx.save()
      ctx.strokeStyle = guideColor
      ctx.lineWidth = 1.25
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(Math.min(rect.width, x + w + 120), y)
      ctx.moveTo(x, y + h)
      ctx.lineTo(Math.min(rect.width, x + w + 120), y + h)
      ctx.stroke()
      ctx.restore()
    }

    if (isLatest || box.dir) {
      const tag = box.dir ?? 'BOX'
      const tagColor = isBull ? '#22c55e' : isBear ? '#f97316' : '#94a3b8'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'top'
      const label = `${tag} ${fmtP(box.low)}-${fmtP(box.high)}`
      const tw = ctx.measureText(label).width + 10
      const labelX = Math.max(6, Math.min(x + 4, rect.width - tw - 6))
      const labelY = Math.max(6, y + 4)
      ctx.fillStyle = 'rgba(7,16,17,0.78)'
      ctx.fillRect(labelX, labelY, tw, 18)
      ctx.strokeStyle = tagColor
      ctx.setLineDash([])
      ctx.strokeRect(labelX, labelY, tw, 18)
      ctx.fillStyle = tagColor
      ctx.fillText(label, labelX + 5, labelY + 4)
    }
  }

  ctx.setLineDash([])
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/** Per-session colors: box border/fill + label, tuned to sit quietly behind price. */
const SESSION_STYLE: Record<
  SessionName,
  { border: string; fill: string; label: string; name: string }
> = {
  asia: {
    border: 'rgba(89,132,224,0.55)',
    fill: 'rgba(89,132,224,0.06)',
    label: 'rgba(120,160,240,0.85)',
    name: 'Asia',
  },
  london: {
    border: 'rgba(232,158,74,0.6)',
    fill: 'rgba(232,158,74,0.06)',
    label: 'rgba(240,178,110,0.9)',
    name: 'London',
  },
  ny: {
    border: 'rgba(64,190,168,0.55)',
    fill: 'rgba(64,190,168,0.06)',
    label: 'rgba(110,210,190,0.85)',
    name: 'New York',
  },
}

interface LabelRect {
  l: number
  t: number
  r: number
  b: number
}

function labelOverlaps(a: LabelRect, b: LabelRect, pad = 3): boolean {
  return a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad
}

const ICT_LABEL_MIN_W = 52
const ICT_LABEL_MIN_H = 16
const ICT_LABEL_MAX = 14
const ICT_LABEL_LINE = 13

/**
 * ICT overlay: draws each session as a range-bounded box (top = session high,
 * bottom = session low) spanning its time window, with a dotted midline and a
 * compact single-line caption inside the box when there is room. Labels use
 * collision avoidance so captions do not stack on top of each other.
 * Also draws Judas swing markers.
 */
export function drawICTOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  ict: ICTResult,
  data: Candle[],
  show: boolean,
) {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!show || !data.length) return

  ctx.scale(dpr, dpr)
  const ts = chart.timeScale()
  const toX = (time: number) => {
    const coord = ts.timeToCoordinate(time)
    return coord ?? -1
  }
  const toY = (price: number) => {
    const coord = series.priceToCoordinate(price)
    return coord ?? -1
  }

  type SessionDraw = {
    s: (typeof ict.sessions)[number]
    left: number
    right: number
    top: number
    boxH: number
    mid: number
    area: number
  }

  const sessionDraws: SessionDraw[] = []

  for (const s of ict.sessions) {
    let x1 = toX(s.startTime)
    let x2 = toX(s.endTime)
    if (x1 < 0 && x2 < 0) continue
    if (x1 < 0) x1 = 0
    if (x2 < 0) x2 = w
    const left = Math.min(x1, x2)
    const right = Math.max(x1, x2)
    if (right - left < 2) continue

    const yHigh = toY(s.high)
    const yLow = toY(s.low)
    if (yHigh < 0 || yLow < 0) continue
    const top = Math.min(yHigh, yLow)
    const boxH = Math.max(2, Math.abs(yLow - yHigh))
    const mid = (s.high + s.low) / 2

    sessionDraws.push({ s, left, right, top, boxH, mid, area: (right - left) * boxH })
  }

  // Draw boxes first (all visible sessions).
  for (const d of sessionDraws) {
    const st = SESSION_STYLE[d.s.name]
    const boxW = d.right - d.left

    ctx.fillStyle = st.fill
    ctx.fillRect(d.left, d.top, boxW, d.boxH)
    ctx.strokeStyle = st.border
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.strokeRect(d.left, d.top, boxW, d.boxH)

    const yMid = toY(d.mid)
    if (yMid >= 0) {
      ctx.setLineDash([1, 3])
      ctx.beginPath()
      ctx.moveTo(d.left, yMid)
      ctx.lineTo(d.right, yMid)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // Labels: widest sessions first, collision-aware, capped count.
  const labelRects: LabelRect[] = []
  const labelCandidates = [...sessionDraws]
    .filter((d) => d.right - d.left >= ICT_LABEL_MIN_W && d.boxH >= ICT_LABEL_MIN_H)
    .sort((a, b) => b.area - a.area)
    .slice(0, ICT_LABEL_MAX * 2)

  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'top'

  let labelsDrawn = 0
  for (const d of labelCandidates) {
    if (labelsDrawn >= ICT_LABEL_MAX) break

    const st = SESSION_STYLE[d.s.name]
    const range = d.s.high - d.s.low
    const text = `${st.name} · ${fmtP(range)}`
    const tw = ctx.measureText(text).width + 8
    const boxW = d.right - d.left

    if (tw > boxW - 6) continue

    let lx = d.left + 4
    let ly = d.top + 4

    const fitsInBox = (): boolean => {
      if (ly + ICT_LABEL_LINE > d.top + d.boxH - 2) return false
      const rect: LabelRect = { l: lx, t: ly, r: lx + tw, b: ly + ICT_LABEL_LINE }
      if (rect.r > d.right - 2) return false
      return !labelRects.some((r) => labelOverlaps(rect, r))
    }

    while (!fitsInBox()) {
      ly += ICT_LABEL_LINE + 2
      if (ly > d.top + d.boxH - ICT_LABEL_LINE) break
    }
    if (!fitsInBox()) continue

    const rect: LabelRect = { l: lx, t: ly, r: lx + tw, b: ly + ICT_LABEL_LINE }
    ctx.fillStyle = 'rgba(8,10,13,0.78)'
    ctx.fillRect(rect.l, rect.t, tw, ICT_LABEL_LINE)
    ctx.fillStyle = st.label
    ctx.fillText(text, lx + 4, ly + 1)
    labelRects.push(rect)
    labelsDrawn++
  }

  ctx.textBaseline = 'alphabetic'

  // ── Judas swing markers ──
  for (const j of ict.judas) {
    const c = data[j.index]
    if (!c) continue
    const x = toX(c.time)
    const y = toY(j.type === 'bearish' ? c.high : c.low)
    if (x < 0 || y < 0) continue
    const color = j.type === 'bullish' ? '#34d8a4' : '#ff7a85'
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    // Small diamond at the sweep extreme.
    const off = j.type === 'bearish' ? -8 : 8
    ctx.beginPath()
    ctx.moveTo(x, y + off - 4)
    ctx.lineTo(x + 4, y + off)
    ctx.lineTo(x, y + off + 4)
    ctx.lineTo(x - 4, y + off)
    ctx.closePath()
    ctx.fill()
    ctx.font = 'bold 9px monospace'
    const tag = j.volConfirm ? 'JUDAS✦' : 'JUDAS'
    const tw = ctx.measureText(tag).width
    ctx.fillText(tag, x - tw / 2, y + off + (j.type === 'bearish' ? -8 : 16))
  }

  ctx.setLineDash([])
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

// PLACEHOLDER_LIQUIDITY_OVERLAY
/**
 * ICT Liquidity overlay: the trading range + equilibrium (premium/discount),
 * external buy/sell-side liquidity lines (BSL/SSL), sweep markers, and the
 * current liquidity draw target. Kept intentionally sparse to avoid clutter.
 */
export function drawLiquidityOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  liq: LiquidityResult,
  data: Candle[],
  show: boolean,
) {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!show || !data.length || !liq.range) return

  ctx.scale(dpr, dpr)
  const ts = chart.timeScale()
  const toY = (price: number) => {
    const coord = series.priceToCoordinate(price)
    return coord ?? -1
  }
  const toX = (time: number) => {
    const coord = ts.timeToCoordinate(time)
    return coord ?? -1
  }

  const { range } = liq
  const yHigh = toY(range.high)
  const yLow = toY(range.low)
  const yEq = toY(range.equilibrium)

  // ── Premium / discount shading (very faint) ──
  if (yHigh >= 0 && yEq >= 0) {
    ctx.fillStyle = 'rgba(255,122,133,0.04)' // premium = above EQ
    ctx.fillRect(0, Math.min(yHigh, yEq), w, Math.abs(yEq - yHigh))
  }
  if (yLow >= 0 && yEq >= 0) {
    ctx.fillStyle = 'rgba(52,216,164,0.04)' // discount = below EQ
    ctx.fillRect(0, Math.min(yEq, yLow), w, Math.abs(yLow - yEq))
  }

  // ── Equilibrium line (dashed) ──
  if (yEq >= 0) {
    ctx.strokeStyle = 'rgba(190,255,234,0.4)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(0, yEq)
    ctx.lineTo(w, yEq)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(190,255,234,0.6)'
    ctx.fillText('EQ (50%)', 4, yEq - 3)
  }

  // ── External liquidity lines: BSL (range high) + SSL (range low) ──
  const externalHigh = liq.levels.find((l) => l.side === 'external' && l.kind === 'swing-high')
  const externalLow = liq.levels.find((l) => l.side === 'external' && l.kind === 'swing-low')
  const liqLabels: LabelRect[] = []
  for (const [y, price, label, swept] of [
    [yHigh, range.high, 'BSL', externalHigh?.swept ?? false],
    [yLow, range.low, 'SSL', externalLow?.swept ?? false],
  ] as const) {
    if (y < 0) continue
    ctx.strokeStyle = swept ? 'rgba(120,130,150,0.5)' : 'rgba(255,196,107,0.75)'
    ctx.lineWidth = swept ? 1 : 1.5
    ctx.setLineDash(swept ? [3, 3] : [])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = swept ? 'rgba(120,130,150,0.8)' : 'rgba(255,196,107,0.95)'
    const text = `${label}${swept ? ' (swept)' : ''} ${fmtP(price)}`
    const tw = ctx.measureText(text).width
    let lx = w - tw - 8
    let ly = y - 11
    const rect = (): LabelRect => ({ l: lx, t: ly, r: lx + tw, b: ly + 11 })
    while (liqLabels.some((r) => labelOverlaps(rect(), r)) && ly > 12) {
      ly -= 12
    }
    ctx.fillText(text, lx, ly)
    liqLabels.push(rect())
  }

  // ── Sweep markers (arrow at the pierced extreme) ──
  for (const s of liq.sweeps) {
    const c = data[s.index]
    if (!c) continue
    const x = toX(c.time)
    const y = toY(s.side === 'high' ? c.high : c.low)
    if (x < 0 || y < 0) continue
    const color = s.type === 'bullish' ? '#34d8a4' : '#ff7a85'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.5
    const dir = s.side === 'high' ? -1 : 1 // arrow points away from the wick
    ctx.beginPath()
    ctx.moveTo(x, y + dir * 2)
    ctx.lineTo(x, y + dir * 12)
    ctx.moveTo(x, y + dir * 2)
    ctx.lineTo(x - 3, y + dir * 6)
    ctx.moveTo(x, y + dir * 2)
    ctx.lineTo(x + 3, y + dir * 6)
    ctx.stroke()
    ctx.font = 'bold 8px monospace'
    const tag = s.inKillzone ? 'SWEEP✦' : 'SWEEP'
    const tw = ctx.measureText(tag).width
    ctx.fillText(tag, x - tw / 2, y + dir * 20)
  }

  // ── Next liquidity draw (dotted line toward the target) ──
  if (liq.nextTarget) {
    const y = toY(liq.nextTarget.price)
    if (y >= 0) {
      ctx.strokeStyle = 'rgba(111,188,240,0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([1, 3])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(111,188,240,0.9)'
      ctx.fillText(`→ ${liq.nextTarget.label}`, 4, y - 3)
    }
  }

  ctx.setLineDash([])
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
