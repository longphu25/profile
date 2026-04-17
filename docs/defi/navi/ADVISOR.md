---
tags: [navi, advisor, strategy, yield, defi, execute]
aliases: [NAVI Advisor, Strategy Advisor]
---

# NAVI Strategy Advisor — Technical Notes

> See also: [[defi/navi/TECHNICAL|Dashboard Technical]] · [[defi/navi/MCP-REFERENCE|MCP Reference]]

## Overview

Plugin nhập budget USD → fetch real-time data → generate + rank chiến lược sinh lời → execute on-chain.

```
User input: $100
     │
     ▼
┌─────────────────────────────┐
│ Parallel fetch:             │
│  navi_get_pools (MCP)       │──→ Supply/Borrow APY per token
│  volo_get_vaults (MCP/CSV)  │──→ Vault APY, TVL, risk
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ generateStrategies()        │
│  5 strategy types           │
│  Sort by estimated APY      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ UI: Ranked strategy cards   │
│  Each with execute button   │
│  Green = on-chain tx        │
│  Yellow = supply+borrow     │
│  Blue = link to NAVI app    │
└─────────────────────────────┘
```

## 5 Strategy Types

### 1. Best Supply (deposit)

```ts
// Tìm pool có supply APY cao nhất
const topSupply = pools.filter(p => p.supplyApy > 0).sort((a,b) => b.supplyApy - a.supplyApy)
const best = topSupply[0] // e.g. WAL 18.2% APY

// Execute: incentive_v3::entry_deposit
// SUI: splitCoins(gas, amount)
// Non-SUI (WAL, DEEP...): suix_getCoins → mergeCoins → splitCoins
```

**Action:** `deposit` (green button) — hỗ trợ 18 tokens.

### 2. Best Volo Vault (volo-stake)

```ts
// Parse CSV từ volo_get_vaults, sort by apy7d
const topVault = vaults.filter(v => v.status === 'open').sort((a,b) => b.apy7d - a.apy7d)
// e.g. "SUI MULTI STRATEGY" 10.05% APY

// Execute: stake_pool::stake (SUI → vSUI)
tx.moveCall({
  target: `${VOLO_PKG}::stake_pool::stake`,
  arguments: [VoloPool, VoloMetadata, '0x05', suiCoin],
})
tx.transferObjects([vSuiCoin], walletAddr)
```

**Action:** `volo-stake` (green button) — stake SUI, receive vSUI.

### 3. Supply + Borrow Loop (supply-borrow)

```ts
// Điều kiện: suiPool.supplyApy > stablePool.borrowApy
const safeLtv = 0.5  // conservative 50%
const netApy = suiPool.supplyApy - (stablePool.borrowApy * safeLtv)

// Execute: 1 PTB, 2 Move calls
// Step 1: entry_deposit SUI
// Step 2: borrow_v2 stablecoin → coin::from_balance → transfer to wallet
```

**Action:** `supply-borrow` (yellow button) — medium risk, health factor ~2.0.

### 4. Stable Vault (link)

```ts
// Filter vaults có "stable" hoặc "MMT" trong tên
const stableVaults = vaults.filter(v =>
  v.name.toLowerCase().includes('stable') || v.name.includes('MMT')
)
// e.g. "Stable MMT#1" 4.23% APY — stablecoin, low IL
```

**Action:** `link` (blue button) → `https://app.naviprotocol.io/earn`

### 5. Diversified Top 3 (link)

```ts
// Chia đều budget cho 3 pools APY cao nhất
const top3 = topSupply.slice(0, 3)
const avgApy = top3.reduce((s, p) => s + p.supplyApy, 0) / 3
```

**Action:** `link` (blue button) → `https://app.naviprotocol.io/`

## Execute Flow

### deposit (any token)

```
1. Tìm pool config từ NAVI_POOL_CFG[symbol]
   → { poolId, assetId, type, decimals }

2. Tính tokenAmount = (budget / pool.price) * 10^decimals

3. Get coin object:
   SUI → tx.splitCoins(tx.gas, [amount])
   Non-SUI → fetch suix_getCoins → mergeCoins → splitCoins

4. tx.moveCall incentive_v3::entry_deposit
   args: [Clock, Storage, Pool, assetId, coin, amount, V2, V3]
   typeArgs: [coinType]

5. sharedHost.signAndExecuteTransaction(tx)
```

### volo-stake

```
1. Tính suiAmount = (budget / suiPrice) * 1e9
2. tx.splitCoins(tx.gas, [suiAmount])
3. tx.moveCall stake_pool::stake
   args: [VoloPool, VoloMetadata, '0x05', suiCoin]
4. tx.transferObjects([vSuiCoin], walletAddr)
5. signAndExecuteTransaction
```

### supply-borrow

```
1. Tính suiAmount + borrowAmount (50% LTV, stablecoin ≈ $1)
2. Step 1: entry_deposit SUI (same as deposit)
3. Step 2: borrow_v2 stablecoin
   args: [Clock, Oracle, Storage, Pool, assetId, amount, V2, V3, '0x05']
4. coin::from_balance → transferObjects to wallet
5. signAndExecuteTransaction (1 PTB, cả 2 steps)
```

## Volo CSV Parsing

MCP `volo_get_vaults` trả CSV, không JSON:

```csv
id,name,protocol,status,riskLevel,instantAPR,apy7d,apy30d,totalStakedUsd,minInvestment,...
0x6e53...,wBTC,volo,open,Low,1.88,1.89,4.12,8476614.57,0.00001,...
```

Parser:
```ts
function parseVaultsCsv(csv: string): Vault[] {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => row[h] = vals[i] ?? '')
    return {
      id: row.id, name: row.name, status: row.status,
      riskLevel: row.riskLevel,
      apy7d: Number(row.apy7d) || 0,
      apy30d: Number(row.apy30d) || 0,
      totalStakedUsd: Number(row.totalStakedUsd) || 0,
      ...
    }
  }).filter(v => v.status === 'open')
}
```

## NAVI Pool Config Map

18 tokens supported, stored in `NAVI_POOL_CFG`:

```ts
const NAVI_POOL_CFG: Record<string, { poolId, assetId, type, decimals }> = {
  SUI:     { assetId: 0,  decimals: 9, poolId: '0x96df...', type: '0x2::sui::SUI' },
  WAL:     { assetId: 24, decimals: 9, poolId: '0xef76...', type: '0x356a...::wal::WAL' },
  nUSDC:   { assetId: 10, decimals: 6, poolId: '0xa358...', type: '0xdba3...::usdc::USDC' },
  DEEP:    { assetId: 15, decimals: 6, poolId: '0x0837...', type: '0xdeeb...::deep::DEEP' },
  // ... 14 more tokens
}
```

Source: `navi-sdk/src/address.ts` (legacy SDK, mainnet addresses still valid).

## Non-SUI Coin Handling

SUI dùng `splitCoins(tx.gas)`. Non-SUI tokens cần fetch + merge:

```ts
// 1. Fetch user's coins via JSON-RPC
const res = await fetch(rpcUrl, { body: JSON.stringify({
  method: 'suix_getCoins',
  params: [walletAddr, `0x${coinType}`, null, 50]
})})
const coins = res.result.data

// 2. Merge all coins of this type
const primary = tx.object(coins[0].coinObjectId)
if (coins.length > 1) {
  tx.mergeCoins(primary, coins.slice(1).map(c => tx.object(c.coinObjectId)))
}

// 3. Split exact amount needed
const coinObj = tx.splitCoins(primary, [tokenAmount])
```

**Edge case:** Nếu user không có coin type đó → throw error "No {symbol} coins in wallet".

## UI Components

```
┌─────────────────────────────────────┐
│ NAVI Strategy Advisor               │
│ Budget (USD): [___100___] [Analyze] │
│                                     │
│ #1 Supply WAL on NAVI    18.20% APY │
│    Risk: Low                        │
│    1. Deposit $100 WAL              │
│    2. Supply to NAVI WAL pool       │
│    Est. yearly: $18.20              │
│    [████ Supply WAL to NAVI ████]   │ ← green
│                                     │
│ #2 Volo: SUI MULTI STRAT 10.05% APY│
│    Risk: Low                        │
│    1. Deposit $100 into vault       │
│    Est. yearly: $10.05              │
│    [████ Stake SUI → vSUI ████]     │ ← green
│                                     │
│ #3 Supply SUI + Borrow    8.50% APY│
│    Risk: Medium                     │
│    1. Supply $100 SUI (3.42% APY)   │
│    2. Borrow $50 USDC (1.2% APY)   │
│    3. Re-deposit borrowed USDC      │
│    [██ Supply SUI + Borrow USDC ██] │ ← yellow
│                                     │
│ Top Supply APY          Top Vaults  │
│ WAL    18.20%           SUI MS 10%  │
│ HAEDAL  8.50%           wBTC   4%   │
│ SUI     3.42%           Stable 4%   │
└─────────────────────────────────────┘
```

## Files

```
plugins/sui-navi-advisor/
├── plugin.tsx    # Strategy engine + execute + UI (~450 LOC)
└── style.css     # Dark theme, green/yellow/blue buttons
```

Imports `getPools` from `../sui-navi-dashboard/navi-api.ts` (shared MCP client).
Imports `RPC_URLS` from `../sui-seal-shared/config.ts` (for suix_getCoins RPC).

## Upgrade Plan: Portfolio-Aware Strategies

### Current (v1): Market-only
- Data: `navi_get_pools` + `volo_get_vaults`
- Strategies based on **market APY** only
- No knowledge of user's existing positions

### Target (v2): Portfolio-aware
- Data: + `get_positions` + `navi_get_health_factor` + `navi_get_available_rewards` + `navi_get_portfolio_pnl`
- Strategies based on **user's actual portfolio + market data**
- Personalized recommendations

### New Strategy Types (v2)

| # | Strategy | MCP Tools | Logic |
|---|----------|-----------|-------|
| 6 | Claim Rewards | `navi_get_available_rewards` | Unclaimed rewards > $1 → suggest claim |
| 7 | Health Alert | `navi_get_health_factor` | HF < 1.5 → suggest repay or add collateral |
| 8 | Idle Assets | `navi_get_coins` + `navi_get_pools` | Wallet has tokens not supplied → suggest supply |
| 9 | Rebalance | `get_positions` + `navi_get_pools` | Current position APY dropped → suggest switch |
| 10 | PnL Recovery | `navi_get_portfolio_pnl` | Negative PnL → suggest stablecoin rotation |

### MCP Tools Usage (v1 → v2)

| Tool | v1 | v2 |
|------|----|----|
| `navi_get_pools` | ✅ | ✅ |
| `volo_get_vaults` | ✅ | ✅ |
| `get_positions` | ❌ | ✅ |
| `navi_get_health_factor` | ❌ | ✅ |
| `navi_get_available_rewards` | ❌ | ✅ |
| `navi_get_portfolio_pnl` | ❌ | ✅ |
| `navi_get_coins` | ❌ | ✅ |
| **Total** | **2/37** | **7/37** |
