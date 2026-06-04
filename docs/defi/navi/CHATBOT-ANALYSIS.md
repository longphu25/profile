# NAVI Chatbot & Analysis — Technical Reference

> Two newer plugins extend the NAVI ecosystem: a conversational chatbot and a
> real-time analysis engine.
>
> See also: [[defi/navi/TECHNICAL|NAVI Technical]] · [[defi/navi/MCP-REFERENCE|MCP Reference]] · [[wasm-native|WASM Native]]

---

## sui-navi-chatbot

Chat-based DeFi advisor. Users can ask in Vietnamese or English, and the bot
will call MCP tools before answering.

### Intent Detection

| Keyword | Intent | MCP Tool |
|---------|--------|----------|
| `wallet`, `ví`, `balance` | wallet_summary | `navi_get_coins` + pool price resolve |
| `yield`, `apy`, `earn`, `gửi` | best_yield | `navi_get_pools` + wallet match |
| `health`, `rủi ro`, `thanh lý` | health_check | `navi_get_health_factor` |
| `reward`, `thưởng` | rewards | `navi_get_available_rewards` |
| `swap X to Y` | swap_quote | `navi_get_swap_quote` |
| `pool`, `market` | pool_info | `navi_get_pools` |
| `bridge` | bridge | `navi_get_bridge_chains` |
| `position`, `vị thế` | positions | `get_positions` |

### Token Resolution Bug Fix

`navi_get_coins` returns `{ coinType, totalBalance }` without symbol, decimals,
or price. The plugin resolves that by:

1. Fetch `navi_get_pools` → build `poolMap[normalizedCoinType] = { symbol, price }`
2. Normalize coinType: `0x000...002::sui::SUI` → `0x2::sui::SUI`
3. Lookup decimals từ `KNOWN_DECIMALS` map
4. For tokens missing from pools, call `navi_search_tokens` per symbol (max 5 in parallel)

### Copyable Addresses

- Header wallet: click to copy, with green flash feedback
- Chat messages: `\`0x...\`` are auto-detected, become clickable, and copy to clipboard

---

## sui-navi-analysis

Real-time pool analysis engine. Auto-refreshes every 15s. Uses
WASM-accelerated computation when available.

### Architecture

```
┌─────────────────────────────────────────┐
│  plugin.tsx (React UI)                  │
│  ├── fetchPools() ─── NAVI MCP         │
│  ├── fetchVaults() ── NAVI MCP         │
│  ├── fetchScallopPools() ── Scallop API│
│  └── buildSnapshot() or wasmAnalyze()  │
│       ├── WASM path (Rust, 128KB)      │
│       └── TS fallback (analysis.ts)    │
└─────────────────────────────────────────┘
```

### 4 Tabs

| Tab | Data | Refresh |
|-----|------|---------|
| Best Yields | NAVI supply + Volo vaults + Scallop supply + loop strategies | 15s |
| Pools | Top Supply APY, Cheapest Borrow, Highest TVL + utilization bars | 15s |
| Changes | Delta tracking: APY/price/TVL changes >0.5% between snapshots | 15s |
| My Wallet | Idle tokens → best supply match | 15s |

### Cross-Protocol (Scallop)

- API: `https://sdk.api.scallop.io/api/market/pools` (31 pools)
- APY format: decimal (0.05 = 5%) — convert `× 100` for display
- Opportunities tagged `[Scallop]` in ranking

### Analysis Engine (WASM-portable)

Pure functions in `analysis.ts`, mirrored in `wasm/src/lib.rs`:

| Function | Complexity | Purpose |
|----------|-----------|---------|
| `rankSupplyOpportunities` | O(n log n) | Sort pools by APY |
| `rankVaultOpportunities` | O(n log n) | Sort vaults by 7d APY |
| `findLoopOpportunities` | O(n²) | All supply+borrow pairs, net APY > 1% |
| `detectDeltas` | O(n) | Diff 2 snapshots, threshold 0.5% |
| `walletOpportunities` | O(n×m) | Match wallet coins to pools |

### WASM vs TS Performance

The footer shows engine status:
- `WASM 120ms init` (green) — Rust engine loaded
- `TS fallback` (yellow) — WASM unavailable
- `0.3ms compute` (purple) — per-refresh computation time

---

## sui-navi-advisor Updates

### Swap Options (when the wallet lacks the target token)

When a strategy recommends "Supply NS" but the wallet only holds SUI/USDC:

1. Check `held.usdValue >= budget * 0.5` (không chỉ check tồn tại)
2. Show multi-select token buttons: `[USDC ($85)] [SUI ($3)]`
3. Fetch swap quotes in parallel from NAVI MCP
4. Show human-readable amounts: `USDC: 20.00 → 261.74 WAL`
5. Click → redirect NAVI app swap page

### Vault Target Token

Extract từ vault name: `"WAL MASTER#1".split(/\s/)[0]` → `"WAL"`

### Coin Resolution

Same fix as chatbot: `resolveCoinsWithPools()` cross-references raw MCP data
with pool prices.

### Double `0x` Bug Fix

`NAVI_POOL_CFG` types already include the `0x` prefix. Older code added
`` `0x${cfg.type}` `` and produced `0x0x356a...`. This has been fixed in all 6
occurrences.
