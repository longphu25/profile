# Styling & Design Discipline

## Design tokens

Plugin Shadow DOM bị scope hoàn toàn — tokens phải khai báo lại trong `:host`. Lấy giá trị từ design system TaskForm + locked palette:

```css
:host {
  /* Surfaces */
  --bg: #071011;
  --bg-2: #0a191a;
  --surface: rgba(8, 24, 25, 0.92);
  --surface-2: rgba(12, 34, 35, 0.96);
  --surface-3: rgba(190, 255, 234, 0.04);

  /* Lines */
  --border: rgba(190, 255, 234, 0.10);
  --border-strong: rgba(190, 255, 234, 0.22);

  /* Text */
  --text: #effff8;
  --text-2: #cfe9df;
  --muted: #6f8a83;
  --muted-2: #9fb9b1;

  /* Brand */
  --mint: #80ffd5;
  --teal: #28d8c1;
  --amber: #ffc46b;
  --sui: #6fbcf0;

  /* Locked chart palette */
  --up: #34d8a4;     /* mint-teal — bullish */
  --dn: #ff7a85;     /* coral — bearish */
  --neu: #6fbcf0;    /* sui blue — neutral lines (NWE mid, RSI) */
  --hi: #ffc46b;     /* amber — POC, MA200 */

  /* Type */
  --font-sans: 'Satoshi', 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

## Locked accent rule

Chỉ 4 màu data: `--up`, `--dn`, `--neu`, `--hi`. KHÔNG thêm orange / yellow / cyan / purple từ TradingView default.

| Element | Color | Token |
|---------|------|------|
| Bullish candle, up arrow, BUY tag | `#34d8a4` | `--up` |
| Bearish candle, down arrow, SELL tag | `#ff7a85` | `--dn` |
| NWE mid, RSI line, "neutral" hint | `#6fbcf0` | `--neu` |
| POC, MA200, alert highlight | `#ffc46b` | `--hi` |
| MA50 | `#80ffd5` | `--mint` |

NWE upper/lower dùng tint của `--dn` / `--up` (alpha 0.6). VP buy/sell dùng tint của `--up` / `--dn` (alpha 0.3-0.95 theo POC/HVN/VA tier).

## Typography

| Use | Font | Sample |
|-----|------|--------|
| Pair, headlines | Satoshi 700 | `BTC / USDT` |
| Numeric (price, OHLCV) | JetBrains Mono | `73,580.42` |
| Eyebrows / labels | Satoshi 600 uppercase 0.18em | `INDICATORS` |
| Status bar, status tags | JetBrains Mono 9-10px | `OF · 4` |

Letter spacing cho mono: `0.04em`. Cho uppercase eyebrows: `0.16em` đến `0.18em`.

## No emoji discipline

Theo `design-taste-frontend` skill — tất cả icon UI phải là SVG hoặc text. Plugin hiện tại tránh emoji trong panel titles, status bars, alert labels. Còn lại 1-2 chỗ tasteful (▲▼ trong TA signal text — chấp nhận vì đây là directional arrow chuẩn).

## Layout discipline

### Flex panes (root cause của mọi resize bug)

```css
.btc-chart        { position: absolute; inset: 0; display: flex; flex-direction: column; }
.btc-chart__col   { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.btc-chart__main  { flex: 7   1 0; min-height: 0; }
.btc-chart__rsi   { flex: 1.5 1 0; min-height: 0; }
.btc-chart__vol   { flex: 1.5 1 0; min-height: 0; }
```

`min-height: 0` trên cả `__col` và 3 panes là **bắt buộc** — flex children mặc định có `min-height: auto` ngăn shrink.

`position: absolute; inset: 0` trên `.btc-chart` để escape khỏi `<div>` mount-point của ShadowContainer (vốn không có chiều cao).

JS không bao giờ set `el.style.height`. Chart pixel size do `applyOptions({ height })` cập nhật từ `clientHeight` thật trong `ResizeObserver`.

### Page-level cascade (host page)

```css
/* src/btc-chart/btc-chart.css */
html, body { height: 100dvh; overflow: hidden; }
#root { height: 100dvh; }

.btc-page { height: 100dvh; display: flex; flex-direction: column; }
.btc-page > div { flex: 1; min-height: 0; height: 100%; }
```

`.btc-page > div` target div mà ShadowContainer tạo. Đây là rule bắt cầu cho size từ viewport xuống Shadow root.

## Ghost borders

Theo design system: không dùng 1px solid border đậm. Tất cả border dùng `--border` (alpha 0.10) hoặc `--border-strong` (0.22). Ngoại lệ:

- Active state buttons: dùng inset shadow `box-shadow: inset 0 -1.5px 0 0 var(--mint)` thay vì border.
- Alert "fired" state: `border-left: 2px solid var(--mint)` — visual anchor cần solid line.

## Spacing rhythm

Sidebar panel padding: `14px 16px`.
Row gap trong panel: `6px`.
Section title margin-bottom: `10px`.

Không dùng `margin: auto` cho center — flex `align-items` / `justify-content` thay thế.

## Responsive

```css
@media (max-width: 980px) {
  .btc-chart__sidebar { width: 230px; }
  .btc-chart__ohlcv { display: none; }   /* hide OHLCV strip */
}
@media (max-width: 768px) {
  .btc-chart__body { flex-direction: column; }
  .btc-chart__sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 45vh;
  }
}
@media (prefers-reduced-motion: reduce) {
  .btc-chart__live-dot,
  .btc-chart__spinner { animation: none; }
}
```

## Toast positioning

Toast sử dụng `position: absolute; top: 12px; left: 50%; translateX(-50%)`. KHÔNG dùng `position: fixed` vì plugin nằm trong Shadow DOM — `fixed` sẽ vượt khỏi shadow tree và bị viewport-relative thay vì shadow-root-relative.

## Anti-patterns đã tránh

| Anti-pattern | Lý do tránh | Áp dụng |
|--------------|------------|--------|
| Toolbar 7 colored dots | Visual noise, low signal | Buttons text-only, active = inset underline |
| ML label hiển thị 2 lần | Duplicate signal | Single block, label + bar + foot trong cùng card |
| Emoji panel titles (🤖 〰️ 📊) | AI default | Plain caps mono titles |
| TradingView default palette (orange/yellow/purple/cyan) | Generic, không brand | Locked 4-color palette |
| Mixed corner radii | Shape inconsistency | Tất cả rounded `4-8px`, pill chỉ cho FNG bar pointer |
| Drop shadows đậm | 2010s era | Tonal layering qua surface tiers |
| `useState` cho continuous values | Re-render mỗi tick | Refs cho candle data, alerts, vp opts |
