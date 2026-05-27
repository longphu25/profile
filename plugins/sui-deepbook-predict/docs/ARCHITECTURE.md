# sui-deepbook-predict — Plugin Architecture

## Overview

DeepBook Predict market dashboard for Sui Testnet. Provides analytics, vault strategy simulations, cross-venue vol-arb, and wallet-connected trading for the DeepBook Predict protocol.

**Entry**: `sui-deepbook-predict.html` → `plugin.tsx`  
**Stack**: React + @mysten/sui v2 + Vite  
**Network**: Testnet (predict-server.testnet.mystenlabs.com)  
**Build**: `bun run build`

---

## File Structure

```
plugins/sui-deepbook-predict/
│
├── plugin.tsx              — Entry point + main orchestrator (9 tabs)
│   ├── PredictContent — Main component
│   ├── SurfaceStudio — Vol surface + time-travel
│   ├── PLPRiskDashboard — Vault health + what-if
│   ├── TradePanel — Mint/Redeem binary + range
│   └── VaultPanel — Supply/Withdraw (DUSDC ↔ PLP)
│
├── types.ts                — Constants, interfaces, types
├── utils.ts                — Pure formatting helpers
├── sdk.ts                  — API fetch (Predict server + external prices)
│
├── strategies/
│   ├── index.ts            — Barrel export
│   ├── svi.ts              — SVI surface computation + butterfly check
│   ├── rangeLadder.ts      — Range-ladder vault simulation
│   ├── plpHedge.ts         — PLP + Hedge vault (yield − insurance)
│   ├── marginLoop.ts       — Three-protocol margin loop simulation
│   └── volArb.ts           — Vol-arb spread (Predict ↔ External)
│
├── hooks/
│   ├── index.ts
│   ├── usePredictData.ts   — Oracle, vault, price polling
│   └── useWallet.ts        — Wallet context sync
│
├── components/
│   ├── index.ts
│   ├── StrategyTab.tsx     — Range-ladder vault UI
│   ├── PLPHedgeTab.tsx     — PLP + Hedge vault UI
│   ├── MarginLoopTab.tsx   — Three-protocol loop UI
│   └── ArbTab.tsx          — Vol-arb + oracle health UI
│
├── services/
│   └── index.ts
│
├── style.css
└── docs/
```

---

## Tabs (9)

| Tab | Component | Purpose |
|-----|-----------|---------|
| **Market** | `renderMarket()` | Protocol state, oracle list, price chart |
| **Surface** | `SurfaceStudio` | IV smile, time-travel, arbitrage checker |
| **Risk** | `PLPRiskDashboard` | Vault health, utilization, what-if |
| **Strategy** | `StrategyTab` | Range-ladder vault simulation |
| **PLP+Hedge** | `PLPHedgeTab` | PLP yield + crash insurance |
| **Loop** | `MarginLoopTab` | Three-protocol margin loop |
| **Arb** | `ArbTab` | Vol-arb, Kelly sizing, oracle health |
| **Trade** | `TradePanel` | Mint/redeem binary + range |
| **Vault** | `VaultPanel` | Supply/withdraw DUSDC ↔ PLP |

---

## Data Sources

| Source | Endpoint | Used For |
|--------|----------|----------|
| Predict Server | `/status` | Health |
| Predict Server | `/predicts/:id/oracles` | Oracle list |
| Predict Server | `/oracles/:id/state` | Spot, forward, SVI |
| Predict Server | `/oracles/:id/prices` | Price history |
| Predict Server | `/oracles/:id/svi` | SVI history |
| Predict Server | `/predicts/:id/vault/summary` | Vault metrics |
| Predict Server | `/predicts/:id/vault/performance?range=ALL` | PLP history |
| CoinGecko | `/api/v3/simple/price` | External BTC price |
| Binance | `/api/v3/ticker/price` | External BTC price |
| On-chain | `predict::mint_position` | Mint binary |
| On-chain | `predict::redeem_position` | Redeem binary |
| On-chain | `predict::mint_range` | Mint range |
| On-chain | `predict::redeem_range` | Redeem range |
| On-chain | `predict::supply` | Supply to vault |
| On-chain | `predict::withdraw` | Withdraw from vault |

---

## Technical: SVI Volatility Surface

```
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
IV(K) = √(w(k) / T) × 100%
```

| Param | Decode |
|-------|--------|
| a, b, m, sigma | ÷ 1,000,000 |
| rho | ÷ 1,000,000,000 (negate if flag) |
| spot, forward, strike | ÷ 1,000,000,000 (USD) |

Butterfly check: `IV(K₂) > interpolated × 1.02` → violation.

---

## Technical: PLP + Hedge Vault Strategy

### Concept

Supply DUSDC into `predict::supply` → earn PLP returns. Simultaneously buy OTM DOWN binaries via `predict::mint` → cap left-tail drawdown.

**Product**: "PLP yield minus crash insurance"

### Formulas

```
Net APY = PLP_APY − (hedge_cost / capital) × (365 / expiry_days)
Dynamic hedge_ratio = base × (1 + utilization_adjustment)
  if util > 75%: ×1.4
  if util > 50%: ×1.2
Max drawdown (hedged) = (spot − lowest_strike) / spot × PLP_portion + insurance_cost
```

### User Flow

1. **Assess vault health** → Check Risk tab for current utilization
2. **Configure strategy** → Set capital, PLP allocation %, OTM distance, number of hedges
3. **Review simulation** → Check net APY, max drawdown (hedged vs unhedged), hedge positions
4. **Execute PLP supply** → Go to Vault tab → Supply DUSDC → receive PLP
5. **Execute hedges** → Go to Trade tab → Select Binary → DOWN direction → Set strike at OTM level → Mint for each hedge position
6. **Monitor** → Risk tab shows vault health; if utilization spikes, increase hedge ratio
7. **Near expiry** → If hedges not needed (BTC stable), sell back via Redeem to recover premium
8. **Settlement** → If BTC crashed: hedges pay out, offsetting PLP loss. If stable: PLP yield earned, hedge cost is the insurance premium paid.

### Hooks for Hackers

- Tune hedge ratio dynamically based on vault utilization (auto-rebalance)
- Sell hedges back near expiry if not needed (recover premium)
- Expose clean APY net of insurance cost as a single metric

---

## Technical: Three-Protocol Margin Loop

### Concept

Stack three Sui DeFi protocols in one composable flow:

```
iron_bank (deposit USDC → USDsui) 
  → deepbook_margin (collateralize USDsui → borrow dUSDC)
    → predict (deploy dUSDC into range positions)
      → settlement payouts repay margin loan
```

**Product**: "This is what Sui DeFi composability actually looks like"

### Formulas

```
Leverage = LTV (e.g. 0.7 = 1.7× effective exposure)
Net PnL = predict_payout + iron_bank_yield − margin_interest − predict_cost
LTV_current = debt / collateral_value
Liquidation: if LTV > 85% → close predict → repay debt
```

### Atomic PTB

```
PTB = [
  iron_bank::deposit(USDC, amount),           // → USDsui shares
  deepbook_margin::borrow(USDsui, amount×LTV), // → dUSDC
  predict::mint_range(dUSDC, oracle, lower, upper) × N,
]
```

### User Flow

1. **Understand the stack** → Read Loop tab description (3 protocols, 1 PTB)
2. **Configure parameters**:
   - Collateral amount (initial USDC)
   - LTV ratio (how much to borrow, e.g. 70%)
   - Number of range positions
   - Range width (% around spot)
   - iron_bank APY (yield on deposit)
   - Margin borrow rate (cost of leverage)
   - Expected predict return (if ranges settle ITM)
3. **Review simulation**:
   - Check leverage multiplier
   - Check best-case APY (all ranges ITM) vs worst-case (all OTM)
   - Check liquidation price (where LTV breaches 85%)
   - Review scenario table (PnL + LTV at each price move)
4. **Execute step 1: iron_bank deposit**
   - Deposit USDC into iron_bank
   - Receive USDsui share token (earning yield)
5. **Execute step 2: deepbook_margin borrow**
   - Use USDsui as collateral
   - Borrow dUSDC at configured LTV
6. **Execute step 3: predict range positions**
   - Go to Trade tab → Range mode → Mint
   - Open N range positions with borrowed dUSDC
7. **Monitor LTV**:
   - If BTC drops significantly → LTV increases
   - If LTV approaches 85% → close predict positions early
   - Use Redeem to recover capital before liquidation
8. **Settlement**:
   - Ranges that settle ITM → receive payout
   - Use payout to repay margin loan
   - Withdraw remaining USDsui from iron_bank
   - Net profit = payouts + iron_bank_yield − borrow_interest − range_costs

### Liquidation Path

```
LTV > 85% trigger:
  1. predict::redeem_range (close all positions)
  2. deepbook_margin::repay (return borrowed dUSDC)
  3. deepbook_margin::withdraw_collateral (get USDsui back)
  4. iron_bank::withdraw (convert USDsui → USDC)
```

### Hooks for Hackers

- Design liquidation path (margin call → close predict → repay)
- Bound LTV against worst-case Predict outcomes
- Single PTB that opens the whole stack atomically
- Auto-rebalance: if one range expires OTM, open new range with remaining capital

---

## Technical: Range-Ladder Vault

```
ladder = [spot − width/2, spot + width/2]
rung_width = total_width / N
PnL = Σ(payout_i × P(settlement ∈ rung_i)) − capital
```

---

## Technical: Vol-Arb

```
spread = Predict_ATM_IV − External_IV
Kelly f* = min(0.25, |spread|/100 / σ_predict)
Kill switch: oracle lag > 30s
```

---

## Technical: PLP Risk Model

```
vault_value = vault_balance − total_MTM
PLP_share_price = vault_value / total_PLP_supply
What-if: PnL = −MTM × |move%|
```

---

## Wallet Integration

```typescript
sharedHost.requestConnect()
sharedHost.signAndExecuteTransaction(tx) → { digest, effects }
```

---

## Contract IDs (Testnet)

| Item | Value |
|------|-------|
| Package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict Object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| DUSDC | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| Server | `https://predict-server.testnet.mystenlabs.com` |
