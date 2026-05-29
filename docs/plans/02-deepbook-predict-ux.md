# DeepBook Predict UX Optimization Plan

## Summary

Optimize the dashboard for a first-time trader, reduce the number of actions required to use the product, and create a strong first impression within the first 30-60 seconds while keeping the existing technical tabs available for judges and professional users.

UX strategy: add a Dashboard Shell / Action Hub above the current plugin and turn the product from "13 technical tabs" into "3 primary user actions":

- `Start Guided Trade`: oracle -> strike -> amount -> preview -> wallet signature.
- `Analyze Market`: oracle health, SVI surface, fair value, and risk.
- `Earn with PLP`: vault APY/risk and supply/hedge actions.

## First-Screen Action Hub

- Compact hero status:
  - BTC spot / forward
  - selected oracle expiry + time left
  - oracle health: `HEALTHY / DELAYED / STALE`
  - wallet state
  - DUSDC balance when available
- CTAs:
  - `Start Guided Trade`
  - `Analyze Market`
  - `Earn with PLP`
- If wallet is not connected, primary CTA is `Connect Wallet`.
- If oracle is stale, trading CTA becomes a disabled warning and the secondary CTA routes to `Analyze Market`.

## Guided Trade Flow

1. `Choose Market`
   - Auto-select the nearest active oracle that still has enough safe time before expiry.
   - Show "BTC settles in X min" instead of object ID as primary copy.
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

## Navigation Simplification

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

Defaults:

- Do not remove any tab.
- Desktop: show primary tabs first and group advanced tabs under `More`.
- Mobile/narrow widths: use horizontal scroll or `More` menu.
- Action Hub CTAs switch to the correct tab and scroll to the relevant action area.

## Friendly Dashboard Information

- `What can I do now?`
  - "Trade active BTC prediction"
  - "Claim settled position"
  - "Supply DUSDC to PLP"
  - "Review stale oracle risk"
- `Recommended next action`
  - If not connected: connect wallet.
  - If claimable position exists: claim first.
  - If active oracle is healthy: start guided trade.
  - If stale: analyze market.
- `Safety strip`
  - Oracle freshness
  - Time to expiry
  - Max loss preview
  - Testnet/DUSDC reminder

## Types

```ts
type UserIntent = 'trade' | 'analyze' | 'earn' | 'claim'
type GuidedTradeStep = 'market' | 'prediction' | 'amount' | 'preview' | 'submit'
type FeatureStatus = 'live' | 'simulated' | 'experimental' | 'requires-wallet'
```

## Test Plan

- Wallet disconnected: dashboard shows connect wallet as primary CTA.
- Wallet connected, healthy oracle: guided flow reaches preview and signing.
- Stale oracle: trading CTA is blocked and user sees a clear reason.
- No DUSDC: error explains the missing token and next action.
- Mobile: primary actions remain visible and advanced tabs do not clutter.
- Regression: existing Market, Surface, Risk, Trade, Vault, Portfolio, and Keeper flows still render.

