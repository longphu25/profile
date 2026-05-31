# PNG Snapshot

Source: `plugins/btc-chart/snapshot.ts`

## API

```ts
downloadChartSnapshot({
  main: { chart, height },     // mainChart instance + main pane height
  rsi?: { chart, height },     // null/undefined nếu RSI bị tắt
  vol?: { chart, height },     // null/undefined nếu Volume bị tắt
  vpOverlay?: HTMLCanvasElement | null,  // VP canvas, null nếu VP tắt
  vpRightOffset?: number,      // default 64 (offset khỏi price ladder)
  ofOverlay?: HTMLCanvasElement | null,  // Order flow canvas, full main-pane size
  filename?: string,           // default `btc-chart-{timestamp}.png`
  bg?: string,                 // default '#071011' (token --color-ink)
})
```

## Implementation

`lightweight-charts` expose `chart.takeScreenshot()` trả về `HTMLCanvasElement` với toàn bộ pane (candles, indicators, axes). Plugin compose 3 panes lên một canvas chung:

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

// VP overlay (composite lên main pane đúng vị trí)
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

Nút "PNG" trên toolbar gọi callback này.

## Output

- Format: PNG (transparency tắt vì có background fill).
- Dpi: 1× (theo lightweight-charts internal canvas — DPR-aware nếu canvas `devicePixelRatio` > 1).
- Filename: `btc-chart-1717245819895.png` (timestamp ms).

## Limitations

- Markers Order Flow (▲BUY/▼SELL) thuộc series internal, được include trong screenshot.
- Floating legend (`<div class="btc-chart__legend">`) là HTML overlay — KHÔNG có trong screenshot. Nếu cần legend trên ảnh, thêm step vẽ text bằng `ctx.fillText`.
- Sidebar không nằm trong screenshot — chỉ chart panes.
- Crosshair không bị capture (nó là interactive layer).

## Mở rộng đề xuất

```ts
// Vẽ thêm watermark
ctx.fillStyle = 'rgba(255,255,255,0.04)'
ctx.font = 'bold 64px sans-serif'
ctx.fillText('BTC/USDT', W / 2 - 100, H / 2)

// Vẽ legend snapshot vào góc
ctx.fillStyle = '#9fb9b1'
ctx.font = '11px ui-monospace'
ctx.fillText('NWE 67,400 · MA50 67,200 · RSI 56.3', 12, 20)

// Multi-format export
out.toBlob(saveBlob, 'image/jpeg', 0.92)   // JPEG with quality
out.toBlob(saveBlob, 'image/webp', 0.95)   // WebP
```

## Lưu ý DPR

Nếu màn user là retina (DPR=2), `chart.takeScreenshot()` trả về canvas với `width = clientWidth * 2`. Code hiện tại pass đúng W/H qua `canvas.width`, không cần tự nhân DPR. Nếu cần file kích thước cố định 1920×1080 cho social, downscale bằng `ctx.drawImage(src, 0, 0, targetW, targetH)`.
