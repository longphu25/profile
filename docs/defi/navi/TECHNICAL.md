---
tags: [navi, defi, mcp, lending, volo, advisor]
aliases: [NAVI Technical, NAVI Dashboard]
---

# NAVI Protocol Dashboard — Technical Reference

Plugin DeFi dashboard cho NAVI Protocol trên Sui, powered by NAVI MCP (Model Context Protocol).

> See also: [[seal/TECHNICAL|Seal Plugins]] · [[deepbook/README|DeepBook]] · [[walrus/integration|Walrus]]

## MCP Endpoint

```
URL:    https://open-api.naviprotocol.io/api/mcp
Auth:   None (public, free)
Mode:   Read-only — không sign, không execute transaction
Proto:  JSON-RPC 2.0 over Streamable HTTP
```

## Architecture

```
┌──────────────────────────────────────┐
│ sui-navi-dashboard plugin            │
│                                      │
│  navi-api.ts                         │
│    │  fetch() → JSON-RPC 2.0        │
│    ▼                                 │
│  NAVI MCP Server                     │
│  https://open-api.naviprotocol.io    │
│    │                                 │
│    ├── navi_get_protocol_stats       │
│    ├── navi_get_pools                │
│    ├── navi_get_health_factor        │
│    ├── navi_get_coins                │
│    ├── navi_get_available_rewards    │
│    ├── navi_get_swap_quote           │
│    ├── sui_explain_transaction       │
│    └── ... (37 tools total)          │
└──────────────────────────────────────┘
```

Plugin gọi MCP server trực tiếp từ browser — không cần backend, không cần proxy.

## MCP Call Pattern

Mỗi tool call là một JSON-RPC request:

```ts
// navi-api.ts
const res = await fetch('https://open-api.naviprotocol.io/api/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: ++reqId,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  }),
})
const json = await res.json()
// Response: { result: { content: [{ type: "text", text: "{...json...}" }] } }
return JSON.parse(json.result.content[0].text)
```

Response luôn wrap trong `content[0].text` dưới dạng JSON string — cần parse 2 lần.

## Available Tools (37 total)

### Đang dùng trong plugin (10)

| Tool | Tab | Params | Returns |
|------|-----|--------|---------|
| `navi_get_protocol_stats` | Overview | none | `{ tvl, totalBorrowUsd, averageUtilization, maxApy, userAmount }` |
| `navi_get_pools` | Pools | none | `Pool[]` — symbol, supplyApy, borrowApy, tvl, ltv, oraclePrice |
| `navi_get_health_factor` | Portfolio | `{ address }` | `{ healthFactor, totalSupplyUsd, totalBorrowUsd }` |
| `navi_get_coins` | Portfolio | `{ address }` | `CoinBalance[]` — coinType, symbol, balance, usdValue |
| `navi_get_available_rewards` | Portfolio | `{ address }` | Unclaimed lending rewards by asset |
| `navi_get_swap_quote` | Swap | `{ from_coin_type, to_coin_type, amount }` | Quote with route, priceImpact, toAmount |
| `sui_explain_transaction` | Tx | `{ digest }` | Human-readable transaction explanation |
| `navi_search_tokens` | (API only) | `{ keyword }` | Token info — price, decimals, coinType |
| `getPositions` | (API only) | `{ address }` | Multi-protocol DeFi positions |
| `volo_get_vaults` | (API only) | none | VOLO yield vaults list |

### Chưa dùng — có thể mở rộng

| Category | Tools | Use Case |
|----------|-------|----------|
| **Pool detail** | `navi_get_pool` | Single pool deep-dive |
| **Market config** | `navi_get_market_config` | Supported assets, EModes |
| **Price feeds** | `navi_get_price_feeds` | Oracle Pyth/Supra feed IDs |
| **Flash loans** | `navi_get_flash_loan_assets`, `navi_get_flash_loan_asset` | Flash loan availability |
| **Lending rewards** | `navi_get_lending_rewards` | Claimed reward history |
| **Bridge** | `navi_get_bridge_chains`, `navi_search_bridge_tokens`, `navi_get_bridge_quote`, `navi_get_bridge_tx_status`, `navi_get_bridge_history` | Cross-chain bridge (Astros) |
| **DCA** | `navi_get_dca_orders`, `navi_get_dca_order_details`, `navi_list_dca_orders` | Dollar-cost averaging orders |
| **Volo Vaults** | `volo_get_vault`, `volo_get_vault_apy_history`, `volo_get_vault_share_price_history`, `volo_get_vault_tvl_history`, `volo_get_vault_system_summary`, `volo_get_vault_total_tvl_history`, `volo_get_vault_user_positions`, `volo_get_vault_user_status`, `volo_get_vault_user_transactions` | Yield vault analytics |
| **Fees** | `navi_get_borrow_fee`, `navi_get_fees` | Protocol fee breakdown |
| **PnL** | `navi_get_portfolio_pnl` | Portfolio profit & loss |
| **Tx raw** | `sui_get_transaction` | Raw transaction data |

## Plugin Tabs

### Overview
- Auto-load khi mở tab
- Hiển thị 5 stats: TVL, Total Borrow, Utilization, Max APY, Users
- Grid layout responsive

### Pools
- Load tất cả pools từ `navi_get_pools`
- Sortable: TVL (default), Supply APY, Borrow APY
- Mỗi pool card: symbol, TVL, supply/borrow rates, LTV
- Color-coded: green = supply, red = borrow

### Portfolio
- Cần wallet address (từ `walletProfile` shared data)
- Parallel fetch: coins + health factor + rewards
- Health factor indicator: green (safe) / red (danger ≤ 1.2)
- Coin list filtered by usdValue > $0.01
- Rewards hiển thị raw JSON (structure varies)

### Swap Quote
- Read-only — chỉ quote, không execute
- Input: amount, from symbol, to symbol
- Gọi `navi_get_swap_quote` — DEX aggregator route
- Output: raw JSON (route, priceImpact, amounts)

### Tx Explain
- Input: transaction digest
- Gọi `sui_explain_transaction`
- Output: human-readable explanation (raw JSON)

## Plugins

### sui-navi-dashboard (5 tabs)
Dashboard tổng quan: Overview, Pools, Portfolio, Swap Quote, Tx Explain.

### sui-navi-advisor (Strategy Advisor) 

Nhập budget (USD) → fetch real-time pool APYs + Volo vault yields → generate và rank chiến lược sinh lời.

**Data Sources:**

| MCP Tool | Data |
|----------|------|
| `navi_get_pools` | Supply/Borrow APY, LTV cho mỗi asset |
| `volo_get_vaults` | Vault APY (7d, 30d), TVL, risk level (CSV format) |

**5 Strategy Types:**

| # | Strategy | Risk | Logic |
|---|----------|------|-------|
| 1 | Best Supply | Low | Pool có supply APY cao nhất → deposit toàn bộ |
| 2 | Best Volo Vault | Low-Med | Vault có 7d APY cao nhất |
| 3 | Supply + Borrow Loop | Medium | Supply SUI → borrow stable ở 50% LTV → re-deposit. Net APY = supply - (borrow × LTV) |
| 4 | Stable Vault | Low | Stablecoin vault (MMT) — lowest IL risk |
| 5 | Diversified Top 3 | Low | Chia đều budget cho 3 pools APY cao nhất |

Output: ranked by APY, step-by-step, risk color-coded, estimated yearly earnings.

**Execute buttons:** Tất cả strategies có nút action — 3 loại:

| Action | Button | Tokens | Method |
|--------|--------|--------|--------|
| `deposit` | Green | SUI, WAL, DEEP, NAVX, ... (18 tokens) | `incentive_v3::entry_deposit` — SUI dùng `splitCoins(gas)`, non-SUI dùng `suix_getCoins` → merge → split |
| `volo-stake` | Green | SUI → vSUI | `stake_pool::stake` |
| `supply-borrow` | Yellow | Supply SUI + Borrow stablecoin | 1 PTB: `entry_deposit` + `borrow_v2` + `coin::from_balance` + transfer |
| `link` | Blue ↗ | Stable vault, diversified | Open NAVI app (earn / lending page) |

> See [[defi/navi/MCP-REFERENCE|MCP Reference]] for full contract addresses, pool configs, and Move call patterns.

**Tại sao không dùng `@naviprotocol/lending` SDK?** SDK mới import `SuiClient` từ `@mysten/sui/client` — không tương thích với project này dùng `@mysten/sui` v2 (`SuiGrpcClient`). Build raw `moveCall` trực tiếp với addresses từ navi-sdk source.

**Volo CSV parsing:** MCP trả vaults dạng CSV — plugin parse headers + rows, filter `status === 'open'`.

## Potential Extensions

| Plugin | MCP Tools | Mô tả |
|--------|-----------|-------|
| `sui-navi-bridge` | `navi_get_bridge_*` (5 tools) | Cross-chain bridge UI |
| `sui-navi-volo` | `volo_*` (10 tools) | Volo Vault analytics dashboard |
| `sui-navi-dca` | `navi_get_dca_*` (3 tools) | DCA order management |
| `sui-navi-pnl` | `navi_get_portfolio_pnl` | Portfolio P&L tracker |

## Files

```
plugins/
├── sui-navi-dashboard/
│   ├── navi-api.ts    # MCP client — shared by both plugins
│   ├── plugin.tsx     # Dashboard UI (5 tabs)
│   └── style.css
└── sui-navi-advisor/
    ├── plugin.tsx     # Strategy engine + UI
    └── style.css
```

## Notes

- MCP server đôi khi rate-limit address-based queries — retry thường fix
- Response format: data wrap trong `content[0].text` (MCP spec) — cần double-parse JSON; nếu parse fail thì trả raw text
- Swap quote params: `fromCoin`, `toCoin` (camelCase), `amount` (number)
- `volo_get_vaults` trả CSV không phải JSON
- `getPositions` trả về positions across multiple protocols (navi, suilend, walrus…) không chỉ NAVI
- `healthFactor` có thể null nếu user chưa có lending position
