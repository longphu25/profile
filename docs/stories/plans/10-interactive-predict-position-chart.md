# Interactive Predict Position Chart Plan

## Summary

Add an interactive position chart to the DeepBook Predict Trade and Portfolio experience.

The chart should let users select Predict positions visually:

- Click a price to choose a binary strike.
- Auto-select `UP` or `DOWN` from the clicked price relative to spot.
- Drag a price band to choose a range position.
- Show already minted binary and range positions on the chart.

The chart is a selector and visualization layer only. It does not auto-trade. Existing wallet-signed mint/redeem PTB flows remain unchanged.

## Current Context

The current Predict plugin already supports:

- binary and range mint/redeem in `TradePanel`
- oracle price history via `GET /oracles/:oracle_id/prices`
- binary position reads via `GET /managers/:manager_id/positions/summary`
- range reconstruction from `/ranges/minted?manager_id=...` and `/ranges/redeemed?manager_id=...`

The current in-plugin price chart is a static bar chart. BTC Chart Pro already uses `lightweight-charts`, but it is loaded for the separate BTC chart entry. For Predict, add a project dependency/import instead of relying on a global CDN.

## Key Changes

### Chart Picker

- Add `PredictPositionChart` inside the Trade tab above the existing form.
- Render selected oracle price history as a candlestick or line chart.
- Use the selected oracle's spot, min strike, and tick size to snap all chart selections.
- Keep existing form inputs as the source of transaction state, with chart interactions filling those inputs.

Binary behavior:

- Click above spot:
  - set mode to `binary`
  - set strike to clicked price
  - set direction to `UP`
- Click below spot:
  - set mode to `binary`
  - set strike to clicked price
  - set direction to `DOWN`
- Click near spot:
  - set strike to ATM
  - keep previous direction, defaulting to `UP`

Range behavior:

- Add chart picker mode: `Binary Click` / `Range Drag`.
- In `Range Drag`, pointer down starts a range, pointer move previews it, pointer up commits it.
- Sort and snap bounds before writing form state.
- Reject ranges where snapped `lowerStrike >= upperStrike`.

### Position Overlays

- Load open positions for the connected wallet's manager(s).
- Show binary positions as horizontal lines:
  - green for `UP`
  - red for `DOWN`
  - label: `UP $strike · qty` or `DOWN $strike · qty`
- Show ranges as translucent horizontal bands:
  - label: `$lower-$upper · qty`
  - band boundaries align to snapped strikes
- Show status styling:
  - `open`: solid
  - `awaiting-settlement`: dashed
  - `settled` or `claimable`: highlighted

### Range-Aware Data

Do not use `/positions/minted` or `/trades/:oracle_id` as the source for ranges.

Range data must come from:

- `/ranges/minted?oracle_id=...`
- `/ranges/redeemed?oracle_id=...`
- `/ranges/minted?manager_id=...`
- `/ranges/redeemed?manager_id=...`
- `/managers/:manager_id/ranges` if the endpoint is available

For oracle-level charts, merge binary trades and range events client-side until DeepBook exposes a unified range-aware trade endpoint.

## Interfaces / Types

```ts
type ChartPickMode = 'binary' | 'range'

type PositionOverlayStatus =
  | 'open'
  | 'awaiting-settlement'
  | 'settled'
  | 'claimable'

interface ChartBinarySelection {
  mode: 'binary'
  strike: number
  isUp: boolean
}

interface ChartRangeSelection {
  mode: 'range'
  lowerStrike: number
  upperStrike: number
}

type ChartPositionSelection = ChartBinarySelection | ChartRangeSelection

interface PositionOverlay {
  id: string
  kind: 'binary' | 'range'
  oracleId: string
  quantity: number
  status: PositionOverlayStatus
  strike?: number
  isUp?: boolean
  lowerStrike?: number
  upperStrike?: number
}
```

## Implementation Notes

- Add `lightweight-charts@4.2.0` as a project dependency before implementation.
- `TradePanel` owns selected form state:
  - `mode`
  - `strike`
  - `isUp`
  - `lowerStrike`
  - `upperStrike`
  - `amount`
- `PredictPositionChart` emits `ChartPositionSelection`.
- `TradePanel` applies the selection to existing inputs and preview calculations.
- Use a custom overlay canvas or SVG layer for drag preview and range bands if native price lines are not enough.
- Do not change Move calls or transaction semantics.
- Because this is a user-facing feature, bump `package.json` minor version when implementing.

## Test Plan

- Click above spot sets binary `UP` and snapped strike.
- Click below spot sets binary `DOWN` and snapped strike.
- Click near spot sets ATM strike without invalid direction churn.
- Drag upward or downward creates the same sorted range.
- Invalid range drag shows a warning and keeps previous valid range state.
- Open binary positions render as chart lines.
- Open range positions render as bands.
- Redeemed range quantity is netted out and not shown as open.
- Switching oracle refreshes candles and overlays for the selected oracle only.
- Wallet disconnected users can still plan a position on chart, but execution requires wallet connection.
- Desktop and mobile layouts keep chart, selected summary, and form controls readable.
- `rtk bun run build` passes.

## Related Docs

- `docs/stories/plans/08-deepbook-predict-user-assist.md`
- `docs/stories/plans/09-predict-manager-bot-architecture.md`
- `docs/deepbook/onchain-finance/deepbook-predict.md`
- `docs/deepbook/btc/overview.md`
- `docs/deepbook/btc/order-flow-overlay.md`
- `plugins/sui-deepbook-predict/components/PortfolioTab.tsx`
- `plugins/sui-deepbook-predict/plugin.tsx`

## Assumptions

- Auto-direction uses price relative to current spot.
- Chart interactions only prepare form state.
- Existing numeric inputs remain available for precise edits.
- Range endpoint data remains separate from binary endpoints.
- A future unified range-aware `/trades/:oracle_id` endpoint would simplify the data layer but is not required for v1.
