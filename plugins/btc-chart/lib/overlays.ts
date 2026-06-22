// BTC Chart — canvas overlay painters for SMC and Box-Flip structures.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BoxFlipResult } from '../box-flip'
import type { SMCResult } from '../smc-wasm'
import { fmtP } from './format'
import type { Candle } from './types'

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

  // FVG boxes
  for (const fvg of smc.fvgs) {
    const x = toX(fvg.time)
    const y1 = toY(fvg.top)
    const y2 = toY(fvg.bottom)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    ctx.fillStyle = fvg.bias === 'bull' ? 'rgba(0,255,104,0.08)' : 'rgba(255,0,8,0.08)'
    ctx.strokeStyle = fvg.bias === 'bull' ? 'rgba(0,255,104,0.3)' : 'rgba(255,0,8,0.3)'
    ctx.lineWidth = 1
    const boxW = Math.max(w - x, 60)
    ctx.fillRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
    ctx.strokeRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
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
