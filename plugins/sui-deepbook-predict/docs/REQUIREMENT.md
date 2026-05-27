# DeepBook Predict — Hackathon Requirements

**Problem Statement**: [DeepBook Predict — Notion](https://mystenlabs.notion.site/deepbook-predict-problem-statement)

---

## Track Overview

DeepBook Predict is an expiry-based, vol-surface-priced prediction protocol on Sui. This hackathon track challenges builders to create innovative products and tools around it.

---

## What DeepBook Predict Provides

- Live on Sui Testnet with rolling sub-hour BTC oracles
- Public indexer/API at `predict-server.testnet.mystenlabs.com`
- dUSDC quote asset
- Mainnet launch planned — hackathon projects expected to redeploy on day one
- Composable with DeepBook spot, `deepbook_margin`, and `iron_bank` (already live on mainnet)

---

## Categories of Interest

### 1. Vault Strategies
Capital allocated programmatically across Predict positions, ranges, and PLP supply.
- Range-ladder vaults
- PLP+hedge vaults
- BTC-collateralized premia harvesters
- Three-protocol margin loops

### 2. Cross-Venue Arbitrage
Bots watching Predict's vol surface against external markets.
- Predict vs Polymarket / Hyperliquid event markets
- Predict vs Hyperliquid perps spread trading

### 3. Alt-Flavor Frontends
Non-canonical UIs that surface unique behaviors.
- Gamified prediction apps
- Mobile-first PWAs
- Telegram bots
- Social feeds, chat-based trading, streaks

### 4. Analytics & Developer Tooling ← **Our Category**
Making Predict legible and inspectable.
- **Live SVI surface viewers** ✅
- **PLP risk dashboards** ✅
- Manager PnL attribution
- Settlement leaderboards
- Oracle-feed health monitors

### 5. Integrations & Tooling
- Tokenized share tokens on top of PredictManager
- Compose with `deepbook_margin` + `iron_bank`
- Keeper services (settled-redeem, oracle monitors, withdrawal-limiter watchers)
- Developer tools for inspecting/debugging Predict markets

---

## Minimum Requirements

| Requirement | Our Status |
|-------------|------------|
| Integrate DeepBook Predict contract on testnet | ✅ Server API + on-chain mint/redeem/supply/withdraw |
| Work end to end (entire flow testable) | ✅ Wallet connect → select oracle → trade → TX digest |
| Proper simulation result (if vault strategy) | ✅ What-if scenario simulator with PnL output |

---

## Our Project Mapping

| Hackathon Ask | What We Built |
|---------------|---------------|
| Live SVI surface viewers | **Surface Studio** — IV smile from on-chain SVI params, time-travel slider, arbitrage checker |
| PLP risk dashboards | **PLP Risk Dashboard** — Vault health, utilization gauge, what-if simulator, PLP history |
| Developer tools | **Market tab** — Protocol state, oracle list, price history, all contract IDs |
| End-to-end product | **Trade tab** — Wallet connect, mint/redeem binary + range positions |
| LP flow | **Vault tab** — Supply DUSDC → PLP, Withdraw PLP → DUSDC |

---

## Key Differentiators

1. **SVI Formula Implementation** — Client-side computation of the full volatility smile from raw on-chain parameters, not just displaying numbers
2. **Butterfly Arbitrage Checker** — Automated detection of no-arbitrage violations in the smile
3. **Time-Travel** — Replay SVI updates to observe how the surface evolves
4. **What-If Stress Testing** — Simulate PLP PnL under extreme BTC moves (±50%)
5. **Full Trading Flow** — Not just analytics — users can actually mint/redeem positions
6. **Plugin Architecture** — Portable, embeddable in any Sui frontend via Shadow DOM

---

## Technical Integration Points

| Protocol Component | How We Integrate |
|-------------------|------------------|
| `predict-server` API | All market data, oracle state, vault summary, price/SVI history |
| `predict::mint_position` | Binary position minting via wallet |
| `predict::redeem_position` | Binary position redemption |
| `predict::mint_range` | Vertical range minting |
| `predict::redeem_range` | Vertical range redemption |
| `predict::supply` | Vault liquidity supply (DUSDC → PLP) |
| `predict::withdraw` | Vault liquidity withdrawal (PLP → DUSDC) |
| `OracleSVI` events | SVI parameter history for surface visualization |
| `OraclePricesUpdated` events | Price history for charts |

---

## Testnet Token Request

Request DUSDC via: https://tally.so/r/Xx102L

---

## References

- [DeepBook Predict Docs](https://docs.sui.io/onchain-finance/deepbook-predict/)
- [Design](https://docs.sui.io/onchain-finance/deepbook-predict/design)
- [Contract Information](https://docs.sui.io/onchain-finance/deepbook-predict/contract-information)
- [DeepBookV3 Repository (predict branch)](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)
