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

### B8: Pyth Price Feed Integration
- [ ] Add Pyth BTC/USD feed comparison in Arb tab (feed ID: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`)
- [ ] Show Predict oracle vs Pyth deviation → detect stale oracle
- [ ] Use `SuiPythClient` from `@mysten/deepbook-v3` for on-chain price updates
- [ ] Multi-asset feeds (ETH, SOL) for future oracle expansion

---

## API Reference (for implementation)

```
# Portfolio
GET /managers/:id/summary
  → owner, balances[], trading_balance, open_exposure, account_value,
    realized_pnl, unrealized_pnl, open_positions, awaiting_settlement_positions
GET /managers/:id/positions/summary
  → [{oracle_id, underlying_asset, expiry, strike, is_up, open_quantity,
      average_entry_price, mark_price, unrealized_pnl}]
GET /managers/:id/pnl?range=ALL
GET /ranges/minted?manager_id=X
GET /ranges/redeemed?manager_id=X

# Settlement
GET /predicts/:id/oracles          → filter status="settled"
GET /oracles/:id/state             → settlement_price

# On-chain calls (from predict-workshop reference)
# IMPORTANT: market_key uses market_key::up / market_key::down (NOT market_key::new with direction byte)
market_key::up(oracle_id, expiry, strike) → MarketKey
market_key::down(oracle_id, expiry, strike) → MarketKey
range_key::new(oracle_id, expiry, lower, higher) → RangeKey

predict::mint<T>(predict, manager, oracle, market_key, quantity, clock)
predict::mint_range<T>(predict, manager, oracle, range_key, quantity, clock)
predict::redeem<T>(predict, manager, oracle, market_key, quantity, clock)
predict::redeem_range<T>(predict, manager, oracle, range_key, quantity, clock)
predict::redeem_permissionless<T>(predict, manager, oracle, market_key, quantity, clock)
predict::supply<T>(predict, coin_dusdc, clock) → Coin<PLP>
predict::withdraw<T>(predict, coin_plp, clock) → Coin<DUSDC>
predict_manager::deposit<T>(manager, coin)

# Pricing formula
k = ln(K / F)
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
d₂ = −k / √w − √w / 2
P(UP) = N(d₂)
P(DOWN) = 1 − N(d₂)
P(range) = N(d₂(lower)) − N(d₂(higher))
```

---

## Bugs to Fix (from predict-workshop comparison)

### BUG-1: market_key construction uses wrong function ⚠️
**Current:** `market_key::new(oracle_id, expiry, strike, direction_u8)`
**Correct:** `market_key::up(oracle_id, expiry, strike)` or `market_key::down(oracle_id, expiry, strike)`
**Impact:** All binary mint/redeem transactions may fail
**Files:** plugin.tsx (TradePanel), PortfolioTab.tsx (claim)

### BUG-2: Portfolio API response shape
**Current:** Assumes `positions.binaries[]` and `positions.ranges[]`
**Correct:** `/managers/:id/positions/summary` returns flat array with `is_up`, `open_quantity`, `average_entry_price`, `mark_price`, `unrealized_pnl`
**Files:** PortfolioTab.tsx

---

## Workshop-Inspired Improvements

### W1: Enhanced Portfolio Summary
- [ ] Use `/managers/:id/summary` for headline numbers (trading_balance, account_value, realized/unrealized PnL)
- [ ] Show `awaiting_settlement_positions` count prominently
- [ ] Display `average_entry_price` and `mark_price` per position

### W2: Range Position Tracking via Events
- [ ] Fetch `/ranges/minted?manager_id=X` and `/ranges/redeemed?manager_id=X`
- [ ] Compute net open ranges (minted - redeemed) client-side
- [ ] Show range positions alongside binary positions

### W3: Permissionless Redeem for Others
- [ ] Allow redeeming settled positions for ANY manager (not just own)
- [ ] Input field for manager_id → scan settled positions → batch redeem
- [ ] Useful as a "keeper" service for the protocol

---

## WASM Optimization (Future — CPU-bound features)

Current plugin is I/O bound (network + wallet). WASM only helps when adding CPU-intensive features:

### WASM-1: Monte Carlo Pricing Engine
- [ ] 10,000+ path simulation for option pricing
- [ ] Variance reduction (antithetic, control variate)
- [ ] Real-time Greeks (delta, gamma, vega, theta)
- [ ] Rust implementation → wasm-pack → import as module

### WASM-2: Vol Surface Fitting (Least-Squares)
- [ ] Fit SVI params from market prices (inverse problem)
- [ ] Levenberg-Marquardt optimizer in Rust
- [ ] Real-time recalibration on each price tick

### WASM-3: Backtesting Engine
- [ ] Replay historical oracle data (prices + SVI)
- [ ] Simulate strategy PnL over past expiries
- [ ] Sharpe ratio, max drawdown, win rate calculations
- [ ] Process 1000s of data points per frame

### WASM-4: BCS Bulk Serialization
- [ ] Batch serialize/deserialize PTB inputs
- [ ] Useful when building 100+ commands in one PTB
- [ ] Rust `bcs` crate → WASM for browser

### WASM-5: Orderbook Matching Simulation
- [ ] Simulate market impact for large orders
- [ ] Full orderbook reconstruction from events
- [ ] L3 data processing (individual order events)

### Implementation Plan
```
1. Write Rust lib with #[wasm_bindgen] exports
2. Compile: wasm-pack build --target web
3. Load in plugin: const wasm = await import('./pkg/predict_engine.js')
4. Use Web Workers for heavy computation (non-blocking UI)
```

### When to trigger WASM migration
- Single computation takes > 16ms (blocks UI frame)
- User-facing latency from CPU work > 100ms
- Feature requires iterative algorithms (optimization, simulation)
