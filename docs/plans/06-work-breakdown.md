# Work Breakdown

## Phase 0 - Documentation and Alignment

Owner type: Product/engineering lead

- Keep `docs/plans/README.md` as the planning index.
- Keep source-specific docs in `docs/deepbook/` and `docs/deepbook/predict/`.
- Decide whether `deepbook.html` becomes the main user-facing DeepBook entry.
- Confirm the first build target:
  - recommended: DeepBook Suite shell + Mission Control
  - defer: full Commander TaskOS command routing

Acceptance:

- Product direction is clear.
- Work can be assigned by app/module.
- Existing standalone pages are not removed.

## Phase 1 - DeepBook Suite Shell

Owner type: frontend/platform

- Create `deepbook.html`.
- Create `src/deepbook/main.tsx`.
- Create `src/deepbook/DeepBookSuite.tsx`.
- Reuse `SuiHostAPI`, wallet context, plugin loader, and `ShadowContainer`.
- Add grouped navigation:
  - Home
  - Trade
  - Predict
  - Portfolio
  - Bots
  - Rewards
  - Advanced
- Lazy-load existing DeepBook plugins.

Acceptance:

- User can open `deepbook.html`.
- Wallet connect works.
- Existing DeepBook plugins load in grouped navigation.
- Existing static pages still work.

## Phase 2 - Mission Control and Recommended Actions

Owner type: frontend/product

- Add DeepBook Mission Control.
- Show wallet state, selected network, and global status.
- Add recommended next action rules:
  - disconnected -> connect wallet
  - risk exposure -> review risk
  - healthy Predict oracle -> guided Predict trade
  - claimable settlement -> claim
  - no history -> first swap/orderbook review
- Add status badges:
  - `Live`
  - `Actionable`
  - `At Risk`
  - `Completed`
  - `Simulated`
  - `No Trade`

Acceptance:

- Every connected wallet state produces at least one useful recommendation.
- Empty states route to useful actions.

## Phase 3 - Predict UX Upgrade

Owner type: Predict/frontend

- Add Action Hub to Predict.
- Add guided trade flow:
  - choose market
  - choose prediction
  - enter amount
  - preview
  - submit
- Add safety strip:
  - oracle freshness
  - time to expiry
  - max loss
  - DUSDC/testnet reminder
- Simplify tab hierarchy:
  - primary: Market, Trade, Portfolio, Vault
  - advanced: Surface, Risk, Strategy, PLP+Hedge, Loop, Arb, Lending, Spot, Keeper

Acceptance:

- New user can create a small trade in at most 5 actions after wallet connect.
- Stale oracle blocks trading and explains why.
- No DUSDC state gives a clear next action.

## Phase 4 - Gamification

Owner type: frontend/product

- Add Quest Board.
- Add local/session mission state.
- Add daily quests:
  - swap
  - review orderbook
  - check risk
  - inspect bot
  - review Predict signal
  - claim settlement
- Add Achievement Profile:
  - first swap
  - first Predict trade
  - first bot cycle
  - first risk review
  - 7-day streak
- Add local leaderboards if no backend exists.

Acceptance:

- Quest completion updates UI state.
- Returning user sees progress/streak context.
- No backend is required for v1.

## Phase 5 - Trend Predict

Owner type: quant/frontend

- Add Trend Predict Lab.
- Add candle input/fetching path.
- Implement MA/ROC signal rules:
  - above SMA50/100 + positive slope -> UP only
  - below SMA50/100 + negative slope -> DOWN only
  - whipsaw/sideway -> NO_TRADE
- Map signal to Predict oracle/expiry/strike.
- Compare estimated probability vs implied probability/fair value.
- Add risk language: no guaranteed wins, backtest required, max loss visible.

Acceptance:

- Bullish, bearish, and sideway regimes produce distinct outputs.
- NO_TRADE suggests range/PLP+hedge instead of forcing a trade.
- Live minting still requires explicit wallet approval.

## Phase 6 - Commander TaskOS

Owner type: platform/product

- Add Commander profile from wallet state.
- Add command input with deterministic routing.
- Add mission/task model:
  - recommended
  - available
  - active
  - completed
  - blocked
- Add task stepper and approval preview.
- Add plugin capability registry.

Acceptance:

- User can type commands such as "predict trend" or "review risk".
- TaskOS routes to the right mission/plugin.
- Transaction tasks never bypass wallet approval.

## Phase 7 - Verification

Owner type: QA/engineering

- Run:

```bash
rtk bun run build
```

- Manual test:
  - `deepbook.html`
  - `sui-deepbook-predict.html`
  - `sui-deepbook-hedging-bot.html`
  - `sui-plugin.html`
  - `sui-plugin-wasm.html`

Acceptance:

- Existing pages still render.
- Wallet connection works across DeepBook Suite.
- Plugin CSS remains isolated in Shadow DOM.
- Production plugin paths resolve.

