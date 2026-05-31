# DeepBook Static App & Plugin Split Plan

## Status

| Item | Status |
|------|--------|
| `deepbook.html` | ✅ Done |
| `src/deepbook/main.tsx` | ✅ Done |
| `src/deepbook/DeepBookSuite.tsx` | ✅ Done — grouped nav, lazy-load, wallet context |
| `src/deepbook/MissionControl.tsx` | ✅ Done — recommended actions, daily quests |
| `vite.config.ts` updated | ✅ Done |
| ActionHub in `sui-deepbook-predict` | ✅ Done — status strip, 3 primary CTAs |
| Primary/More tab grouping in Predict | ✅ Done — 4 primary + More dropdown |

## Summary

Không nên tiếp tục tạo một static HTML riêng cho từng plugin nhỏ. Với DeepBook, nên tạo một static page tổng:

- HTML: `deepbook.html`
- React entry: `src/deepbook/main.tsx`
- Root app: `src/deepbook/DeepBookSuite.tsx`
- Runtime: dùng lại `SuiHostAPI`, `ShadowContainer`, `loadSuiPlugin`, wallet/shared context giống `sui-plugin.html`

Mục tiêu: biến các plugin DeepBook hiện có thành một **DeepBook Suite** có navigation, action hub, wallet context, recommended actions, và load plugin theo nhu cầu.

Các page chuyên biệt hiện có vẫn giữ làm deep link:

- `sui-deepbook-predict.html`: dành cho Predict demo/submission riêng
- `sui-deepbook-hedging-bot.html`: dành cho bot lớn, cần không gian riêng
- `sui-plugin.html`: giữ làm generic Sui plugin dashboard
- `sui-plugin-wasm.html`: giữ làm dashboard kỹ thuật/WASM/plugin catalog

## Plugin Split

Chia plugin theo **user workflow**, không chia quá nhỏ theo từng widget.

### 1. DeepBook Core Apps

Nhóm plugin dùng thường xuyên, nên hiện ở navigation chính:

- `sui-deepbook-home`
  - New plugin/app module.
  - Mission Control: wallet summary, market status, recommended next action, quests, quick launch.

- `sui-swap`
  - Giữ plugin hiện tại.
  - Vào nhóm `Trade`.

- `sui-deepbook-orderbook`
  - Giữ plugin hiện tại.
  - Dùng trong `Trade` và `Market Radar`.

- `sui-deepbook-portfolio`
  - Giữ plugin hiện tại.
  - Vào nhóm `Portfolio`.

- `sui-deepbook-predict`
  - Giữ plugin lớn hiện tại.
  - Vào nhóm `Predict`.

### 2. Market & Analytics Apps

Nhóm plugin giúp user tìm cơ hội:

- `sui-pool-explorer`
  - Pool discovery, volume, spread, active/frozen state.

- `sui-price-feed`
  - Price cards, OHLCV, sparkline.

- `sui-deepbook-history`
  - Trades, fee breakdown, recent activity.

- `sui-deepbook-analysis`
  - Trend, indicators, market radar.

- New planned module: `sui-deepbook-market-radar`
  - Aggregates pool explorer + price feed + analysis into one actionable screen.
  - Shows tags like `High Volume`, `Wide Spread`, `Trending`, `Watch`.

### 3. Risk & Margin Apps

Nhóm plugin cho power users:

- `sui-margin-manager`
  - Margin positions, collateral, risk ratio.

- New planned module: `sui-deepbook-risk-center`
  - Aggregates portfolio + margin + open orders.
  - Promotes warnings before trade CTAs.
  - Shows `Safe`, `Caution`, `At Risk`.

### 4. Bot & Automation Apps

Nhóm plugin tăng tương tác lặp lại:

- `sui-hedging-monitor`
  - Monitor external bot instance.

- `sui-deepbook-hedging-bot`
  - Client-side bot.

- New planned module: `sui-deepbook-bot-arena`
  - Bot sessions, cycles, streaks, missions, runtime health.
  - Links into hedging bot page for full control.

### 5. Gamification Apps

Nhóm mới để tăng retention:

- New planned module: `sui-deepbook-quest-board`
  - Daily/weekly tasks: swap, review orderbook, inspect risk, run bot, review Predict signal.

- New planned module: `sui-deepbook-achievement-profile`
  - Streaks, completed missions, badges, trading milestones.

- New planned module: `sui-deepbook-leaderboard`
  - Local/session/indexer-derived v1 leaderboards:
    - volume
    - consistency
    - bot cycles
    - risk-adjusted PnL
    - Predict signal discipline

### 6. Predict Strategy Apps

Để tránh `sui-deepbook-predict` phình quá lớn, tách phần chiến lược nâng cao thành app/module riêng khi cần:

- Keep in `sui-deepbook-predict`:
  - trading
  - portfolio
  - vault
  - surface
  - keeper
  - basic strategy tabs

- New planned module: `sui-deepbook-trend-predict`
  - Trend/momentum signal lab.
  - MA/ROC/no-trade logic.
  - Maps signal to Predict oracle, expiry, direction, strike.
  - Always displays risk warning and "not guaranteed" copy.

- New planned module: `sui-deepbook-predict-backtest`
  - Import/fetch candles.
  - Backtest MA/ROC rules.
  - Show winrate, expectancy, drawdown, no-trade frequency.

## Static HTML Design

### Recommended Page

Use one new static page:

```text
deepbook.html
```

It should be the main product page for all DeepBook apps.

Reasoning:

- Short and user-facing.
- Not tied to Sui implementation detail.
- Easier to submit/share than `sui-plugin.html`.
- Keeps `sui-deepbook-predict.html` available for Predict-specific demo.

### Page Layout

`deepbook.html` should load a custom DeepBook Suite shell, not the generic dashboard.

Top-level layout:

- Sticky top bar:
  - DeepBook brand/title
  - network selector
  - wallet connect/account
  - global live status

- First viewport:
  - DeepBook Mission Control
  - recommended next action
  - primary CTAs:
    - `Trade Now`
    - `Predict With Trend`
    - `Manage Risk`
    - `Run Bot`
    - `Earn Points`

- Main workspace:
  - left navigation or compact top segmented nav
  - active app panel
  - plugin rendered inside `ShadowContainer`

- Right/secondary rail on desktop:
  - wallet summary
  - quests
  - alerts
  - recent actions

- Mobile:
  - action cards first
  - bottom or horizontal navigation
  - no dense 13-tab row

### Navigation Groups

Use groups instead of raw plugin list:

- `Home`
  - Mission Control

- `Trade`
  - Swap
  - Orderbook
  - Market Radar

- `Predict`
  - Predict Command Center
  - Trend Predict
  - Backtest

- `Portfolio`
  - Portfolio
  - History
  - Risk Center

- `Bots`
  - Hedging Monitor
  - Hedging Bot
  - Bot Arena

- `Rewards`
  - Quest Board
  - Achievements
  - Leaderboard

- `Advanced`
  - Pool Explorer
  - Price Feed
  - Margin Manager
  - Analysis

## Public Interfaces / Types

No on-chain changes required.

Add internal app-shell types when implementing:

```ts
type DeepBookAppGroup =
  | 'home'
  | 'trade'
  | 'predict'
  | 'portfolio'
  | 'bots'
  | 'rewards'
  | 'advanced'

type DeepBookAppIntent =
  | 'trade-now'
  | 'predict-trend'
  | 'manage-risk'
  | 'run-bot'
  | 'earn-points'
  | 'analyze-market'

type DeepBookAppStatus =
  | 'live'
  | 'simulated'
  | 'experimental'
  | 'requires-wallet'
  | 'coming-soon'
```

Suggested shell components:

- `DeepBookSuite`
- `DeepBookTopBar`
- `DeepBookMissionControl`
- `DeepBookAppNav`
- `DeepBookPluginWorkspace`
- `RecommendedActionPanel`
- `QuestRail`

## Implementation Defaults

- Reuse `SuiHostAPI` from `src/sui-dashboard`.
- Reuse plugin path pattern:
  - dev: `plugins/<name>/plugin.tsx`
  - production: `assets/plugins/<name>.js`
- Load only the Home/Mission Control app initially.
- Lazy-load other DeepBook plugins when the user opens a group/app.
- Keep existing plugin folders intact.
- Do not merge all DeepBook logic into one giant plugin.
- Add `deepbook.html` to `vite.config.ts` inputs when implementing.
- Add any new plugin entry to `vite.config.ts` only when the plugin is actually created.

## Test Plan

Manual scenarios:

- Open `deepbook.html` with no wallet:
  - Mission Control loads.
  - Primary CTA is connect wallet.
  - Apps requiring wallet are marked clearly.

- Connect wallet:
  - Wallet state is shared across loaded plugins.
  - Recommended actions update.

- Open Trade group:
  - Swap and Orderbook load without losing wallet context.

- Open Predict group:
  - Predict plugin loads and can request wallet signing through host.

- Open Bots group:
  - Hedging monitor/bot entry is discoverable without cluttering Home.

- Mobile/narrow viewport:
  - App groups remain usable.
  - No long 13-tab row.

- Regression:
  - Existing standalone pages still work.
  - Existing `sui-plugin.html` and `sui-plugin-wasm.html` behavior remains unchanged.
  - `bun run build` passes.

## Assumptions

- The best new static page name is `deepbook.html`.
- The main goal is a DeepBook product suite, not another generic plugin demo.
- Existing plugins should be reused and grouped, not rewritten.
- Large apps like Predict and Hedging Bot can keep dedicated static pages as deep links.
- The first implementation should prioritize navigation, Mission Control, and lazy-loading existing plugins before building new gamification modules.

