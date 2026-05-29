# NAVI Chatbot & Analysis — Technical Reference

> Hai plugin mới mở rộng NAVI ecosystem: chatbot conversational và real-time analysis engine.
>
> See also: [[defi/navi/TECHNICAL|NAVI Technical]] · [[defi/navi/MCP-REFERENCE|MCP Reference]] · [[wasm-native|WASM Native]]

---

## sui-navi-chatbot

Chat-based DeFi advisor. User hỏi bằng tiếng Việt/Anh, bot gọi MCP tools và trả lời.

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

`navi_get_coins` trả `{ coinType, totalBalance }` — không có symbol/decimals/price. Plugin resolve bằng:

1. Fetch `navi_get_pools` → build `poolMap[normalizedCoinType] = { symbol, price }`
2. Normalize coinType: `0x000...002::sui::SUI` → `0x2::sui::SUI`
3. Lookup decimals từ `KNOWN_DECIMALS` map
4. Tokens không có trong pools → `navi_search_tokens` per-symbol (max 5 parallel)

### Copyable Addresses

- Header wallet: click to copy, green flash feedback
- Chat messages: `\`0x...\`` auto-detected → clickable, copy to clipboard

---

## sui-navi-analysis

Real-time pool analysis engine. Auto-refresh 15s. WASM-accelerated computation.

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

Footer hiển thị engine status:
- `WASM 120ms init` (green) — Rust engine loaded
- `TS fallback` (yellow) — WASM unavailable
- `0.3ms compute` (purple) — per-refresh computation time

---

## sui-navi-advisor Updates

### Swap Options (khi wallet thiếu target token)

Khi strategy recommend "Supply NS" nhưng wallet chỉ có SUI/USDC:

1. Check `held.usdValue >= budget * 0.5` (không chỉ check tồn tại)
2. Hiện multi-select token buttons: `[USDC ($85)] [SUI ($3)]`
3. Fetch swap quotes song song từ NAVI MCP
4. Hiện human-readable amounts: `USDC: 20.00 → 261.74 WAL`
5. Click → redirect NAVI app swap page

### Vault Target Token

Extract từ vault name: `"WAL MASTER#1".split(/\s/)[0]` → `"WAL"`

### Coin Resolution

Same fix as chatbot: `resolveCoinsWithPools()` cross-reference raw MCP data với pool prices.

### Double `0x` Bug Fix

`NAVI_POOL_CFG` types đã có `0x` prefix. Code cũ thêm `` `0x${cfg.type}` `` → `0x0x356a...`. Fixed tất cả 6 chỗ.
