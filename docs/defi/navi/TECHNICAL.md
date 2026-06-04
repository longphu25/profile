---
tags: [navi, defi, mcp, lending, volo, advisor]
aliases: [NAVI Technical, NAVI Dashboard]
---

# NAVI Protocol Dashboard — Technical Reference

DeFi dashboard plugin for NAVI Protocol on Sui, powered by NAVI MCP
(Model Context Protocol).

> See also: [[seal/TECHNICAL|Seal Plugins]] · [[deepbook/README|DeepBook]] · [[walrus/integration|Walrus]]

## MCP Endpoint

```
URL:    https://open-api.naviprotocol.io/api/mcp
Auth:   None (public, free)
Mode:   Read-only — no signing, no transaction execution
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

The plugin calls the MCP server directly from the browser, so it does not need
any backend or proxy.

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

The response is always wrapped in `content[0].text` as a JSON string, so it
must be parsed twice.

## Available Tools (37 total)

### Used in the plugin (10)

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

### Not used yet — extension candidates

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
- Auto-loads when the tab opens
- Shows 5 stats: TVL, Total Borrow, Utilization, Max APY, Users
- Grid layout responsive

### Pools
- Loads all pools from `navi_get_pools`
- Sortable: TVL (default), Supply APY, Borrow APY
- Each pool card shows symbol, TVL, supply/borrow rates, and LTV
- Color-coded: green = supply, red = borrow

### Portfolio
- Requires a wallet address (from shared `walletProfile` data)
- Parallel fetch: coins + health factor + rewards
- Health factor indicator: green (safe) / red (danger ≤ 1.2)
- Coin list filtered by usdValue > $0.01
- Rewards are shown as raw JSON (the structure varies)

### Swap Quote
- Read-only — quote only, no execution
- Input: amount, from symbol, to symbol
- Calls `navi_get_swap_quote` — DEX aggregator route
- Output: raw JSON (route, priceImpact, amounts)

### Tx Explain
- Input: transaction digest
- Calls `sui_explain_transaction`
- Output: human-readable explanation (raw JSON)

## Plugins

### sui-navi-dashboard (5 tabs)
General dashboard: Overview, Pools, Portfolio, Swap Quote, Tx Explain.

### sui-navi-advisor (Strategy Advisor) 

Input a USD budget, fetch real-time pool APYs plus Volo vault yields, then
generate and rank yield strategies.

**Data Sources:**

| MCP Tool | Data |
|----------|------|
| `navi_get_pools` | Supply/Borrow APY, LTV for each asset |
| `volo_get_vaults` | Vault APY (7d, 30d), TVL, risk level (CSV format) |

**5 Strategy Types:**

| # | Strategy | Risk | Logic |
|---|----------|------|-------|
| 1 | Best Supply | Low | Deposit fully into the pool with the highest supply APY |
| 2 | Best Volo Vault | Low-Med | Pick the vault with the highest 7d APY |
| 3 | Supply + Borrow Loop | Medium | Supply SUI → borrow stable at 50% LTV → re-deposit. Net APY = supply - (borrow × LTV) |
| 4 | Stable Vault | Low | Stablecoin vault (MMT) — lowest IL risk |
| 5 | Diversified Top 3 | Low | Split the budget evenly across the top 3 APY pools |

Output is ranked by APY, with step-by-step actions, risk color coding, and
estimated yearly earnings.

**Execute buttons:** Every strategy includes an action button in one of 4 forms:

| Action | Button | Tokens | Method |
|--------|--------|--------|--------|
| `deposit` | Green | SUI, WAL, DEEP, NAVX, ... (18 tokens) | `incentive_v3::entry_deposit` — SUI uses `splitCoins(gas)`, non-SUI uses `suix_getCoins` → merge → split |
| `volo-stake` | Green | SUI → vSUI | `stake_pool::stake` |
| `supply-borrow` | Yellow | Supply SUI + Borrow stablecoin | 1 PTB: `entry_deposit` + `borrow_v2` + `coin::from_balance` + transfer |
| `link` | Blue ↗ | Stable vault, diversified | Open NAVI app (earn / lending page) |

> See [[defi/navi/MCP-REFERENCE|MCP Reference]] for full contract addresses, pool configs, and Move call patterns.

**Why not use `@naviprotocol/lending`?** The newer SDK imports `SuiClient`
from `@mysten/sui/client`, which is incompatible with this project using
`@mysten/sui` v2 (`SuiGrpcClient`). The plugin builds raw `moveCall`
transactions directly with addresses extracted from the navi-sdk source.

**Volo CSV parsing:** MCP returns vaults as CSV, so the plugin parses headers
and rows, then filters `status === 'open'`.

## Potential Extensions

| Plugin | MCP Tools | Description |
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

- The MCP server can sometimes rate-limit address-based queries; a retry
  usually fixes it.
- Response format: data is wrapped inside `content[0].text` (MCP spec), so it
  requires a double JSON parse. If parsing fails, return the raw text.
- Swap quote params: `fromCoin`, `toCoin` (camelCase), `amount` (number)
- `volo_get_vaults` returns CSV, not JSON
- `getPositions` returns positions across multiple protocols (NAVI, Suilend,
  Walrus, etc.), not just NAVI
- `healthFactor` can be null when the user has no lending position
