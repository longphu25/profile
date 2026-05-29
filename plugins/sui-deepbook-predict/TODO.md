# DeepBook Predict Plugin — TODO

## Completed ✅

### P1: Portfolio & PnL Tracking ✅
- [x] Fetch open positions via `GET /managers/:id/positions/summary`
- [x] Display positions table with entry price, mark price, unrealized PnL
- [x] Fetch PnL history via `GET /managers/:id/pnl?range=ALL`
- [x] Account summary (trading_balance, account_value, realized/unrealized PnL)
- [x] Range tracking via `/ranges/minted` - `/ranges/redeemed` events

### P2: Claim Settled Positions ✅
- [x] Detect settled oracles with user positions
- [x] Show claimable positions with "Claim" button
- [x] Batch claim: all redeems in one PTB
- [x] Auto-refresh portfolio + balances after claim

### P3: Fair Value Preview ✅
- [x] Black-Scholes binary call formula from SVI params
- [x] Show estimated fair value in Portfolio tab
- [x] Fair Value Calculator in Portfolio (input strike → see probability)
- [x] PnL estimate in Trade tab (Win Prob, Est. Cost, If Win, If Lose)

### B3: Lending / MarginPool Supply ✅
- [x] Pool overview with APY, utilization, total supplied
- [x] Supply via `mintSupplierCap` + `supplyToMarginPool` SDK
- [x] Withdraw with percentage buttons

### B4: Live Event Streaming ✅
- [x] WebSocket subscription to `OraclePricesUpdated`, `OracleSVIUpdated`, `OracleSettled`
- [x] Auto-reconnect, fallback to 60s polling
- [x] Live feed indicator (● LIVE / ○ POLL)

### B5: DeepBook Spot Trading ✅
- [x] Market orders via `swapExactQuoteForBase` / `swapExactBaseForQuote`
- [x] Live orderbook display (bids/asks, spread)
- [x] Pool selector from DeepBook indexer

### B7: Oracle Health Monitor ✅
- [x] Price lag, SVI age, feed type display
- [x] Kill switch: disable trading when lag > 30s
- [x] Badge: HEALTHY / DELAYED / STALE

### W3: Permissionless Redeem (Keeper) ✅
- [x] Scan all managers for settled positions
- [x] Batch `redeem_permissionless` in one PTB
- [x] StepTree progress visualization

### Architecture: Oracle Data Service ✅
- [x] `oracleService.ts` — singleton data layer, publishes via `suiHostAPI.setSharedData('oracleData')`
- [x] `useOracleData` hook — any plugin/component can consume without prop drilling
- [x] WebSocket events route through service → all consumers auto-update

### UX Improvements ✅
- [x] Quick-select strike buttons (ATM, ±$500, ±$1000, ±$2000)
- [x] Contextual labels ("OTM call", "At-the-money")
- [x] Direction buttons show win condition
- [x] Range quick-select (±$500, ±$1000, ±$2000, ±$5000)
- [x] Vault balance display + 5%/10%/50%/Max buttons
- [x] Active oracles list with local timezone + time remaining
- [x] Balance auto-refresh after TX via `txRefresh` shared data
- [x] Trailing zeros stripped from balance display

### Bug Fixes ✅
- [x] BUG-1: `market_key::new` → `market_key::up` / `market_key::down`
- [x] BUG-2: Portfolio API flat array (not `{binaries[], ranges[]}`)
- [x] PTB: single atomic TX for deposit+mint (was 2 separate TXs)
- [x] `predict::supply` / `withdraw` return coins → must `transferObjects`
- [x] `tx.object('0x6')` → `tx.object.clock()`

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

### B6: Three-Protocol Loop (Real, Mainnet)
- [ ] `iron_bank::deposit` → `deepbook_margin::borrow` → `predict::mint_range`
- [ ] Full atomic PTB when mainnet launches

### B8: Pyth Price Feed Integration
- [ ] Add Pyth BTC/USD feed comparison in Arb tab (feed ID: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`)
- [ ] Show Predict oracle vs Pyth deviation → detect stale oracle
- [ ] Use `SuiPythClient` from `@mysten/deepbook-v3` for on-chain price updates
- [ ] Multi-asset feeds (ETH, SOL) for future oracle expansion

### B9: Plugin Code Splitting
- [ ] Extract inline `SurfaceStudio`, `PLPRiskDashboard`, `TradePanel`, `VaultPanel` to files
- [ ] Migrate all tabs to use `useOracleData` hook (remove prop drilling)
- [ ] Consider splitting into sub-plugins: core (trade/portfolio/vault), analytics (surface/risk/strategy), defi (spot/lending/keeper)

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
