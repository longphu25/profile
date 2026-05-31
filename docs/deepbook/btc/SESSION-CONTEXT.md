# BTC Chart — Session Context

> Đọc file này đầu tiên khi mở session mới để tiếp tục làm việc.

---

## Trạng thái hiện tại (v0.27.2)

| Item | Status |
|------|--------|
| Page entry (`btc-chart.html`) | ✅ Done |
| Plugin (`plugins/btc-chart/`) | ✅ Done — 7 modules |
| Vite config wired | ✅ Done |
| Dev server | `bun run dev` → `http://localhost:5173/btc-chart.html` |
| Diagnostics | Clean (1 unused `setVolume` warning — reserved for future slider) |
| Docs | ✅ 9 files in `docs/deepbook/btc/` |
| Version | `0.27.2` |

---

## File map

```
btc-chart.html                    ← HTML entry, loads lightweight-charts CDN
src/btc-chart/
  ├─ main.tsx                     ← React 19 bootstrap
  ├─ BtcChartPage.tsx             ← ShadowContainer host, loads plugin
  └─ btc-chart.css                ← Page-level tokens + 100dvh cascade

plugins/btc-chart/
  ├─ plugin.tsx                   ← Main component (~1600 lines)
  ├─ style.css                    ← Shadow DOM scoped styles
  ├─ storage.ts                   ← localStorage persist + JSON I/O
  ├─ alerts.ts                    ← 6-type alert engine + Web Audio + Notification
  ├─ volume-profile.ts            ← Canvas VP (heatmap + HVN + POC/VAH/VAL)
  ├─ order-flow-overlay.ts        ← Canvas OF pills on NWE bands
  └─ snapshot.ts                  ← PNG export (compose 3 panes + overlays)

docs/deepbook/btc/
  ├─ README.md                    ← Index
  ├─ SESSION-CONTEXT.md           ← This file
  ├─ overview.md                  ← Architecture, render flow, data flow
  ├─ features.md                  ← 9 features documented
  ├─ alerts.md                    ← Alert engine spec
  ├─ storage.md                   ← Config schema + throttle + import/export
  ├─ volume-profile.md            ← VP renderer spec
  ├─ order-flow-overlay.md        ← OF overlay spec
  ├─ snapshot.md                  ← PNG export spec
  └─ styling.md                   ← Design tokens + taste rules
```

---

## Quyết định quan trọng đã đưa ra

| Decision | Rationale |
|----------|-----------|
| lightweight-charts via CDN (not npm) | Giữ vendor bundle nhẹ, nhất quán với file gốc `btc-chart-pro-v3.html` |
| Shadow DOM scoped plugin | Theo plugin architecture của project (ShadowContainer) |
| CSS flex ratios cho panes (7/1.5/1.5) | Tránh JS set inline pixel heights → root cause của footer bị mất |
| `position: absolute; inset: 0` trên `.btc-chart` | Escape mount-point div của ShadowContainer (không có chiều cao) |
| OF overlay trên NWE bands (không phải wick) | User request — signals hiện trên indicator đã trigger chúng |
| Bỏ Minimal mode | User feedback — layout không tốt, không cần |
| Locked 4-color palette (up/dn/neu/hi) | Taste skill — tránh TradingView default rainbow |
| No emoji in panel titles | Taste skill — plain uppercase mono labels |
| Throttled localStorage (250ms) | Zoom pan fires 60fps → throttle tránh jank |
| `fitContent()` chỉ 1 lần | Tránh clobber user zoom mỗi khi renderData chạy |

---

## Bugs / Issues đã biết

| Issue | Severity | Notes |
|-------|----------|-------|
| `setVolume` unused warning | Low | Reserved cho future volume slider UI |
| react-doctor advisory | Low | File plugin.tsx lớn (~1600 lines), có thể split components |
| VP canvas height khi first paint | Low | ResizeObserver + rAF sync handles it, nhưng có thể flash 1 frame |
| OF pills overlap khi quá nhiều signals cluster | Low | Max 5 stack rows, sau đó tolerate |
| `tsc -b` fails (pre-existing) | N/A | Lỗi ở sui-create-wallet, polymarket, marketplace — không liên quan |

---

## Backlog / Có thể làm tiếp

| Feature | Priority | Notes |
|---------|----------|-------|
| Volume slider UI cho alert sound | Low | `setVolume` callback đã có, chỉ cần input range |
| Split plugin.tsx thành sub-components | Medium | Header, Toolbar, Sidebar panels → separate files |
| VPVR (Visible Range VP) | Medium | Clip candles theo visible time range thay vì last 300 |
| LVN markers | Low | Bins ≤ 20% maxVol → outline mờ |
| Naked POC | Low | POC từ session trước chưa được touch |
| OF cluster grouping | Low | 3+ signals trong 5 candles → gộp thành "×N" |
| OF ratio threshold slider | Low | Nâng từ 1.5× lên 2.0× qua UI |
| Multi-symbol support | Medium | Dropdown chọn pair (ETH, SOL, etc.) |
| Dark/light theme toggle | Low | Hiện chỉ dark |
| Watermark trên PNG snapshot | Low | Brand text hoặc timestamp |
| Alert history log (persist) | Low | Lưu last 50 fired alerts vào localStorage |
| WebSocket reconnect logic | Medium | Auto-reconnect sau 5s khi WS close unexpected |

---

## Commands

```bash
# Dev
bun run dev
# → http://localhost:5173/btc-chart.html

# Build (skip tsc nếu pre-existing errors block)
bunx vite build

# Lint
bun run lint

# Check diagnostics (IDE)
# → plugins/btc-chart/plugin.tsx should show 0 errors, 1 warning (setVolume)
```

---

## Conventions

- **Package manager**: `bun` / `bunx` (not npm/pnpm)
- **Commit style**: conventional commits, scope `btc-chart`
- **CSS**: BEM-like `.btc-chart__*`, no global selectors, no inline styles for layout
- **Colors**: locked palette only (`--up`, `--dn`, `--neu`, `--hi`, `--mint`, `--amber`)
- **No emoji** in UI labels/titles
- **Plugin contract**: `export default { name, version, styleUrls, init, mount, unmount }`
- **Version bump**: patch for fixes, minor for features

---

## Cách đọc code nhanh

1. Start từ `btc-chart.html` → `src/btc-chart/main.tsx` → `BtcChartPage.tsx`
2. Plugin entry: `plugins/btc-chart/plugin.tsx` → function `BtcChartView()`
3. State init: search `useMemo<ChartConfig>(() => loadConfig()` — đây là boot point
4. Chart setup: search `useEffect` với comment `Setup charts (once)`
5. Data flow: search `renderData` — đây là nơi tính toàn bộ indicators
6. WS handler: search `ws.onmessage` — live tick + alert evaluation
7. Sidebar JSX: search `btc-chart__sidebar` — tất cả panels
8. Toolbar JSX: search `btc-chart__toolbar` — indicator toggles + utilities
