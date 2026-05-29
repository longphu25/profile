# DeepBook Predict UX Optimization Plan

## Summary

The goal is to optimize the dashboard for a first-time trader, reduce the number of actions required to use the product, and create a strong first impression within the first 30-60 seconds, while keeping the existing technical tabs available for judges and professional users.

UX strategy: add a Dashboard Shell / Action Hub above the current plugin and turn the product from "13 technical tabs" into "3 primary user actions":

- `Start Guided Trade`: the main flow, guiding the user from oracle -> strike -> amount -> preview -> wallet signature.
- `Analyze Market`: review oracle health, SVI surface, fair value, and risk.
- `Earn with PLP`: review vault APY/risk and supply/hedge actions.

This is not a full redesign. The existing tabs remain available, but the entry path into the product changes.

## Key Changes

### 1. First-Screen Action Hub

Add a top dashboard area above the tabs:

- Compact hero status:
  - BTC spot / forward
  - selected oracle expiry + time left
  - oracle health: `HEALTHY / DELAYED / STALE`
  - wallet state: connected / not connected
  - DUSDC balance when available
- 3 large CTAs:
  - `Start Guided Trade`
  - `Analyze Market`
  - `Earn with PLP`
- If the wallet is not connected:
  - the primary CTA is `Connect Wallet`
  - after connection, continue into guided trade step 1
- If the oracle is stale:
  - the trade CTA becomes a disabled warning
  - the secondary CTA routes to `Analyze Market`

### 2. Guided Trade Flow

Instead of requiring users to understand Market + Trade + Portfolio by themselves, add a linear flow inside the Trade tab or a modal/panel:

1. `Choose Market`
   - Auto-select the nearest active oracle that still has enough safe time before expiry.
   - Show "BTC settles in X min" as the main information instead of the object ID.
2. `Choose Prediction`
   - Presets: `BTC Up`, `BTC Down`, `Stay in Range`
   - Strike presets: `ATM`, `+500`, `+1000`, `-500`, `-1000`
   - Clear copy: "Wins if BTC > $X at expiry"
3. `Enter Amount`
   - Quick amounts: `10`, `25`, `50`, `100`, `Max safe`
   - Show DUSDC balance next to the input.
4. `Preview`
   - Win probability
   - Estimated cost
   - Max win
   - Max loss
   - Expiry countdown
5. `Submit`
   - Button: `Mint Position`
   - After transaction success: show digest + CTA `View Portfolio`

Acceptance behavior: a new user can create a trade in at most 5 actions after wallet connection.

### 3. Navigation Simplification

Keep all 13 tabs, but group them with clearer visual hierarchy:

- Primary tabs always visible:
  - `Market`
  - `Trade`
  - `Portfolio`
  - `Vault`
- Advanced group:
  - `Surface`
  - `Risk`
  - `Strategy`
  - `PLP+Hedge`
  - `Loop`
  - `Arb`
  - `Lending`
  - `Spot`
  - `Keeper`

Implementation defaults:

- Do not remove any tab.
- On desktop: show primary tabs first and group advanced tabs under `More`.
- On mobile/narrow widths: use horizontal scroll or a `More` menu.
- When the user clicks an Action Hub CTA, switch to the correct tab and scroll to the relevant action area.

### 4. Friendly Dashboard Information

Add information that creates trust and helps the user decide quickly:

- `What can I do now?`
  - "Trade active BTC prediction"
  - "Claim settled position"
  - "Supply DUSDC to PLP"
  - "Review stale oracle risk"
- `Recommended next action`
  - If not connected: connect wallet.
  - If there is a claimable position: claim first.
  - If there is a healthy active oracle: start guided trade.
  - If stale: analyze market.
- `Safety strip`
  - Oracle freshness
  - Time to expiry
  - Max loss preview
  - Testnet/DUSDC reminder
- Rewrite empty states around user actions:
  - Replace "No open positions" with "No open positions yet. Start with a small guided trade."
  - Replace "No DUSDC coins found" with "No DUSDC in wallet. Request testnet DUSDC, then retry."

## Public Interfaces / Types

Add minimal internal UI state types:

```ts
type UserIntent = 'trade' | 'analyze' | 'earn' | 'claim'
type GuidedTradeStep = 'market' | 'prediction' | 'amount' | 'preview' | 'submit'
type FeatureStatus = 'live' | 'simulated' | 'experimental' | 'requires-wallet'
```

Add reusable UI concepts:

- `ActionHub`
- `RecommendedAction`
- `GuidedTradePanel`
- `FeatureStatusBadge`
- `SafetyStrip`

No contract/API changes are required. Existing Predict server and wallet transaction paths remain unchanged.

## Test Plan

Manual scenarios:

- New user, wallet disconnected:
  - Dashboard shows connect wallet as the primary CTA.
  - `Start Guided Trade` does not dead-end.
- Wallet connected, active healthy oracle:
  - `Start Guided Trade` lands in the Trade flow.
  - Oracle, strike, direction, and amount can be selected with presets.
  - Preview shows win probability, cost, max win, and max loss before signing.
- Wallet connected, stale oracle:
  - Trading CTA is disabled or downgraded.
  - User sees a clear reason and can go to Analyze Market.
- User has no DUSDC:
  - Error explains what is missing and the next action.
- User has open/settled positions:
  - Dashboard recommends Portfolio or Claim before starting a new trade.
- Mobile/narrow viewport:
  - Primary actions remain visible.
  - Advanced tabs do not wrap into unusable multi-line clutter.
- Regression:
  - Existing Market, Surface, Risk, Trade, Vault, Portfolio, and Keeper flows still render.
  - `bun run build` passes.

## Assumptions

- The primary user is a new trader or hackathon judge trying the product for the first time.
- The primary CTA is `Start Guided Trade`.
- The preferred implementation is a dashboard shell layered above the current plugin, not a full redesign.
- All advanced quant/dev tooling remains available, but it no longer dominates the first screen.
- This is a UX optimization plan only; on-chain transaction semantics stay unchanged.
