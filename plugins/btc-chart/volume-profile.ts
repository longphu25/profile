// BTC Chart — Volume Profile drawer (canvas).
// Renders a horizontal-bar profile + heatmap on the right side of the price chart.

export interface VPCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface VPInfo {
  poc: string
  vah: string
  val: string
  pos: string
  hvnCount: number
}

export interface VPOptions {
  bins?: number
  /** Width of the overlay canvas in pixels. */
  width?: number
  /** Show heatmap column behind the bars (volume intensity gradient). */
  heatmap?: boolean
  /** Highlight rows ≥ this fraction of POC volume as High Volume Nodes. */
  hvnRatio?: number
}

interface Profile {
  rows: { total: number; buy: number; sell: number }[]
  minP: number
  maxP: number
  step: number
  pocIdx: number
  vahIdx: number
  valIdx: number
  totalVol: number
}

const fmt = (n: number) =>
  n >= 10000 ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2)

function buildProfile(candles: VPCandle[], bins: number): Profile {
  const lows = candles.map((c) => c.low)
  const highs = candles.map((c) => c.high)
  const minP = Math.min(...lows)
  const maxP = Math.max(...highs)
  const step = (maxP - minP) / bins
  const rows = Array.from({ length: bins }, () => ({ total: 0, buy: 0, sell: 0 }))

  for (const c of candles) {
    const idx = Math.max(0, Math.min(bins - 1, Math.floor((c.close - minP) / step)))
    rows[idx].total += c.volume
    if (c.close >= c.open) rows[idx].buy += c.volume
    else rows[idx].sell += c.volume
  }

  let pocIdx = 0
  for (let i = 1; i < rows.length; i++) if (rows[i].total > rows[pocIdx].total) pocIdx = i

  const totalVol = rows.reduce((s, r) => s + r.total, 0)
  const target = totalVol * 0.7
  let vaSum = rows[pocIdx].total
  let vahIdx = pocIdx
  let valIdx = pocIdx
  while (vaSum < target && (vahIdx < bins - 1 || valIdx > 0)) {
    const upVol = vahIdx < bins - 1 ? rows[vahIdx + 1].total : 0
    const dnVol = valIdx > 0 ? rows[valIdx - 1].total : 0
    if (upVol >= dnVol && vahIdx < bins - 1) {
      vahIdx++
      vaSum += upVol
    } else if (valIdx > 0) {
      valIdx--
      vaSum += dnVol
    } else break
  }

  return { rows, minP, maxP, step, pocIdx, vahIdx, valIdx, totalVol }
}

/** Draw profile on a canvas. Returns derived info (or null when not drawn). */
export function drawVolumeProfile(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  candles: VPCandle[],
  visible: boolean,
  opts: VPOptions = {},
): VPInfo {
  const W = opts.width ?? 220
  const H = mainEl.clientHeight
  const bins = opts.bins ?? 64
  const heatmap = opts.heatmap ?? true
  const hvnRatio = opts.hvnRatio ?? 0.8

  canvas.width = W
  canvas.height = H
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  canvas.style.top = '0px'

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  if (!visible || candles.length < 10) {
    return { poc: '—', vah: '—', val: '—', pos: '—', hvnCount: 0 }
  }

  const vp = buildProfile(candles, bins)
  const { rows, pocIdx, vahIdx, valIdx, step, minP } = vp
  const maxVol = Math.max(...rows.map((r) => r.total)) || 1
  const rowH = H / rows.length
  const barW = W - 14 // leave space for label gutter

  // ── 1. Heatmap column (5px strip on the very left) ─────────────────
  if (heatmap) {
    const stripW = 5
    rows.forEach((r, i) => {
      const y = H - (i + 1) * rowH
      const t = r.total / maxVol
      const alpha = 0.06 + t * 0.55
      // amber → mint gradient by intensity
      const c =
        t > 0.66
          ? `rgba(255,196,107,${alpha})`
          : t > 0.33
            ? `rgba(128,255,213,${alpha * 0.9})`
            : `rgba(190,255,234,${alpha * 0.6})`
      ctx.fillStyle = c
      ctx.fillRect(0, y, stripW, rowH)
    })
  }

  // ── 2. Value Area band (subtle backdrop) ───────────────────────────
  const vaY = H - (vahIdx + 1) * rowH
  const vaH = (vahIdx - valIdx + 1) * rowH
  ctx.fillStyle = 'rgba(255,196,107,0.05)'
  ctx.fillRect(8, vaY, W - 8, vaH)

  // ── 3. Buy/Sell horizontal bars ────────────────────────────────────
  const offsetX = heatmap ? 8 : 0
  let hvnCount = 0
  rows.forEach((r, i) => {
    const y = H - (i + 1) * rowH
    const buyW = (r.buy / maxVol) * (barW - offsetX)
    const sellW = (r.sell / maxVol) * (barW - offsetX)
    const isPOC = i === pocIdx
    const isVA = i >= valIdx && i <= vahIdx
    const isHVN = !isPOC && r.total >= maxVol * hvnRatio
    if (isHVN) hvnCount++

    // Sell side first (red), then buy side (green) stacked horizontally.
    ctx.fillStyle = isPOC
      ? 'rgba(255,196,107,0.95)'
      : isHVN
        ? 'rgba(255,196,107,0.7)'
        : isVA
          ? 'rgba(255,122,133,0.6)'
          : 'rgba(255,122,133,0.3)'
    ctx.fillRect(offsetX, y + 0.5, sellW, rowH - 1)

    ctx.fillStyle = isPOC
      ? 'rgba(255,196,107,0.95)'
      : isHVN
        ? 'rgba(128,255,213,0.7)'
        : isVA
          ? 'rgba(52,216,164,0.6)'
          : 'rgba(52,216,164,0.3)'
    ctx.fillRect(offsetX + sellW, y + 0.5, buyW, rowH - 1)

    // HVN ring marker on the right gutter
    if (isHVN) {
      ctx.fillStyle = 'rgba(255,196,107,0.9)'
      ctx.beginPath()
      ctx.arc(W - 4, y + rowH / 2, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // ── 4. POC line ────────────────────────────────────────────────────
  const pocY = H - (pocIdx + 0.5) * rowH
  ctx.strokeStyle = '#ffc46b'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(0, pocY)
  ctx.lineTo(W, pocY)
  ctx.stroke()
  ctx.setLineDash([])

  // POC pill label
  const pocPrice = minP + pocIdx * step
  const pocLabel = 'POC ' + fmt(pocPrice)
  ctx.font = 'bold 9px ui-monospace, monospace'
  const pocLabelW = ctx.measureText(pocLabel).width + 8
  ctx.fillStyle = 'rgba(255,196,107,0.95)'
  roundRect(ctx, 6, pocY - 7, pocLabelW, 13, 3)
  ctx.fill()
  ctx.fillStyle = '#071011'
  ctx.fillText(pocLabel, 10, pocY + 2)

  // VAH / VAL minor labels
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(255,122,133,0.85)'
  ctx.fillText('VAH', 8, H - (vahIdx + 0.5) * rowH - 2)
  ctx.fillStyle = 'rgba(52,216,164,0.85)'
  ctx.fillText('VAL', 8, H - (valIdx + 0.5) * rowH + 9)

  const poc = minP + pocIdx * step
  const vah = minP + vahIdx * step
  const val = minP + valIdx * step
  let pos = '—'
  if (candles.length) {
    const last = candles[candles.length - 1].close
    if (last > vah) pos = 'Above VAH'
    else if (last < val) pos = 'Below VAL'
    else pos = 'In Value Area'
  }

  return {
    poc: fmt(poc),
    vah: fmt(vah),
    val: fmt(val),
    pos,
    hvnCount,
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
