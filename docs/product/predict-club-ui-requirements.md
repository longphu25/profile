# Predict Club UI Requirements

This document is the stable UI contract for Predict Club. It lists the surfaces,
states, and interaction rules that the implementation should preserve while the
plugin moves from demo data to wallet-signed DeepBook Predict execution.

## Product Intent

Predict Club is an operational cockpit for community Predict rounds. The first
screen must help a new member answer five questions quickly:

1. What market and oracle is this round using?
2. What direction, strike, expiry, and pledged amount are active?
3. What is my cost, probability, payout, and risk?
4. Can my wallet execute now?
5. If not, what exact step is blocking me?

The UI should be dense, quiet, and scannable. It should not behave like a
marketing page and should not bury execution readiness behind multiple panels.

## Top Bar

Required:

- Brand: `PREDICT CLUB`.
- Navigation: `Clubs`, `Market`, `History`, `Leaderboard`.
- Network indicator, currently `Testnet`.
- Wallet summary for `SUI`, `USDC`, and `DUSDC`.
- Wallet icon trigger.
- Wallet address trigger when connected.

Rules:

- Connected wallet icon and address open the wallet profile popup.
- Disconnected wallet controls open wallet connect.
- Disconnect belongs inside the wallet profile popup, not on the address
  button.
- Any address or object id shown in the top bar must be copyable or linkable
  through the shared address control.

## Decision Strip

The decision strip is the primary round summary and should stay visible near
the top of the page.

Required cells:

- Asset: `BTC` plus live spot price.
- Forward: DeepBook Predict forward price.
- Direction: `ABOVE`, `BELOW`, or `RANGE`.
- Strike: one strike for binary, lower and upper strikes for range.
- Expiry: countdown and freshness, for example `Exp 16h 7m · 0s ago`.
- Pledged: total pledged DUSDC.
- Price ticks: count plus a compact 24-tick mini chart.
- Active Oracles: button/list placed on the right side.

Rules:

- DeepBook Oracle belongs in the decision strip, not hidden in the risk panel.
- Spot and forward prices should use money/data color treatment.
- The mini chart must use stable dimensions and must not shift layout while
  new ticks arrive.
- The strip should expose one primary action for the current lifecycle phase.

## Center: Prediction Room

Required:

- Header: `Prediction Room`, round id, phase, and confidence.
- Signal evidence collapsed by default.
- Expanded signal evidence in three compact columns:
  - market and price evidence
  - indicator evidence
  - oracle and risk evidence
- Leader thesis and timestamp.
- Indicator consensus:
  - bias: `Bullish`, `Bearish`, `Neutral`, or `No-trade`
  - confidence: `High`, `Medium`, or `Low`
  - main indicators such as RSI, order flow, box flip, trend, and volatility
- Round summary: direction, strike/range, amount, and preview state.

Rules:

- Do not overload this panel with funding and wallet details.
- If comments or activity become noisy, move them to history or a compact
  activity section.

## Left Panel: Club And Members

Required:

- Club name.
- Leader row with role.
- Member rows with:
  - name or short wallet
  - status: `Watching`, `Pledged`, `Accepted`, `Executed`, `Claimed`
  - pledged amount when available
- Current connected wallet row, labeled `You` when no known member matches.
- Compact club stats such as member count, win rate, and total pledged.

Rules:

- The panel should not grow taller than the workspace without internal scroll.
- The current user row should be visible but not visually louder than execution
  state.

## Right Panel: Risk And Execution

Required blocks:

- Risk Checks.
- Your Exposure.
- Contract Quote.
- Portfolio summary.
- Vault summary.

Rules:

- Keep `Risk Checks` as the single readiness checklist. Do not duplicate it
  with a separate `Ready to execute` block.
- Every blocked state must include a concrete reason.
- Do not display raw Move aborts as user-facing copy. Map them to short
  actionable messages and keep the raw error for debug output.

## Risk Checks

Required checks:

- Wallet connected.
- PredictManager available.
- DUSDC balance enough.
- Oracle active.
- Price fresh.
- SVI fresh.
- Quote available.
- Vault liquidity enough.
- Expiry valid.

Allowed aggregate states:

- `Ready`
- `Review`
- `Blocked`

## Your Exposure

Required metrics:

- Stake or estimated cost.
- Win Probability.
- Indicative payout or gross if win.
- Potential profit.
- Risk/Reward.

Formatting rules:

- DUSDC values should use at most 2 to 4 decimals depending on scale.
- Probability must remain within `0%` and `100%`.
- Very small probability should use a display floor such as `<0.1%`.
- Never render very long raw numbers.
- If SVI, forward, expiry, or quote data is missing, show
  `Preview unavailable` with a short reason.

## Funding Router

Required routes:

- Direct DUSDC.
- Escrow USDC to DUSDC.
- Swap SUI to USDC.
- Bridge to Sui.
- P2P Escrow Offers.

Each route should show:

- available amount
- status: `Ready`, `Available`, `Review`, `Blocked`, or `External`
- action button when usable
- disabled reason when blocked

Rules:

- Non-Direct-DUSDC routes remain preview-only until wallet-signed integration is
  implemented.
- Keep the panel compact. Detailed route explanations belong in modals or docs.

## Escrow Offers

Required fields:

- provider
- amount
- asset pair
- status: `Open`, `Reserved`, `Filled`, or `Cancelled`
- action: `Fill`, `Cancel`, or disabled reason

Required flows:

- create offer
- fill offer
- reserve or mark filled
- cancel if owner

If escrow is still local/demo, label it clearly.

## Portfolio And Positions

Required:

- Open position count.
- Binary positions.
- Range positions.
- Direction.
- Strike or range.
- Amount.
- Entry price or contract price.
- Potential payout.
- Expiry.
- Status.
- Claimable or settled state when available.

Rule:

- Range positions must not disappear silently. If parsing is incomplete, show a
  clear unsupported state and keep the row visible.

## Vault Summary

Required:

- available liquidity
- total liquidity when available
- max payout
- utilization
- wallet PLP balance
- wallet LP share

Rules:

- Use `Unavailable` when real data is missing.
- Do not use demo liquidity unless it is explicitly labeled as demo/local.

## Wallet Profile Popup

Required:

- Active wallet address with copy and SuiScan testnet link.
- Account list.
- Token balances.
- PredictManager id/status.
- Manager DUSDC balance.
- Open positions.
- Vault context.
- Disconnect action.

Performance rules:

- Mount only when open.
- Do not use full-screen heavy `backdrop-filter`.
- Cache wallet profile reads and share in-flight requests.
- Use cached values when public RPC returns `429 Too Many Requests`.

## Address Interaction

Every Sui account or object id shown in the UI should use a shared address
control:

- short display
- copy full value
- SuiScan testnet external link
- tooltip or accessible label for icon-only actions

Account URL:

```text
https://suiscan.xyz/testnet/account/<address>
```

Object URL:

```text
https://suiscan.xyz/testnet/object/<object-id>
```

## Loading And Error States

Required states:

- wallet disconnected
- wallet connecting
- RPC rate limited
- oracle API unavailable
- missing SVI
- missing forward
- stale oracle
- quote failed
- PredictManager unavailable
- vault unavailable
- no open positions
- no escrow offers

Rules:

- Prefer inline skeletons or compact loading states.
- Avoid large global spinners after the first page load.
- Keep user-facing error messages short and actionable.

## Developer Guardrails

- Keep `PredictClubContext.tsx` component-only for Vite Fast Refresh.
- Put context objects and types in `PredictClubContextCore.ts`.
- Put hooks in `usePredictClub.ts`.
- Share Sui RPC reads through context/services instead of letting each panel
  fetch independently.
- Re-index CodeGraph after broad source changes.
- Update QMD after docs changes.

## Minimum Validation

Before a UI change is considered done:

- `bun run build`
- focused Playwright test for `predict-club.html`
- wallet trigger count check
- popup open check when the wallet fixture is available
- no severe page errors
- docs updated when behavior or contract changes
