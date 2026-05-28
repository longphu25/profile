# DeepBook Predict Plugin — TODO

## Priority: Trader Flow Completion

### P1: Portfolio & PnL Tracking
- [ ] Fetch open positions via `GET /managers/:id/positions/summary`
- [ ] Display positions table: type (binary/range), strike, expiry, quantity, cost basis
- [ ] Fetch PnL history via `GET /managers/:id/pnl?range=ALL`
- [ ] Show unrealized PnL per position (current spot vs strike)
- [ ] Add "Portfolio" tab to main plugin navigation

### P2: Claim Settled Positions
- [ ] Detect settled oracles (status = "settled") with user positions
- [ ] Show claimable positions with settlement price + payout amount
- [ ] One-click "Claim" button → `predict::redeem` or `redeem_permissionless`
- [ ] Batch claim: PTB with multiple redeems in one atomic TX
- [ ] Auto-refresh portfolio after claim

### P3: Fair Value Preview (Mint Cost Estimator)
- [ ] Port Black-Scholes binary call formula from SVI params
  - `d₂ = −k / √w − √w / 2` then `P = N(d₂)`
- [ ] Show estimated fair value before mint (binary + range)
- [ ] Display spread indicator: fair value vs expected on-chain cost
- [ ] Warn when utilization-adjusted price is significantly above fair value

---

## Backlog

### B1: Real Margin Trading
- [ ] Integrate `@mysten/deepbook-v3` MarginManager SDK
- [ ] Deposit collateral → borrow → place leveraged orders
- [ ] Display risk ratio, liquidation price, interest accrual
- [ ] Auto-rebalance alert when risk ratio < 1.3

### B2: Liquidator Bot UI
- [ ] Scan MarginManagers via margin indexer
- [ ] List positions near liquidation (risk ratio < 1.2)
- [ ] "Liquidate" button → earn 2-5% reward

### B3: Lending / MarginPool Supply
- [ ] Supply USDC/SUI to MarginPool → earn interest
- [ ] Show APY, utilization rate, supply cap
- [ ] Withdraw + accrued interest

### B4: Live Event Streaming
- [ ] Subscribe to `OraclePricesUpdated`, `OracleSVIUpdated` events
- [ ] Replace 20s polling with real-time feed
- [ ] Latency indicator in UI

### B5: DeepBook Spot Trading
- [ ] Place limit/market orders on DeepBook CLOB
- [ ] Compose: swap → deposit → mint range in 1 PTB

### B6: Three-Protocol Loop (Real, Mainnet)
- [ ] `iron_bank::deposit` → `deepbook_margin::borrow` → `predict::mint_range`
- [ ] Full atomic PTB when mainnet launches

### B7: Oracle Health Monitor
- [ ] Real-time lag display (on-chain timestamp vs now)
- [ ] Alert when SVI stale > 5s
- [ ] Auto-pause trading when feed lag > 30s

---

## API Reference (for implementation)

```
# Portfolio
GET /managers/:id/summary
GET /managers/:id/positions/summary
GET /managers/:id/pnl?range=ALL

# Settlement
GET /predicts/:id/oracles          → filter status="settled"
GET /oracles/:id/state             → settlement_price

# On-chain calls
predict::redeem<T>(predict, manager, oracle, market_key, amount, clock, ctx)
predict::redeem_range<T>(predict, manager, oracle, range_key, amount, clock, ctx)
predict::redeem_permissionless(predict, manager, oracle, market_key, clock, ctx)

# Pricing formula
k = ln(K / F)
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
d₂ = −k / √w − √w / 2
P(UP) = N(d₂)
P(DOWN) = 1 − N(d₂)
P(range) = N(d₂(lower)) − N(d₂(higher))
```
