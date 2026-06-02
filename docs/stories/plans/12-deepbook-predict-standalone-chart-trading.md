# DeepBook Predict Standalone Chart Trading Page

## Summary

Create `deepbook-predict.html` as a standalone DeepBook Predict page following the same page-host structure as `btc-chart.html`.

The new page should load the existing `SuiDeepBookPredict` plugin inside a `ShadowContainer`, wire Sui wallet/DAppKit support, and keep existing routes unchanged. On the Trade chart, clicking a price level or dragging a range should open a popup where the user enters DUSDC, previews the position, and confirms the mint transaction.

Existing positions must load after wallet connect and render as chart overlays for the selected oracle.

## Page Structure

- Add `deepbook-predict.html`.
- Add `src/deepbook-predict/main.tsx`.
- Add `src/deepbook-predict/DeepBookPredictPage.tsx`.
- Add `src/deepbook-predict/deepbook-predict.css`.
- Match the standalone host pattern from `btc-chart.html` and `src/btc-chart/BtcChartPage.tsx`.
- Keep `sui-deepbook-predict.html`, `deepbook.html`, and `btc-chart.html` unchanged.
- Update `vite.config.ts` entries and build inputs with `deepbook-predict.html`.

## Wallet And Host Wiring

- Use `DAppKitProvider`, `createDAppKit`, and `SuiGrpcClient`.
- Default network: `testnet`.
- Supported networks: `mainnet`, `testnet`, `devnet`.
- Register `suiHostAPI` actions:
  - `onConnect`
  - `onDisconnect`
  - `onNetworkSwitch`
  - `onSignAndExecuteTransaction`
  - `onSignPersonalMessage`
- Sync wallet context:
  - address
  - network
  - connection state
  - wallet profile shared data
  - transaction refresh shared data
- Add a compact wallet bar:
  - disconnected state shows `Connect Wallet`
  - connected state shows short address, network, and disconnect
  - plugin-triggered `requestConnect()` opens wallet picker

## Predict Plugin Loading

- Load `plugins/sui-deepbook-predict/plugin.tsx` in dev.
- Load `assets/plugins/sui-deepbook-predict.js` in production.
- Render registered component `SuiDeepBookPredict`.
- Use `/plugins/sui-deepbook-predict/style.css` inside `ShadowContainer`.
- Do not fork the Predict plugin.
- Do not duplicate Predict business logic in the standalone page.

## Chart Popup Flow

- Extend `PredictPositionChart` to emit a chart trade draft.
- In binary mode:
  - click chart price level
  - infer `UP` if selected strike is above/equal spot
  - infer `DOWN` if below spot
  - open popup with selected strike and direction
- In range mode:
  - drag vertically over chart
  - infer lower and upper strikes
  - open popup with selected range
- Add `ChartTradePopup`.
- Popup must include:
  - selected mode
  - strike or range
  - spot
  - oracle expiry
  - DUSDC amount input
  - fair value/probability preview when SVI and forward are available
  - degraded preview state when SVI or forward is missing
  - wallet-required warning when disconnected
  - `Cancel`
  - `Confirm`
- Confirm should mint the position, not only fill the existing form.
- After successful transaction:
  - show transaction digest
  - set `txRefresh`
  - refresh overlays
  - close popup

## Draft And Action Interfaces

```ts
type ChartTradeDraft =
  | {
      mode: 'binary'
      oracleId: string
      strike: number
      isUp: boolean
      spot: number
    }
  | {
      mode: 'range'
      oracleId: string
      lowerStrike: number
      upperStrike: number
      spot: number
    }
```

```ts
interface ChartTradePopupProps {
  draft: ChartTradeDraft | null
  amountDUSDC: string
  oracleState: unknown
  disabled?: boolean
  isConnected: boolean
  onAmountChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => Promise<void>
}
```

```ts
interface TradeActionResult {
  digest: string
  managerId: string
}
```

## Transaction Logic

- Move shared mint transaction logic into `plugins/sui-deepbook-predict/application/tradeActions.ts`.
- Required actions:
  - `ensurePredictManager`
  - `mintBinaryPosition`
  - `mintRangePosition`
- Optional follow-up actions:
  - `redeemBinaryPosition`
  - `redeemRangePosition`
- `TradePanel` and `ChartTradePopup` must share the same action functions.
- Avoid duplicated PTB-building logic in React render components.

## Existing Position Loading

- Existing positions load after wallet connect.
- Discover managers by wallet owner.
- Fetch binary positions from `/managers/:manager_id/positions/summary`.
- Fetch range mints from `/ranges/minted?manager_id=...`.
- Fetch range redeems from `/ranges/redeemed?manager_id=...`.
- Net open ranges before rendering.
- Filter overlays by selected oracle.
- Render open binary and range overlays on the chart.
- Refresh overlays after successful mint.
- When wallet is disconnected, render chart without user overlays.
- When indexer is delayed or fails, show a non-blocking degraded state.

## Test Plan

- Run `rtk bun run build`.
- Run `rtk bun test plugins/sui-deepbook-predict/domain/domain.test.js`.
- Add or extend overlay tests for:
  - binary overlay mapping
  - range mint/redeem netting
  - redeemed-out ranges hidden
  - selected-oracle filtering
  - disconnected wallet empty overlays
- Run local dev server and check:
  - `/deepbook-predict.html` returns `200 text/html`
  - `/btc-chart.html` returns `200 text/html`
  - `/sui-deepbook-predict.html` returns `200 text/html`
- Manual QA disconnected:
  - page loads
  - plugin renders
  - chart renders
  - chart click opens popup
  - confirm is disabled or blocked until wallet connect
- Manual QA connected:
  - wallet connects
  - existing positions render as overlays
  - chart click opens binary popup
  - DUSDC input updates preview
  - confirm signs and mints
  - overlay refreshes after transaction
- Manual QA range:
  - range mode drag opens range popup
  - DUSDC input updates preview
  - confirm mints range
  - overlay appears after refresh
- Production preview:
  - plugin JS resolves
  - plugin CSS resolves inside Shadow DOM
  - wallet modal opens

## Assumptions

- User text says `DUSD`, but protocol quote asset is `DUSDC`; UI should label it `DUSDC`.
- Existing positions can only load correctly after wallet connect because manager discovery is owner-based.
- Popup uses `Preview first`: enter DUSDC, show estimate, then confirm mint.
- Existing Predict plugin remains the source of truth for protocol behavior.
- No Move contract changes are required.
- No new backend/indexer endpoint is required.

## Implementation Order

1. Add `deepbook-predict.html`.
2. Add `src/deepbook-predict/main.tsx`.
3. Add `src/deepbook-predict/DeepBookPredictPage.tsx`.
4. Add `src/deepbook-predict/deepbook-predict.css`.
5. Update `vite.config.ts`.
6. Define `ChartTradeDraft`.
7. Update `PredictPositionChart` to emit drafts.
8. Add `ChartTradePopup`.
9. Extract shared mint actions into `tradeActions.ts`.
10. Wire popup into Trade tab.
11. Refresh overlays on wallet connect, oracle switch, and successful transaction.
12. Add or extend overlay tests.
13. Run build, tests, and local HTTP checks.
14. Commit as `feat: add standalone DeepBook Predict chart trading page`.
