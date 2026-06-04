# PNG Snapshot

Source: `plugins/btc-chart/snapshot.ts`

## API

```ts
downloadChartSnapshot({
  main: { chart, height },     // mainChart instance + main pane height
  rsi?: { chart, height },     // null/undefined when RSI is hidden
  vol?: { chart, height },     // null/undefined when Volume is hidden
  vpOverlay?: HTMLCanvasElement | null,  // VP canvas, null when VP is hidden
  vpRightOffset?: number,      // default 64 (offset from the price ladder)
  ofOverlay?: HTMLCanvasElement | null,  // Order-flow canvas, full main-pane size
  filename?: string,           // default `btc-chart-{timestamp}.png`
  bg?: string,                 // default '#071011' (token --color-ink)
})
```

## Implementation

`lightweight-charts` exposes `chart.takeScreenshot()`, which returns an
`HTMLCanvasElement` containing a full pane (candles, indicators, axes). The
plugin composes 3 panes onto one shared canvas:

```ts
const mainCanvas = main.chart.takeScreenshot()
const rsiCanvas  = rsi?.chart.takeScreenshot() ?? null
const volCanvas  = vol?.chart.takeScreenshot() ?? null

const W = mainCanvas.width
const H = mainCanvas.height
       + (rsiCanvas?.height ?? 0)
       + (volCanvas?.height ?? 0)

const out = document.createElement('canvas')
out.width = W; out.height = H
const ctx = out.getContext('2d')!

// Background
ctx.fillStyle = bg
ctx.fillRect(0, 0, W, H)

// Main pane
let y = 0
ctx.drawImage(mainCanvas, 0, y)

// OF overlay (full main-pane size)
if (ofOverlay) ctx.drawImage(ofOverlay, 0, y)

// VP overlay (composited into the main pane at the right position)
if (vpOverlay) {
  const x = Math.max(0, W - vpOverlay.width - vpRightOffset)
  ctx.drawImage(vpOverlay, x, y)
}

y += mainCanvas.height
if (rsiCanvas) { ctx.drawImage(rsiCanvas, 0, y); y += rsiCanvas.height }
if (volCanvas) { ctx.drawImage(volCanvas, 0, y) }

// Download
out.toBlob((blob) => {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}, 'image/png')
```

## Plugin wire-up

```ts
const snapshot = useCallback(() => {
  const refs = chartRefs.current
  if (!refs || !mainElRef.current || !rsiElRef.current || !volElRef.current) return
  downloadChartSnapshot({
    main: { chart: refs.mainChart, height: mainElRef.current.clientHeight },
    rsi: visRef.current.rsi
      ? { chart: refs.rsiChart, height: rsiElRef.current.clientHeight }
      : null,
    vol: visRef.current.vol
      ? { chart: refs.volChart, height: volElRef.current.clientHeight }
      : null,
    vpOverlay: visRef.current.vp ? vpCanvasRef.current : null,
    ofOverlay: visRef.current.of ? ofCanvasRef.current : null,
  })
}, [])
```

The "PNG" toolbar button calls this callback.

## Output

- Format: PNG (transparency disabled because the background is filled).
- DPI: 1× logically, but uses the lightweight-charts internal canvas, which is
  DPR-aware when `devicePixelRatio > 1`.
- Filename: `btc-chart-1717245819895.png` (timestamp ms).

## Limitations

- Order-flow markers that belong to internal series are included in the screenshot.
- The floating legend (`<div class="btc-chart__legend">`) is an HTML overlay and
  is NOT included. If it should appear in the image, add a `ctx.fillText` step.
- The sidebar is not part of the screenshot — only chart panes are exported.
- The crosshair is not captured because it lives in an interactive layer.

## Suggested Extensions

```ts
// Draw an extra watermark
ctx.fillStyle = 'rgba(255,255,255,0.04)'
ctx.font = 'bold 64px sans-serif'
ctx.fillText('BTC/USDT', W / 2 - 100, H / 2)

// Draw a legend snapshot into the corner
ctx.fillStyle = '#9fb9b1'
ctx.font = '11px ui-monospace'
ctx.fillText('NWE 67,400 · MA50 67,200 · RSI 56.3', 12, 20)

// Multi-format export
out.toBlob(saveBlob, 'image/jpeg', 0.92)   // JPEG with quality
out.toBlob(saveBlob, 'image/webp', 0.95)   // WebP
```

## DPR Notes

If the user's display is retina (DPR=2), `chart.takeScreenshot()` returns a
canvas with `width = clientWidth * 2`. The current code already passes the
correct W/H through `canvas.width`, so no manual DPR multiplication is needed.
If a fixed-size 1920×1080 export is needed for social distribution, downscale
with `ctx.drawImage(src, 0, 0, targetW, targetH)`.
