# DeepBook Predict Command Center - Hackathon Plan

## Project Positioning

DeepBook Predict Command Center is a live analytics, strategy, and execution terminal for DeepBook Predict. It helps traders, LPs, quants, and developers understand SVI pricing, vault risk, portfolio PnL, settlement flows, and composable Spot/Margin/Predict strategies.

- Primary track: DeepBook
- Primary Idea Bank category: Analytics & Developer Tooling
- Secondary categories: Vault strategies, keeper services, cross-venue arbitrage, composable structured products
- Main app entry: `sui-deepbook-predict.html`
- Plugin: `plugins/sui-deepbook-predict`

## Current Product Surface

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

1. Open `sui-deepbook-predict.html`.
2. Market tab: select an active BTC oracle and show server/oracle status.
3. Surface tab: explain the SVI smile, fair value, and butterfly-arbitrage checker.
4. Risk tab: show PLP utilization, max payout, and stress scenarios.
5. Trade tab: connect wallet and mint a binary or range position with testnet DUSDC.
6. Portfolio tab: show the created position, unrealized PnL, and fair value estimate.
7. Keeper tab: scan settled positions and preview batch redeem.
8. Spot/Lending/Loop tabs: show the broader Spot + Margin + Predict composability story.

## Submission Work Plan

### P0 - Submission Ready

- Add Demo Mode or Hackathon Tour that guides judges through the main flow.
- Label every feature as `Live on Testnet`, `Simulated`, `Requires DUSDC`, or `Experimental`.
- Write a plugin-level README with setup, demo script, architecture, contract IDs, and limitations.
- Record a 2-3 minute demo video.
- Confirm the full demo path works: Market -> Trade -> Portfolio -> Keeper.

### P1 - Technical Depth

- Add Pyth comparison in the Arb tab: Predict oracle vs Pyth deviation.
- Add Oracle Health Score using lag, SVI age, spread sanity, and settlement readiness.
- Add PnL Attribution: price movement, fair-value/SVI movement, realized redeem.
- Improve event freshness indicators and fallback polling visibility.

### P2 - Product Polish

- Add Strategy Composer for PLP+Hedge, Range Ladder, and Vol-Arb.
- Generate action checklists from strategy configurations.
- Add one-click batch intent preview that shows the PTB plan before execution.
- Add export/share for strategy summaries.

### P3 - Roadmap Only

- Keep real DeepBook margin and iron_bank atomic PTB as roadmap unless integration targets are stable.
- Keep prediction-social/mobile app ideas out of scope for the hackathon build.
- Avoid broad rewrites of the plugin system before submission.

## Sources

- DeepBook Predict docs: https://docs.sui.io/onchain-finance/deepbook-predict/
- DeepBook Predict design: https://docs.sui.io/onchain-finance/deepbook-predict/design
- DeepBook Predict contract information: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information
- DeepBook builder hub: https://www.deepbook.tech/builder-hub
- Sui Overflow handbook: https://mystenlabs.notion.site/overflow-2026-handbook

