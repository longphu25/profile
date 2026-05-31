// BTC Chart — PNG snapshot.
//
// lightweight-charts exposes `chart.takeScreenshot()` which returns an HTMLCanvasElement.
// We compose 3 panes (main / RSI / volume) plus the volume-profile overlay onto a
// single canvas at the layout height, then trigger a download.

interface Pane {
  chart: { takeScreenshot(): HTMLCanvasElement }
  height: number
}

export interface SnapshotInput {
  main: Pane
  rsi?: Pane | null
  vol?: Pane | null
  /** Volume profile overlay canvas (already rendered). */
  vpOverlay?: HTMLCanvasElement | null
  /** Right-edge offset for the VP overlay relative to the main pane. */
  vpRightOffset?: number
  /** Order flow overlay canvas (already rendered, full main-pane size). */
  ofOverlay?: HTMLCanvasElement | null
  filename?: string
  bg?: string
}

export function downloadChartSnapshot({
  main,
  rsi,
  vol,
  vpOverlay,
  vpRightOffset = 64,
  ofOverlay,
  filename = `btc-chart-${Date.now()}.png`,
  bg = '#071011',
}: SnapshotInput): void {
  const mainCanvas = main.chart.takeScreenshot()
  const rsiCanvas = rsi?.chart.takeScreenshot() ?? null
  const volCanvas = vol?.chart.takeScreenshot() ?? null

  const W = mainCanvas.width
  const H = mainCanvas.height + (rsiCanvas?.height ?? 0) + (volCanvas?.height ?? 0)

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  let y = 0
  ctx.drawImage(mainCanvas, 0, y)

  // Composite the order-flow overlay (full main-pane size).
  if (ofOverlay) {
    ctx.drawImage(ofOverlay, 0, y)
  }

  // Composite the volume-profile overlay on top of the main pane.
  if (vpOverlay) {
    const x = Math.max(0, W - vpOverlay.width - vpRightOffset)
    ctx.drawImage(vpOverlay, x, y)
  }

  y += mainCanvas.height
  if (rsiCanvas) {
    ctx.drawImage(rsiCanvas, 0, y)
    y += rsiCanvas.height
  }
  if (volCanvas) {
    ctx.drawImage(volCanvas, 0, y)
  }

  out.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
