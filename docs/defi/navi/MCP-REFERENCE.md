---
tags: [navi, mcp, api-reference, tools]
aliases: [NAVI MCP Reference, MCP Tools]
---

# NAVI MCP — Complete Reference

> See also: [[defi/navi/TECHNICAL|Plugin Technical]] · [[INDEX|Home]]

## Endpoint

```
URL:      https://open-api.naviprotocol.io/api/mcp
Protocol: JSON-RPC 2.0 over Streamable HTTP
Auth:     None
Cost:     Free
Mode:     Read-only (no signing, no tx execution)
```

## Call Pattern

```ts
// Initialize (once per session, optional)
{ method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "app", version: "1.0.0" } } }

// List all tools
{ method: "tools/list", params: {} }

// Call a tool
{ method: "tools/call", params: { name: "tool_name", arguments: { key: "value" } } }
```

### Response Format

```ts
// Success — data always in content[0].text as JSON string
{ result: { content: [{ type: "text", text: "{\"tvl\":272496267,...}" }] } }

// Error — text is NOT valid JSON
{ result: { content: [{ type: "text", text: "MCP error -32602: Invalid arguments..." }] } }
```

**Double-parse required:** `JSON.parse(response.result.content[0].text)`
**Safe parse:** try JSON.parse, fallback to raw text string

---

## All 37 Tools

### Protocol & Market (3)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_protocol_stats` | none | `{ tvl, totalBorrowUsd, averageUtilization, maxApy, userAmount, borrowFee, flashLoanFee }` |
| `navi_get_market_config` | none | `{ market, borrowFee, pools, emodes, availableMarkets }` |
| `navi_get_borrow_fee` | `{ address?, asset?, market? }` | Fee rate as number (e.g. 3 = 3%) |

### Pools (3)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_pools` | `{ markets? }` | `Pool[]` — **string fields**: symbol, coinType, price, supply, borrow, supplyApy, borrowApy, ltv, market |
| `navi_get_pool` | `{ identifier }` (symbol, coinType, or assetId) | Single pool with full detail including contract addresses |
| `navi_get_fees` | none | Fee breakdown: totalValue, v3BorrowFee, borrowInterestFee, flashloanFee |

**Important:** Pool fields `supply`, `borrow`, `supplyApy`, `borrowApy`, `price` are **strings**, not numbers. Must `Number()` parse.

### User Position & Health (4)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_health_factor` | `{ address }` | `{ healthFactor, totalSupplyUsd, totalBorrowUsd }` — **healthFactor can be null** |
| `navi_get_coins` | `{ address }` | `CoinBalance[]` — coinType, symbol, balance, usdValue |
| `get_positions` | `{ address }` | Multi-protocol positions (navi, suilend, walrus, etc.) |
| `navi_get_portfolio_pnl` | `{ address, period? }` | PnL data. period: `"1W"`, `"15D"`, `"1M"` |

### Rewards (2)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_available_rewards` | `{ address }` | Unclaimed rewards summary by asset |
| `navi_get_lending_rewards` | `{ address }` | Claimed reward history |

### Swap (1)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_swap_quote` | `{ fromCoin, toCoin, amount }` | Optimal route across Cetus, Turbos, DeepBook, Aftermath |

**Params:** `fromCoin`/`toCoin` = symbol ("SUI") or coinType. `amount` = **number** (human-readable, e.g. 1 for 1 SUI).

### Token Search (1)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_search_tokens` | `{ keyword }` | Token info: price, decimals, coinType, symbol |

### Flash Loans (2)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_flash_loan_assets` | none | All flash loan assets with max amounts and fee rates |
| `navi_get_flash_loan_asset` | `{ identifier }` | Single flash loan asset detail |

### Price Feeds (1)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_price_feeds` | none | Oracle configs: Pyth feed IDs, Supra pair IDs |

### Bridge — Astros (5)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_bridge_chains` | none | Supported chains (Sui, Ethereum, Solana, etc.) |
| `navi_search_bridge_tokens` | `{ chain? }` | Bridgeable tokens per chain |
| `navi_get_bridge_quote` | `{ fromChain, toChain, token, amount }` | Bridge quote with fees |
| `navi_get_bridge_tx_status` | `{ txHash }` | Bridge tx status (processing/completed/failed) |
| `navi_get_bridge_history` | `{ address }` | Wallet's bridge tx history |

### DCA (3)

| Tool | Params | Returns |
|------|--------|---------|
| `navi_get_dca_orders` | `{ address, page?, status? }` | User's DCA orders with pagination |
| `navi_get_dca_order_details` | `{ orderId }` | Single DCA order with execution history |
| `navi_list_dca_orders` | `{ status?, creator? }` | List DCA orders with filters |

### Volo Vaults (10)

| Tool | Params | Returns |
|------|--------|---------|
| `volo_get_vaults` | none | **CSV format** — id, name, protocol, status, riskLevel, instantAPR, apy7d, apy30d, totalStakedUsd, minInvestment |
| `volo_get_vault` | `{ vaultId }` | Full vault detail (JSON) |
| `volo_get_vault_apy_history` | `{ vaultId, period? }` | APY data points over time |
| `volo_get_vault_share_price_history` | `{ vaultId, period? }` | Share price history |
| `volo_get_vault_tvl_history` | `{ vaultId, period? }` | TVL history for single vault |
| `volo_get_vault_system_summary` | none | Platform-wide: total TVL, total revenue |
| `volo_get_vault_total_tvl_history` | `{ period? }` | TVL across all vaults combined |
| `volo_get_vault_user_positions` | `{ address }` | User's positions per vault |
| `volo_get_vault_user_status` | `{ address }` | Aggregated: total deposited, lifetime yield |
| `volo_get_vault_user_transactions` | `{ address, page? }` | Stake/unstake history |

**Important:** `volo_get_vaults` returns **CSV**, not JSON. Must parse manually.

### Transaction (2)

| Tool | Params | Returns |
|------|--------|---------|
| `sui_get_transaction` | `{ digest }` | Raw Sui transaction data |
| `sui_explain_transaction` | `{ digest }` | Human-readable explanation |

---

## Gotchas & Bugs Found

| Issue | Detail | Fix |
|-------|--------|-----|
| Pool fields are strings | `supplyApy: "7.432"` not `7.432` | `Number(p.supplyApy) \|\| 0` |
| No `tvl` field in pools | Only `supply`, `borrow`, `price` | Calculate: `tvl = Number(supply) * Number(price)` |
| `healthFactor` can be null | User has no lending position | Check `health.healthFactor != null` before `.toFixed()` |
| Swap params are camelCase | `fromCoin`, `toCoin` not `from_coin_type` | Match exact param names from `tools/list` schema |
| Swap `amount` is number | Not string | Pass `Number(amount)` not `String(amount)` |
| Volo vaults return CSV | Not JSON | Parse CSV: split lines, map headers to values |
| Error responses not JSON | `"MCP error -32602: ..."` | `try { JSON.parse(text) } catch { return text }` |
| Rate limiting | Address-based queries may timeout | Retry after a few seconds |

---

## NAVI Contract Addresses (Mainnet)

Used for direct `moveCall` transactions (bypassing NAVI SDK):

```ts
// Protocol
const NAVI_PROTOCOL_PKG = '0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0'
const NAVI_STORAGE      = '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe'
const NAVI_INCENTIVE_V2 = '0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c'
const NAVI_INCENTIVE_V3 = '0x62982dad27fb10bb314b3384d5de8d2ac2d72ab2dbeae5d801dbdb9efa816c80'
const NAVI_ORACLE       = '0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef'

// Volo Staking
const VOLO_PKG      = '0x68d22cf8bdbcd11ecba1e094922873e4080d4d11133e2443fddda0bfd11dae20'
const VOLO_POOL     = '0x2d914e23d82fedef1b5f56a32d5c64bdcc3087ccfea2b4d6ea51a71f587840e5'
const VOLO_METADATA = '0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60'
```

### Pool Configs (18 tokens)

| Symbol | assetId | poolId | decimals |
|--------|---------|--------|----------|
| SUI | 0 | `0x96df…958c5` | 9 |
| wUSDC | 1 | `0xa02a…e39c8` | 6 |
| USDT | 2 | `0x0e06…d103` | 6 |
| WETH | 3 | `0x71b9…b56` | 8 |
| CETUS | 4 | `0x3c37…1e2e` | 9 |
| vSUI | 5 | `0x9790…d01` | 9 |
| haSUI | 6 | `0x6fd9…57a` | 9 |
| NAVX | 7 | `0xc0e0…fa60` | 9 |
| nUSDC | 10 | `0xa358…55a8` | 6 |
| NS | 13 | `0x2fcc…80d4` | 6 |
| DEEP | 15 | `0x0837…e946` | 6 |
| suiUSDT | 19 | `0xa3e0…a9e2` | 6 |
| stSUI | 20 | `0x0bcc…51e2` | 9 |
| LBTC | 23 | `0x377b…de04` | 8 |
| WAL | 24 | `0xef76…e167` | 9 |
| HAEDAL | 25 | `0x930f…a6a` | 9 |
| IKA | 27 | `0x3566…ee8d` | 9 |

### Move Call Patterns

**Deposit (any token):**
```ts
tx.moveCall({
  target: `${NAVI_PROTOCOL_PKG}::incentive_v3::entry_deposit`,
  arguments: [Clock, Storage, Pool, assetId, coinObj, amount, IncentiveV2, IncentiveV3],
  typeArguments: [coinType],
})
```

**Borrow:**
```ts
const [balance] = tx.moveCall({
  target: `${NAVI_PROTOCOL_PKG}::incentive_v3::borrow_v2`,
  arguments: [Clock, Oracle, Storage, Pool, assetId, amount, IncentiveV2, IncentiveV3, SuiSystem],
  typeArguments: [coinType],
})
const [coin] = tx.moveCall({ target: '0x2::coin::from_balance', arguments: [balance], typeArguments: [coinType] })
```

**Volo Stake (SUI → vSUI):**
```ts
const [vSuiCoin] = tx.moveCall({
  target: `${VOLO_PKG}::stake_pool::stake`,
  arguments: [VoloPool, VoloMetadata, SuiSystemState('0x05'), suiCoinObj],
})
tx.transferObjects([vSuiCoin], walletAddr)
```

**Non-SUI coin handling:**
```ts
// Fetch user's coins via JSON-RPC
const res = await fetch(rpcUrl, { body: JSON.stringify({
  method: 'suix_getCoins', params: [walletAddr, coinType, null, 50]
}) })
const coins = res.result.data
// Merge all coins of this type
const primary = tx.object(coins[0].coinObjectId)
if (coins.length > 1) tx.mergeCoins(primary, coins.slice(1).map(c => tx.object(c.coinObjectId)))
const splitCoin = tx.splitCoins(primary, [amount])
```

---

## Source: navi-sdk/src/address.ts

Contract addresses extracted from [naviprotocol/navi-sdk](https://github.com/naviprotocol/navi-sdk/blob/main/src/address.ts) (legacy SDK, still has correct mainnet addresses).

New SDK: [@naviprotocol/lending](https://sdk.naviprotocol.io/lending) + [@naviprotocol/wallet-client](https://sdk.naviprotocol.io/wallet-client) — incompatible with `@mysten/sui` v2 (imports `SuiClient` from `@mysten/sui/client` which doesn't exist in v2).
