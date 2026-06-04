---
tags: [navi, mcp, roadmap, expansion, tools]
aliases: [NAVI MCP Expansion, MCP Roadmap]
---

# NAVI MCP — Expansion Roadmap

> The project currently uses **7/37 tools**. Another 30 tools remain unused.
>
> See also: [[defi/navi/MCP-REFERENCE|Full Tool Reference]] · [[defi/navi/ADVISOR|Advisor Technical]] · [[defi/navi/TECHNICAL|Plugin Technical]]

## Current Usage (7/37)

| Tool | Plugin | Purpose |
|------|--------|---------|
| `navi_get_pools` | dashboard + advisor | Pool APYs, TVL |
| `volo_get_vaults` | advisor | Vault APYs (CSV) |
| `navi_get_protocol_stats` | dashboard | TVL, users, utilization |
| `navi_get_swap_quote` | dashboard | DEX aggregator quote |
| `navi_get_health_factor` | advisor v2 | Liquidation risk alert |
| `navi_get_coins` | advisor v2 | Idle asset detection |
| `navi_get_available_rewards` | advisor v2 | Unclaimed rewards |

## Unused Tools by Group (30 remaining)

### Group 1: Portfolio Intelligence (3 tools) — HIGH VALUE

| Tool | Params | Returns | Plugin Idea |
|------|--------|---------|-------------|
| `navi_get_portfolio_pnl` | `{ address, period }` | Net worth, cumulative PnL, chart data | PnL chart (1W/15D/1M) trong advisor hoặc dashboard |
| `get_positions` | `{ address }` | Positions across **all protocols** (NAVI, Suilend, Walrus, Cetus...) | Multi-protocol position aggregator |
| `navi_get_lending_rewards` | `{ address }` | Claimed reward history | Reward tracking timeline |

**Impact:** This would turn the advisor into a full portfolio manager.
`get_positions` is especially strong because it covers multiple protocols, not
just NAVI.

### Group 2: Cross-chain Bridge — Astros (5 tools) — HIGH VALUE

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_bridge_chains` | none | Supported chains (Ethereum, Solana, Arbitrum, BSC...) |
| `navi_search_bridge_tokens` | `{ chain? }` | Bridgeable tokens per chain |
| `navi_get_bridge_quote` | `{ fromChain, toChain, token, amount }` | Quote: fees, estimated time, route |
| `navi_get_bridge_tx_status` | `{ txHash }` | Real-time status (processing/completed/failed) |
| `navi_get_bridge_history` | `{ address }` | Wallet's bridge transaction history |

**Plugin: `sui-navi-bridge`**
- Chain selector → token selector → amount → quote
- Submit bridge (requires Astros SDK or direct contract calls)
- Track pending bridges real-time
- History list

### Group 3: Volo Vault Analytics (9 tools) — MEDIUM VALUE

| Tool | Params | Returns |
|------|--------|---------|
| `volo_get_vault` | `{ vaultId }` | Full vault detail (JSON, not CSV) |
| `volo_get_vault_apy_history` | `{ vaultId, period? }` | APY data points over time |
| `volo_get_vault_share_price_history` | `{ vaultId, period? }` | Share price trend |
| `volo_get_vault_tvl_history` | `{ vaultId, period? }` | TVL history per vault |
| `volo_get_vault_system_summary` | none | Platform total TVL + revenue |
| `volo_get_vault_total_tvl_history` | `{ period? }` | Combined TVL all vaults |
| `volo_get_vault_user_positions` | `{ address }` | User positions per vault |
| `volo_get_vault_user_status` | `{ address }` | Total deposited + lifetime yield |
| `volo_get_vault_user_transactions` | `{ address, page? }` | Stake/unstake history |

**Plugin: `sui-navi-volo`**
- Vault list with APY/TVL
- Click vault → APY chart + TVL chart (CSS sparkline)
- User positions + earnings
- Compare vaults side-by-side
- Stake/unstake history

### Group 4: DCA Orders (3 tools) — MEDIUM VALUE

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_dca_orders` | `{ address, page?, status? }` | User's DCA orders with pagination |
| `navi_get_dca_order_details` | `{ orderId }` | Single order + execution history |
| `navi_list_dca_orders` | `{ status?, creator? }` | Browse all DCA orders |

**Plugin: `sui-navi-dca`**
- Active orders list
- Execution history per order
- Performance: avg buy price vs current price
- Status filter (active/completed/cancelled)

### Group 5: Advanced Market Data (5 tools) — LOW-MEDIUM VALUE

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_pool` | `{ identifier }` | Single pool deep-dive: contract addresses, rate factors, EModes |
| `navi_get_market_config` | none | Markets, EModes, supported assets |
| `navi_get_price_feeds` | none | Oracle configs (Pyth feed IDs, Supra pair IDs) |
| `navi_get_flash_loan_assets` | none | Flash loan availability + max amounts + fee rates |
| `navi_get_flash_loan_asset` | `{ identifier }` | Single flash loan asset detail |

**Use in:** Dashboard pool detail view, flash loan explorer, oracle monitor.

### Group 6: Fee Analytics (2 tools) — LOW VALUE

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_borrow_fee` | `{ address?, asset?, market? }` | Borrow fee rate (global or per-user) |
| `navi_get_fees` | none | Fee breakdown: total, v3 borrow, interest, flash loan, liquidation |

**Use in:** Dashboard fee tab, advisor cost calculation.

### Group 7: Transaction Intelligence (1 tool unused)

| Tool | Params | Returns |
|------|--------|---------|
| `sui_get_transaction` | `{ digest }` | Raw transaction data (already have `sui_explain_transaction`) |

**Use in:** Dashboard tx tab — show raw + explained side-by-side.

### Group 8: Token Search (already exported, not used in UI)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_search_tokens` | `{ keyword }` | Price, decimals, coinType, symbol |

**Use in:** Advisor — resolve token symbols to coinTypes for non-standard tokens.

---

## Expansion Priority

### Phase 1: Enhance Existing (0 new plugins, +3 tools) ✅ DONE
- ✅ `navi_get_health_factor` → advisor health alert
- ✅ `navi_get_coins` → idle asset detection
- ✅ `navi_get_available_rewards` → claim rewards suggestion

### Phase 2: Portfolio Deep-dive (+3 tools)
- `navi_get_portfolio_pnl` → PnL chart in advisor
- `get_positions` → multi-protocol position view
- `navi_get_lending_rewards` → reward history

**Effort:** ~200 LOC, enhance advisor + dashboard

### Phase 3: Volo Vault Plugin (+9 tools, 1 new plugin)
- Full vault analytics dashboard
- APY/TVL charts
- User positions + earnings

**Effort:** ~400 LOC new plugin

### Phase 4: Bridge Plugin (+5 tools, 1 new plugin)
- Cross-chain bridge UI
- Quote + track + history

**Effort:** ~500 LOC new plugin (+ bridge SDK for execution)

### Phase 5: DCA Plugin (+3 tools, 1 new plugin)
- DCA order management

**Effort:** ~300 LOC new plugin

### Phase 6: Market Deep-dive (+5 tools)
- Pool detail view, flash loan explorer, oracle monitor

**Effort:** ~200 LOC, enhance dashboard

---

## Tool Usage Projection

| Phase | Tools Used | Total | Coverage |
|-------|-----------|-------|----------|
| Current | 7 | 7/37 | 19% |
| Phase 2 | +3 | 10/37 | 27% |
| Phase 3 | +9 | 19/37 | 51% |
| Phase 4 | +5 | 24/37 | 65% |
| Phase 5 | +3 | 27/37 | 73% |
| Phase 6 | +5 | 32/37 | 86% |
| Remaining | +5 (fees, raw tx, token search, borrow fee) | 37/37 | 100% |
