# DeepBook Static Page and Plugin Split Plan

## Summary

Do not continue creating one static HTML file for every small plugin. For DeepBook, create one main product page:

- HTML: `deepbook.html`
- React entry: `src/deepbook/main.tsx`
- Root app: `src/deepbook/DeepBookSuite.tsx`
- Runtime: reuse `SuiHostAPI`, `ShadowContainer`, `loadSuiPlugin`, wallet/shared context like `sui-plugin.html`

Goal: turn existing DeepBook plugins into a DeepBook Suite with navigation, action hub, wallet context, recommended actions, and lazy-loaded plugins.

Keep dedicated deep links:

- `sui-deepbook-predict.html`: Predict-specific demo/submission.
- `sui-deepbook-hedging-bot.html`: large bot experience.
- `sui-plugin.html`: generic Sui plugin dashboard.
- `sui-plugin-wasm.html`: technical/WASM/plugin catalog.

## Plugin Split

### DeepBook Core Apps

- `sui-deepbook-home`:
  - new app/module
  - Mission Control: wallet summary, market status, recommended next action, quests, quick launch
- `sui-swap`:
  - keep existing plugin
  - group: `Trade`
- `sui-deepbook-orderbook`:
  - keep existing plugin
  - group: `Trade` and `Market Radar`
- `sui-deepbook-portfolio`:
  - keep existing plugin
  - group: `Portfolio`
- `sui-deepbook-predict`:
  - keep existing plugin
  - group: `Predict`

### Market and Analytics Apps

- `sui-pool-explorer`
- `sui-price-feed`
- `sui-deepbook-history`
- `sui-deepbook-analysis`
- Planned: `sui-deepbook-market-radar`
  - aggregates pool explorer + price feed + analysis
  - tags: `High Volume`, `Wide Spread`, `Trending`, `Watch`

### Risk and Margin Apps

- `sui-margin-manager`
- Planned: `sui-deepbook-risk-center`
  - aggregates portfolio + margin + open orders
  - promotes warnings before trade CTAs
  - statuses: `Safe`, `Caution`, `At Risk`

### Bot and Automation Apps

- `sui-hedging-monitor`
- `sui-deepbook-hedging-bot`
- Planned: `sui-deepbook-bot-arena`
  - bot sessions, cycles, streaks, missions, runtime health
  - links into hedging bot page for full control

### Gamification Apps

- Planned: `sui-deepbook-quest-board`
- Planned: `sui-deepbook-achievement-profile`
- Planned: `sui-deepbook-leaderboard`

### Predict Strategy Apps

Keep in `sui-deepbook-predict`:

- trading
- portfolio
- vault
- surface
- keeper
- basic strategy tabs

Planned modules:

- `sui-deepbook-trend-predict`
  - MA/ROC/no-trade logic
  - maps signal to Predict oracle, expiry, direction, strike
  - always displays risk warning and not-guaranteed copy
- `sui-deepbook-predict-backtest`
  - fetch/import candles
  - backtest MA/ROC rules
  - show winrate, expectancy, drawdown, no-trade frequency

## Static HTML Design

Recommended page:

```text
deepbook.html
```

Layout:

- Sticky top bar:
  - DeepBook title
  - network selector
  - wallet connect/account
  - global live status
- First viewport:
  - `DeepBook Mission Control`
  - recommended next action
  - primary CTAs:
    - `Trade Now`
    - `Predict With Trend`
    - `Manage Risk`
    - `Run Bot`
    - `Earn Points`
- Main workspace:
  - grouped navigation
  - active app panel
  - plugin rendered inside `ShadowContainer`
- Desktop side rail:
  - wallet summary
  - quests
  - alerts
  - recent actions
- Mobile:
  - action cards first
  - compact navigation
  - no dense 13-tab row

## Navigation Groups

- `Home`: Mission Control
- `Trade`: Swap, Orderbook, Market Radar
- `Predict`: Predict Command Center, Trend Predict, Backtest
- `Portfolio`: Portfolio, History, Risk Center
- `Bots`: Hedging Monitor, Hedging Bot, Bot Arena
- `Rewards`: Quest Board, Achievements, Leaderboard
- `Advanced`: Pool Explorer, Price Feed, Margin Manager, Analysis

## Implementation Defaults

- Reuse `SuiHostAPI` from `src/sui-dashboard`.
- Reuse plugin path pattern:
  - dev: `plugins/<name>/plugin.tsx`
  - production: `assets/plugins/<name>.js`
- Load only Home/Mission Control initially.
- Lazy-load other DeepBook plugins when the user opens a group/app.
- Keep existing plugin folders intact.
- Do not merge all DeepBook logic into one giant plugin.
- Add `deepbook.html` to `vite.config.ts` inputs when implementing.

## Test Plan

- Open `deepbook.html` without wallet: Mission Control loads, connect wallet is primary CTA.
- Connect wallet: wallet state is shared across plugins.
- Trade group: Swap and Orderbook load without losing wallet context.
- Predict group: Predict plugin can request wallet signing through host.
- Bots group: hedging monitor/bot entry is discoverable without cluttering Home.
- Existing standalone pages still work.

