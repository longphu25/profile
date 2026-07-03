// BTC Chart — Volume Profile drawer (canvas).
// Histogram bars grow right-to-left from the price scale; heatmap strip docks on the right.

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
  /** Width of the profile bar column in pixels. */
  profileWidth?: number
  /** Width of the heatmap intensity strip in pixels. */
  heatmapWidth?: number
  /** Show heatmap strip flush against the price scale. */
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

const HEATMAP_W_DEFAULT = 14
const PROFILE_W_DEFAULT = 168
const COL_GAP = 2

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
  const bins = opts.bins ?? 64
  const showHeatmap = opts.heatmap ?? true
  const hvnRatio = opts.hvnRatio ?? 0.8
  const profileW = opts.profileWidth ?? PROFILE_W_DEFAULT
  const heatmapW = opts.heatmapWidth ?? HEATMAP_W_DEFAULT
  const W = showHeatmap ? profileW + COL_GAP + heatmapW : profileW
  const H = mainEl.clientHeight

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
  const profileX = 0
  const heatmapX = profileW + COL_GAP
  const barPadLeft = 6
  const barPadRight = 4
  const barW = profileW - barPadLeft - barPadRight
  /** Right edge of histogram bars (anchored beside heatmap / price scale). */
  const barOriginRight = profileX + profileW - barPadRight

  // ── 1. Profile buy/sell bars (grow right → left into chart) ────────
  const vaY = H - (vahIdx + 1) * rowH
  const vaH = (vahIdx - valIdx + 1) * rowH
  ctx.fillStyle = 'rgba(255,196,107,0.05)'
  ctx.fillRect(profileX, vaY, profileW, vaH)

  let hvnCount = 0
  rows.forEach((r, i) => {
    const y = H - (i + 1) * rowH
    const buyW = (r.buy / maxVol) * barW
    const sellW = (r.sell / maxVol) * barW
    const isPOC = i === pocIdx
    const isVA = i >= valIdx && i <= vahIdx
    const isHVN = !isPOC && r.total >= maxVol * hvnRatio
    if (isHVN) hvnCount++

    const totalW = sellW + buyW
    const barLeft = barOriginRight - totalW

    ctx.fillStyle = isPOC
      ? 'rgba(255,196,107,0.95)'
      : isHVN
        ? 'rgba(255,196,107,0.7)'
        : isVA
          ? 'rgba(255,122,133,0.6)'
          : 'rgba(255,122,133,0.3)'
    ctx.fillRect(barLeft, y + 0.5, sellW, rowH - 1)

    ctx.fillStyle = isPOC
      ? 'rgba(255,196,107,0.95)'
      : isHVN
        ? 'rgba(128,255,213,0.7)'
        : isVA
          ? 'rgba(52,216,164,0.6)'
          : 'rgba(52,216,164,0.3)'
    ctx.fillRect(barLeft + sellW, y + 0.5, buyW, rowH - 1)

    if (isHVN) {
      ctx.fillStyle = 'rgba(255,196,107,0.9)'
      ctx.beginPath()
      ctx.arc(barOriginRight - 2, y + rowH / 2, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // ── 2. Heatmap strip (right column, flush to price scale) ────────────
  if (showHeatmap) {
    rows.forEach((r, i) => {
      const y = H - (i + 1) * rowH
      const t = r.total / maxVol
      const alpha = 0.08 + t * 0.62
      const c =
        t > 0.66
          ? `rgba(255,196,107,${alpha})`
          : t > 0.33
            ? `rgba(128,255,213,${alpha * 0.9})`
            : `rgba(190,255,234,${alpha * 0.6})`
      ctx.fillStyle = c
      ctx.fillRect(heatmapX, y, heatmapW, rowH)
    })

    ctx.fillStyle = 'rgba(232, 184, 74, 0.18)'
    ctx.fillRect(heatmapX - 1, 0, 1, H)
  }

  // ── 3. POC line across profile column ────────────────────────────────
  const pocY = H - (pocIdx + 0.5) * rowH
  ctx.strokeStyle = '#ffc46b'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(profileX, pocY)
  ctx.lineTo(profileX + profileW, pocY)
  ctx.stroke()
  ctx.setLineDash([])

  const pocPrice = minP + pocIdx * step
  const pocLabel = 'POC ' + fmt(pocPrice)
  ctx.font = 'bold 9px ui-monospace, monospace'
  const pocLabelW = ctx.measureText(pocLabel).width + 8
  const pocLabelX = Math.max(profileX + 2, barOriginRight - pocLabelW)
  ctx.fillStyle = 'rgba(255,196,107,0.95)'
  roundRect(ctx, pocLabelX, pocY - 7, pocLabelW, 13, 3)
  ctx.fill()
  ctx.fillStyle = '#071011'
  ctx.fillText(pocLabel, pocLabelX + 4, pocY + 2)

  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(255,122,133,0.85)'
  ctx.fillText('VAH', profileX + 2, H - (vahIdx + 0.5) * rowH - 2)
  ctx.fillStyle = 'rgba(52,216,164,0.85)'
  ctx.fillText('VAL', profileX + 2, H - (valIdx + 0.5) * rowH + 9)

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
