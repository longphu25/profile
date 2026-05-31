// BTC Chart — Order Flow overlay drawer (canvas).
//
// lightweight-charts' built-in series markers always hug candle wicks.
// To improve legibility, we render OF signals into our own canvas placed in
// the top (SELL) and bottom (BUY) gutter bands of the main pane, with a thin
// dotted leader line back to the wick.

export interface OFOverlaySignal {
  time: number // unix seconds (matches candle time)
  type: 'buy' | 'sell'
  ratio: string // formatted volume ratio, e.g. '2.5'
  high: number // candle high (anchor for leader line on sell)
  low: number // candle low  (anchor for leader line on buy)
}

interface ChartLike {
  timeScale: () => {
    timeToCoordinate: (t: number) => number | null
  }
}

interface SeriesLike {
  priceToCoordinate: (p: number) => number | null
}

const SELL_FILL = 'rgba(255,122,133,0.95)'
const BUY_FILL = 'rgba(52,216,164,0.95)'
const SELL_LINE = 'rgba(255,122,133,0.45)'
const BUY_LINE = 'rgba(52,216,164,0.45)'

const PILL_H = 18
const FONT = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace'
/** Vertical band centers measured from top / bottom of pane. */
const TOP_BAND_Y = 16
const BOT_BAND_INSET = 16

/** Minimum horizontal gap between two pills in the same band before stacking. */
const STACK_GAP = 6

export function drawOrderFlow(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  chart: ChartLike,
  series: SeriesLike,
  signals: OFOverlaySignal[],
  visible: boolean,
  rightOffset = 64,
  simple = false,
): void {
  const W = mainEl.clientWidth
  const H = mainEl.clientHeight
  if (W <= 0 || H <= 0) return

  // Match canvas backing-store size to the pane (1× DPR is fine; markers crisp at small sizes).
  canvas.width = W
  canvas.height = H
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  if (!visible || signals.length === 0) return

  // ── Simple mode: just triangles next to wicks, no pills, no leader lines.
  if (simple) {
    for (const s of signals) {
      const x = chart.timeScale().timeToCoordinate(s.time)
      if (x == null) continue
      if (x < 8 || x > W - rightOffset - 8) continue
      const wickY = series.priceToCoordinate(s.type === 'sell' ? s.high : s.low)
      if (wickY == null) continue
      drawTriangle(ctx, x, s.type === 'sell' ? wickY - 6 : wickY + 6, s.type)
    }
    return
  }

  ctx.font = FONT
  ctx.textBaseline = 'middle'

  // First pass: measure + place pills, then anti-collide by stacking on Y.
  type Placed = OFOverlaySignal & {
    x: number
    y: number
    pillX: number
    pillW: number
    wickY: number
  }
  const placed: Placed[] = []

  // Track per-band occupancy for stacking.
  const topRows: number[] = [] // y-center for SELL stack rows
  const botRows: number[] = [] // y-center for BUY stack rows

  for (const s of signals) {
    const x = chart.timeScale().timeToCoordinate(s.time)
    if (x == null) continue
    if (x < 8 || x > W - rightOffset - 8) continue

    const wickY = series.priceToCoordinate(s.type === 'sell' ? s.high : s.low)
    if (wickY == null) continue

    const text = `×${s.ratio}`
    const pillW = Math.ceil(ctx.measureText(text).width) + 14
    const pillX = x - pillW / 2

    // Find a row in the appropriate band that doesn't collide with existing pills.
    const bandStart = s.type === 'sell' ? TOP_BAND_Y : H - BOT_BAND_INSET
    const direction = s.type === 'sell' ? 1 : -1 // sell stacks down, buy stacks up
    const stack = s.type === 'sell' ? topRows : botRows

    let row = 0
    let y = bandStart
    while (true) {
      const candidateY = bandStart + direction * row * (PILL_H + 4)
      const collides = placed.some(
        (p) =>
          p.type === s.type &&
          Math.abs(p.y - candidateY) < PILL_H &&
          pillX < p.pillX + p.pillW + STACK_GAP &&
          pillX + pillW > p.pillX - STACK_GAP,
      )
      if (!collides) {
        y = candidateY
        if (!stack.includes(y)) stack.push(y)
        break
      }
      row++
      if (row > 4) {
        y = candidateY
        break
      } // give up after 5 rows; collision tolerated
    }

    placed.push({ ...s, x, y, pillX, pillW, wickY })
  }

  // Second pass: draw leader lines first (so pills sit on top).
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  for (const p of placed) {
    ctx.strokeStyle = p.type === 'sell' ? SELL_LINE : BUY_LINE
    ctx.beginPath()
    const fromY = p.type === 'sell' ? p.y + PILL_H / 2 : p.y - PILL_H / 2
    const toY = p.type === 'sell' ? p.wickY - 3 : p.wickY + 3
    ctx.moveTo(p.x, fromY)
    ctx.lineTo(p.x, toY)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Third pass: draw pills + arrows + text.
  for (const p of placed) {
    const pillY = p.y - PILL_H / 2
    const fill = p.type === 'sell' ? SELL_FILL : BUY_FILL

    // Pill
    ctx.fillStyle = fill
    roundRect(ctx, p.pillX, pillY, p.pillW, PILL_H, 9)
    ctx.fill()

    // Arrow glyph at left of pill (▲ buy / ▼ sell)
    ctx.fillStyle = '#071011'
    ctx.font = '700 9px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillText(p.type === 'sell' ? '▼' : '▲', p.pillX + 5, p.y)

    // Ratio text
    ctx.font = FONT
    ctx.fillText(`×${p.ratio}`, p.pillX + 14, p.y)
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
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: 'buy' | 'sell') {
  const r = 5
  ctx.fillStyle = type === 'sell' ? SELL_FILL : BUY_FILL
  ctx.beginPath()
  if (type === 'sell') {
    // Down-pointing triangle above wick
    ctx.moveTo(cx, cy + r)
    ctx.lineTo(cx - r, cy - r)
    ctx.lineTo(cx + r, cy - r)
  } else {
    // Up-pointing triangle below wick
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx - r, cy + r)
    ctx.lineTo(cx + r, cy + r)
  }
  ctx.closePath()
  ctx.fill()
}
