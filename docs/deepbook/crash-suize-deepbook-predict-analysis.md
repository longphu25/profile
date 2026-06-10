# Crash.Suize.io — DeepBook Predict Analysis & Predict Club Opportunities

**Date:** 2026-06-10
**Status:** Research / Competitive Analysis
**Source:** https://crash.suize.io/

---

## 1. What crash.suize.io Is

Crash.suize.io is a **"Crash Game" frontend** built on top of DeepBook Predict on
Sui Testnet. It implements the "tap to bet UP / DOWN" use case described in
the official DeepBook Predict blog announcement.

The site is a JavaScript SPA (no server-rendered content), suggesting a
React/Vue/vanilla client that connects to:

- Sui wallet for transaction signing
- DeepBook Predict protocol for binary position minting
- Predict Server API for oracle & market data

### Crash Game Mechanic (inferred from DeepBook Predict primitives)

The "crash" mechanic maps to DeepBook Predict as follows:

| Crash Game Concept | DeepBook Predict Mapping |
|--------------------|--------------------------|
| Multiplier rising | Oracle price movement (spot going up) |
| Crash point | Expiry settlement / oracle settles at a specific price |
| Bet UP / Cash out | Mint binary position `is_up = true`, redeem before expiry |
| Bet DOWN | Mint binary position `is_up = false` |
| Payout | Position pays when settlement is above (UP) or below (DOWN) strike |
| Instant settlement | Sui < 400ms finality |

The key insight: **Suize repurposes the binary options primitive into a gamified
UX** where the time-to-expiry is short (minutes or seconds), creating the feel
of a "crash game" with:

- Short expiry oracles → fast rounds
- Binary UP/DOWN positions → simple bet mechanic
- Oracle-driven settlement → provably fair on-chain
- Vault as counterparty → guaranteed liquidity from PLP providers

---

## 2. Architecture (Reconstructed)

```
┌────────────────────────────────────────┐
│         crash.suize.io (SPA)           │
├────────────────────────────────────────┤
│  Wallet Connect (Sui dApp Kit)         │
│  Game UI (multiplier animation)        │
│  Position Manager (mint/redeem)        │
└────────┬──────────────┬────────────────┘
         │              │
         ▼              ▼
┌─────────────┐  ┌──────────────────────────────┐
│ Sui Testnet │  │ Predict Server (indexed API)  │
│ - Predict   │  │ - /oracles/:id/state          │
│ - Manager   │  │ - /oracles/:id/prices/latest  │
│ - OracleSVI │  │ - /managers/:id/positions     │
└─────────────┘  └──────────────────────────────┘
```

### Likely contract interactions:

1. **Create PredictManager** — one-time setup per user
2. **Deposit DUSDC** — fund the manager
3. **Mint binary position** — `predict::mint_position(predict, manager, oracle, expiry, strike, is_up, quantity)`
4. **Redeem position** — after settlement, claim payout
5. **Live price streaming** — WebSocket or polling from Predict Server

---

## 3. What DeepBook Predict Enables (Full Feature Set)

From official docs (predict-testnet-4-16 branch):

### Core Objects

| Object | Purpose |
|--------|---------|
| `Predict` | Main shared object, vault + pricing + risk config |
| `PredictManager` | Per-user account, stores balances + positions |
| `OracleSVI` | Per-asset/per-expiry market state (spot, forward, SVI params) |
| `Vault` | Shared liquidity, PLP shares, exposure tracking |

### Oracle Lifecycle

```
Inactive → Active → Pending Settlement → Settled
```

- Active: accepts live price + SVI updates, mints allowed
- Settled: first post-expiry price freezes settlement, only redeems

### Position Types

1. **Binary positions** — `MarketKey(oracle_id, expiry, strike, is_up)`
   - Pays if settlement is above (UP) or below (DOWN) strike
2. **Vertical ranges** — `RangeKey(oracle_id, expiry, lower_strike, higher_strike)`
   - Pays if settlement lands in `(lower, higher]`

### Pricing

- SVI volatility surface → fair value
- Protocol spread + utilization adjustments
- Global and per-oracle ask bounds
- Vault exposure check enforces risk limits

### Public Server API

Base: `https://predict-server.testnet.mystenlabs.com`

Key endpoints:
- `GET /predicts/:id/state` — protocol state
- `GET /predicts/:id/oracles` — oracle list
- `GET /oracles/:id/state` — current oracle state
- `GET /oracles/:id/prices/latest` — latest price
- `GET /managers/:id/positions/summary` — user positions
- `GET /managers/:id/pnl?range=ALL` — PnL history
- `GET /predicts/:id/vault/summary` — vault health

### Contract IDs (Testnet, provisional)

| Item | Value |
|------|-------|
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| DUSDC type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| PLP type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Source branch | `predict-testnet-4-16` |

### Live Events (for low-latency UIs)

Filter by package ID:
- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

---

## 4. Opportunities for Predict Club

### 4a. Gamified Quick-Round Mode (inspired by Suize Crash)

Predict Club currently focuses on community-driven trading rounds with
leader-initiated proposals. Suize shows that **short-expiry binary positions
can be presented as a fast-paced game**.

**Integration idea: "Quick Predict" mode**

| Feature | Implementation |
|---------|---------------|
| Fast rounds (1-5 min expiry) | Filter oracles for shortest active expiry |
| Tap UP / DOWN | Simplified mint_position UX, no strike selection (use ATM) |
| Live multiplier display | Stream oracle price, show current fair value as "multiplier" |
| Auto-redeem on settle | Keeper-style auto-claim when oracle settles |
| Group betting | Leader picks an oracle + expiry, members tap in |

This creates a **social crash game** where:
- Leader announces "BTC 5-min round, strike 95000"
- Members tap UP or DOWN within 30 seconds
- Oracle settles → payouts auto-distributed
- Club leaderboard tracks win rate

### 4b. Compose with Predict Club Escrow

The existing escrow contract can facilitate DUSDC lending for crash rounds:
- Member has SUI but not DUSDC → escrow swap → play
- Short-round lock periods align with quick escrow release

### 4c. PLP Vault as Club Treasury

A club could supply DUSDC to the Predict vault as PLP:
- Club members collectively act as liquidity provider
- PLP returns distributed proportionally
- Risk: vault takes opposite side of all trades, club PLP exposed to
  directional risk from other traders

### 4d. Vertical Range as "Bounded Bet"

Beyond crash-style binary, Predict Club can offer:
- "Price lands between X and Y" → vertical range position
- Higher payout for tighter ranges (more precise prediction)
- Strategy rounds where leader specifies a range corridor

### 4e. Composability with Margin

DeepBook blog explicitly lists `Predict + Margin` = "Tap to bet UP/DOWN apps
with leverage". Predict Club could:
- Offer leveraged binary positions
- Borrow DUSDC via margin to size up positions
- Risk controls via club policy (max leverage per member)

---

## 5. Key Differences: Suize Crash vs Predict Club

| Aspect | Suize Crash | Predict Club |
|--------|-------------|--------------|
| UX metaphor | Casino crash game | Trading community |
| Decision maker | Individual | Leader-guided |
| Round duration | Very short (seconds-minutes) | Flexible (minutes-hours) |
| Analysis depth | None (gamified) | Indicators, SVI, thesis |
| Risk education | Minimal | Required (oracle health, max loss) |
| Funding | Direct DUSDC | Funding router (swap, borrow, escrow) |
| Target user | Retail gambler | Informed trader/community |
| Composability | Single position | Can layer Margin, Spot, PLP |

---

## 6. Technical Takeaways for Implementation

### What Suize likely does well:
1. **Simple onboarding** — create PredictManager + deposit in one PTB
2. **Real-time price feed** — WebSocket/polling of oracle prices
3. **Fast UX** — Sui finality < 400ms makes the crash animation feel responsive
4. **Oracle selection** — pre-picks the shortest expiry, ATM strike

### What Predict Club should adopt:
1. **Streaming oracle price** — current implementation uses polling; consider
   event subscription for live rounds
2. **One-click binary mint** — simplify the trade execution path for "quick mode"
3. **Auto-redeem on settlement** — keeper scan + batch redeem for settled positions
4. **PredictManager reuse** — never create a new manager per round

### What Predict Club should NOT adopt:
1. Removing risk disclosure (crash games obscure real risk)
2. Hiding the options-pricing nature (members should see SVI fair value)
3. Fully automated trading without user signature (V1 rule)

---

## 7. Recommended Next Steps

1. **Prototype a "Quick Predict" tab** in the Predict Club plugin that uses
   short-expiry oracles with simplified UP/DOWN UI
2. **Integrate oracle event streaming** for live price animation
3. **Add auto-redeem keeper** to club round settlement flow
4. **Research PLP strategy** for club treasury yield
5. **Monitor Suize Crash source** (likely open-source at hackathon) for SDK
   patterns and PTB construction

---

## References

- [DeepBook Predict Overview](https://docs.sui.io/onchain-finance/deepbook-predict/)
- [DeepBook Predict Design](https://docs.sui.io/onchain-finance/deepbook-predict/design)
- [DeepBook Predict Contract Info](https://docs.sui.io/onchain-finance/deepbook-predict/contract-information)
- [Introducing DeepBook Predict (Blog)](https://blog.sui.io/introducing-deepbook-predict/)
- [DeepBook Waitlist Announcement](https://blog.sui.io/the-waitlist-is-open/)
- [DeepBookV3 Source (predict-testnet-4-16)](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)
- [Predict Club Product Contract](../product/predict-club.md)
- [Predict Club Funding Router](../product/predict-club-funding.md)
