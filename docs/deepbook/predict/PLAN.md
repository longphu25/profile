# DeepBook Predict Command Center - Hackathon Plan

## Project Positioning

DeepBook Predict Command Center is a live analytics, strategy, and execution terminal for DeepBook Predict. It helps traders, LPs, quants, and developers understand SVI pricing, vault risk, portfolio PnL, settlement flows, and composable Spot/Margin/Predict strategies.

- Primary track: DeepBook
- Primary Idea Bank category: Analytics & Developer Tooling
- Secondary categories: Vault strategies, keeper services, cross-venue arbitrage, composable structured products
- Main app entry: `sui-deepbook-predict.html`
- Plugin: `plugins/sui-deepbook-predict`

## Current Product Surface

The static page loads the `sui-deepbook-predict` plugin and already includes these major capabilities:

- Market tab: server health, oracle list, oracle detail, price chart, live status
- Surface tab: SVI volatility smile, time-travel, butterfly checker, fair-value calculations
- Risk tab: PLP utilization, vault metrics, stress testing, what-if scenarios
- Strategy tab: range-ladder vault simulation
- PLP+Hedge tab: PLP supply plus OTM DOWN hedge simulation
- Loop tab: three-protocol margin-loop simulation
- Arb tab: vol-arb signal, Kelly sizing, oracle health, kill switch
- Trade tab: wallet connect, binary/range mint and redeem
- Vault tab: DUSDC supply and PLP withdraw
- Portfolio tab: manager positions, PnL, fair value preview, claimable settlements
- Lending tab: margin pool supply/withdraw
- Spot tab: DeepBook spot trading and order book
- Keeper tab: settled-position scan and permissionless batch redeem

## Demo Flow

Use this sequence for the hackathon video and live judging walkthrough:

1. Open `sui-deepbook-predict.html`.
2. Market tab: select an active BTC oracle and show server/oracle status.
3. Surface tab: explain the SVI smile, fair value, and butterfly-arbitrage checker.
4. Risk tab: show PLP utilization, max payout, and stress scenarios.
5. Trade tab: connect wallet and mint a binary or range position with testnet DUSDC.
6. Portfolio tab: show the created position, unrealized PnL, and fair value estimate.
7. Keeper tab: scan settled positions and preview batch redeem.
8. Spot/Lending/Loop tabs: show the broader Spot + Margin + Predict composability story.

## Work Plan Before Submission

### P0 - Submission Ready

- Add a Demo Mode or Hackathon Tour that guides judges through the main flow.
- Label every feature clearly as `Live on Testnet`, `Simulated`, `Requires DUSDC`, or `Experimental`.
- Write a plugin-level README with setup, demo script, architecture, contract IDs, and limitations.
- Record a 2-3 minute demo video.
- Confirm the full demo path works: Market -> Trade -> Portfolio -> Keeper.

### P1 - Technical Depth

- Add Pyth comparison in the Arb tab: Predict oracle vs Pyth deviation.
- Add Oracle Health Score using lag, SVI age, spread sanity, and settlement readiness.
- Add PnL Attribution: separate PnL caused by price movement, fair-value/SVI movement, and realized redeem.
- Improve event freshness indicators and fallback polling visibility.

### P2 - Product Polish

- Add Strategy Composer for PLP+Hedge, Range Ladder, and Vol-Arb.
- Generate an action checklist from each strategy configuration.
- Add one-click batch intent preview that shows the PTB plan before execution.
- Add export/share for strategy summaries to support submission material and social distribution.

### P3 - Roadmap Only

- Keep real DeepBook margin and iron_bank atomic PTB as roadmap unless the integration target is stable.
- Keep full prediction-social/mobile app ideas out of scope for the hackathon build.
- Avoid broad rewrites of the plugin system before submission.

## Repo Operations

Run these checks while preparing the submission:

```bash
rtk bun run build
rtk bun run dev
```

Open locally:

```text
http://localhost:5173/sui-deepbook-predict.html
```

Before commit or push, follow the repo rule:

- Patch bump for small user-facing fixes or routine maintenance.
- Minor bump for broader feature work or meaningfully expanded behavior.
- Skip version bump only for truly tiny typo or comment-only edits.

## Hackathon Narrative

DeepBook Predict is an expiry-based prediction market protocol on Sui. It supports binary positions, vertical ranges, oracle-driven SVI pricing, PredictManager accounts, and PLP vault liquidity.

This project follows the recommended DeepBook Predict integration model:

- Use the public Predict server for render-ready market, vault, portfolio, and historical data.
- Use Sui event/checkpoint streaming for lower-latency oracle updates.
- Use direct on-chain reads and wallet transactions around confirmation-critical flows.

The product demonstrates why DeepBook matters as a composable financial primitive:

- Analytics and developer tooling make Predict markets understandable.
- PLP and hedge tools show vault strategy potential.
- Keeper tools show operational automation.
- Spot, Lending, and Loop tabs show the path toward Spot + Margin + Predict structured products.

## Sources

- DeepBook Predict docs: https://docs.sui.io/onchain-finance/deepbook-predict/
- DeepBook Predict design: https://docs.sui.io/onchain-finance/deepbook-predict/design
- DeepBook Predict contract information: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information
- DeepBook builder hub: https://www.deepbook.tech/builder-hub
- Sui Overflow handbook: https://mystenlabs.notion.site/overflow-2026-handbook
