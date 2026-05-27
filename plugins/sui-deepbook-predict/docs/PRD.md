# DeepBook Predict — Product Requirements Document

## Product Summary

Browser-based prediction market dashboard for DeepBook Predict on Sui Testnet. Provides analytics, vault strategy simulations (range-ladder, PLP+hedge, three-protocol loop), cross-venue vol-arb, risk monitoring, and direct on-chain trading.

**Users**: Traders, LPs, quant analysts, vault strategists, protocol developers  
**Network**: Sui Testnet | **Quote**: DUSDC

---

## Features (9 Tabs)

### F1: Market Overview ✅

Server health, oracle list (asset/expiry/status/time-left), oracle detail (spot/forward), price chart (40 updates), auto-refresh 20s.

### F2: Surface Studio ✅

IV smile from SVI params, time-travel slider (30 updates), butterfly arbitrage checker, SVI formula + parameter explanations, ATM/violation highlighting.

### F3: PLP Risk Dashboard ✅

Vault balance/value/MTM/max-payout, PLP share price, utilization gauge, what-if simulator (±50%), PLP history chart, per-oracle exposure, risk formulas.

### F4: Range-Ladder Vault Strategy ✅

Config (capital, rungs, width%), auto-generate ranges around spot, per-rung breakdown, expected PnL, max loss/gain, PnL scenario chart (±30%), formulas.

### F5: PLP + Hedge Vault ✅

| Requirement | Status |
|-------------|--------|
| PLP supply allocation (configurable %) | ✅ |
| OTM DOWN binary hedges (configurable OTM distance) | ✅ |
| Dynamic hedge ratio based on vault utilization | ✅ |
| Net APY calculation (gross − insurance cost) | ✅ |
| Max drawdown comparison (hedged vs unhedged) | ✅ |
| Hedge position breakdown (strike, cost, payout, ITM prob) | ✅ |
| PnL scenario chart (−50% to +20% BTC move) | ✅ |
| Strategy explanation + formulas in UI | ✅ |
| User flow documentation | ✅ |

**Key Formula**: `Net APY = PLP_APY − (hedge_cost / capital) × (365 / expiry_days)`

### F6: Three-Protocol Margin Loop ✅

| Requirement | Status |
|-------------|--------|
| iron_bank deposit simulation (USDC → USDsui) | ✅ |
| deepbook_margin borrow simulation (USDsui collateral → dUSDC) | ✅ |
| predict range deployment simulation | ✅ |
| Leverage calculation | ✅ |
| Best-case / worst-case APY | ✅ |
| Liquidation price calculation | ✅ |
| Worst-case LTV analysis | ✅ |
| Protocol flow visualization (3 steps) | ✅ |
| PnL + LTV scenario table | ✅ |
| Liquidation status per scenario | ✅ |
| Atomic PTB description | ✅ |
| Strategy explanation + formulas in UI | ✅ |
| User flow documentation | ✅ |

**Key Formula**: `Net PnL = predict_payout + iron_bank_yield − margin_interest − predict_cost`

### F7: Vol-Arb Cross-Venue ✅

External BTC prices (CoinGecko/Binance), Predict ATM IV, realized vol estimation, spread calculation, BUY/SELL/NEUTRAL signal, Kelly fraction, oracle health monitor, kill switch (>30s lag).

### F8: Trading (Mint/Redeem) ✅

Wallet connect, binary (strike/UP/DOWN/amount), range (lower/upper/amount), toggle mint/redeem, TX submission + digest, error handling.

### F9: Vault Supply/Withdraw ✅

Supply DUSDC → PLP, withdraw PLP → DUSDC, estimated shares, share price, toggle, TX submission.

---

## User Flows

### PLP + Hedge Vault Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Risk Tab: Check vault utilization                     │
│ 2. PLP+Hedge Tab: Configure strategy                     │
│    ├── Capital: $5,000                                   │
│    ├── PLP: 80% ($4,000)                                 │
│    ├── Hedges: 20% ($1,000) → 3 DOWN binaries           │
│    └── OTM: 10% below spot                              │
│ 3. Review: Net APY, max drawdown, hedge positions        │
│ 4. Vault Tab: Supply $4,000 DUSDC → PLP                 │
│ 5. Trade Tab: Mint 3× DOWN binary at OTM strikes        │
│ 6. Monitor: Risk tab for utilization changes             │
│ 7. Near expiry: Redeem hedges if not needed              │
│ 8. Settlement: Hedges pay if crash, PLP earns if stable  │
└─────────────────────────────────────────────────────────┘
```

### Three-Protocol Margin Loop Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Loop Tab: Configure parameters                        │
│    ├── Collateral: $10,000                               │
│    ├── LTV: 70% → Borrow $7,000                         │
│    ├── Ranges: 5 × $1,400                                │
│    └── Width: 8% around spot                             │
│ 2. Review: Leverage, APY range, liquidation price        │
│ 3. Execute Step 1: iron_bank deposit (USDC → USDsui)    │
│ 4. Execute Step 2: deepbook_margin borrow (→ dUSDC)     │
│ 5. Execute Step 3: Trade Tab → Mint 5 range positions   │
│ 6. Monitor: LTV in Loop tab scenarios                    │
│    ├── LTV < 70%: SAFE                                   │
│    ├── LTV 70-85%: WARNING (consider closing)            │
│    └── LTV > 85%: LIQUIDATION RISK                       │
│ 7. Settlement: Collect payouts from ITM ranges           │
│ 8. Unwind: Repay margin → Withdraw iron_bank → Profit   │
└─────────────────────────────────────────────────────────┘
```

---

## Non-Functional Requirements ✅

Single-page plugin, dark theme, auto-polling 20s, responsive, Shadow DOM isolation, standalone + dashboard, modular structure, no external deps beyond @mysten/sui.

---

## Technical Constraints

1. Testnet only (IDs change at mainnet)
2. DUSDC required (request via form)
3. Oracle ~1s updates
4. Vault takes opposite side (LP risk)
5. SVI integer encoding
6. External API rate limits
7. Realized vol is approximation
8. iron_bank + deepbook_margin integration is simulated (not live on testnet predict)
