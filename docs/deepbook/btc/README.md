# BTC Chart Pro — Documentation

Documentation for the `btc-chart.html` page and the `plugins/btc-chart/`
plugin in the profile project.

Market data comes from **Binance Spot REST + WebSocket** (free, no API key
required). The chart engine is `lightweight-charts@4.2.0` loaded from CDN. The
entire UI renders inside **Shadow DOM** according to the profile plugin
contract.

---

## Table of Contents

| File | Contents |
|------|---------|
| [SESSION-CONTEXT.md](SESSION-CONTEXT.md) | **Start here** — status, file map, decisions, bugs, backlog |
| [overview.md](overview.md) | Architecture overview, file layout, render flow, data flow |
| [features.md](features.md) | 9 main features: chart, indicators, alerts, sound, snapshot, persistence |
| [alerts.md](alerts.md) | Alert engine — 6 kinds, evaluation logic, sound, browser notifications |
| [storage.md](storage.md) | Config v1 schema, throttling, JSON import/export, migration |
| [volume-profile.md](volume-profile.md) | VP renderer — bins, POC/VAH/VAL, HVN, heatmap |
| [order-flow-overlay.md](order-flow-overlay.md) | Order-flow pill overlay — gutter bands, leader lines, anti-collision |
| [snapshot.md](snapshot.md) | PNG export — `takeScreenshot()` + canvas composition |
| [styling.md](styling.md) | Design tokens, color palette, taste rules, layout discipline |

---

## Quick Start

```bash
# 1. Start the project dev server
bun run dev

# 2. Open the page
open http://localhost:5173/btc-chart.html
```

If port 5173 is already in use, Vite will automatically switch to 5174/5175.
Check the dev-server log.

---

## Source Layout

```text
btc-chart.html              # HTML entry — loads lightweight-charts CDN
src/btc-chart/
  ├─ main.tsx               # React bootstrap
  ├─ BtcChartPage.tsx       # Wrapper page, mounts plugin inside Shadow DOM
  └─ btc-chart.css          # Design tokens + page-level layout
plugins/btc-chart/
  ├─ plugin.tsx             # Plugin entry, main React component
  ├─ style.css              # Scoped Shadow DOM styles (.btc-chart__*)
  ├─ storage.ts             # localStorage + JSON I/O
  ├─ alerts.ts              # Alert engine + Web Audio + Notification API
  ├─ volume-profile.ts      # Canvas VP renderer (heatmap + HVN)
  ├─ order-flow-overlay.ts  # Canvas OF pill overlay (gutter bands)
  └─ snapshot.ts            # PNG export (composes 3 panes + VP + OF overlays)
```

---

## Relationship to the Plugin Host

| Mode | Behavior |
|------|----------|
| Standalone (`btc-chart.html`) | `BtcChartPage` mounts Shadow DOM and uses the normal `hostAPI` |
| Plugin demo (`plugin-demo.html`) | Not registered yet; can be added to `AVAILABLE_PLUGINS` if needed |
| SUI Dashboard (`sui-plugin.html`) | Not registered yet; the plugin does not need a wallet, so shared mode is straightforward |

The plugin exports the `BtcChart` component through
`host.registerComponent('BtcChart', …)` and does not depend on DAppKit.

---

## External Dependencies

| Package | Loading mode | Reason |
|---------|----------|------|
| `lightweight-charts@4.2.0` | CDN `<script>` in `btc-chart.html` | Already used by the original `btc-chart-pro-v3.html`; avoids adding a heavier Vite vendor chunk |
| Binance REST `api.binance.com` | Runtime `fetch` | Klines + 24h ticker, no API key |
| Binance Futures REST `fapi.binance.com` | Runtime `fetch` | Funding rate |
| Alternative.me `api.alternative.me/fng/` | Runtime `fetch` | Fear & Greed index |
| Binance WS `wss://stream.binance.com:9443` | `WebSocket` | Live kline stream |

---

## Build / Verify

```bash
# Production bundle
bun run build

# Lint
bun run lint
```

The plugin has its own entry in `vite.config.ts -> build.rollupOptions.input`:

```ts
'plugins/btc-chart': resolve(__dirname, 'plugins/btc-chart/plugin.tsx')
```

Build output: `dist/assets/plugins/btc-chart.js` (lazy-loaded when the page
mounts).

---

## Related

- Plugin contract: [`docs/plugin-architecture.md`](../../plugin-architecture.md)
- Design system: [`DESIGN.md`](../../../DESIGN.md), Pro Max steering
- Original reference chart: `btc-chart-pro-v3.html` (plain HTML, no bundling)
