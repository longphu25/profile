# Predict Club Wallet Profile Plugin Popup Plan

## Goal

Mount `plugins/sui-wallet-profile` inside Predict Club so a member can click the
wallet icon or connected wallet address and see a complete wallet/Predict
profile in one popup. The wallet profile plugin should own reusable wallet
profile UI, while Predict Club contributes Predict-specific sections such as
PredictManager, positions, and vault context.

This replaces the earlier direction of building a Predict Club-only
`WalletProfilePopup`. The better boundary is to upgrade `sui-wallet-profile`
into an embeddable profile plugin and let Predict Club consume it.

## Scope

In:

- Upgrade `plugins/sui-wallet-profile` with richer profile data and an embedded
  popup component.
- Mount `sui-wallet-profile` alongside `predict-club` in the Predict Club host.
- Topbar wallet icon and connected wallet address button open the embedded
  wallet profile popup.
- Full Sui addresses in the wallet popup are copyable.
- Wallet/account addresses include SuiScan testnet links.
- Predict Club publishes Predict-specific wallet context for the popup:
  PredictManager, balances, portfolio counts, positions, and vault summary.

Out:

- Repo-wide address renderer refactor across unrelated plugins.
- New Predict/DeepBook API calls beyond data already available in Predict Club
  context.
- Breaking the existing standalone `SuiWalletProfile` plugin mount.
- Mainnet explorer switching. This story uses SuiScan testnet by default.

## Target Architecture

`sui-wallet-profile` should expose two usage modes:

- `SuiWalletProfile`: backward-compatible standalone component. It may keep its
  own `DAppKitProvider` wrapper when mounted outside a Sui-aware host.
- `SuiWalletProfile.Popup` or `SuiWalletProfile.Embedded`: provider-free
  component intended to run inside a host that already has Sui context.

The plugin should keep wallet primitives in one place:

- active address
- SuiNS name
- wallet name/icon when available
- network
- account list
- token balances
- copy address behavior
- SuiScan account/object links
- disconnect action

Predict Club should provide domain-specific extension data through host shared
data, for example:

```ts
host.setSharedData('predictClubWalletProfile', {
  manager,
  balances,
  binaryPositions,
  rangePositions,
  vault,
})
```

The embedded wallet profile can render this extension as an optional Predict
section. If the shared data is absent, the wallet profile popup still works as a
generic wallet profile.

## User Experience

Connected wallet state:

- Clicking the wallet icon opens the `SuiWalletProfile` popup.
- Clicking the wallet address opens the same popup.
- The address button no longer disconnects directly.
- Disconnect moves into the popup to avoid accidental disconnects.
- The popup closes on backdrop click, close button, or Escape.

Disconnected wallet state:

- Clicking the wallet icon or wallet button opens the existing connect wallet
  panel.
- If no wallet extension is detected, keep the existing empty state.

Address behavior:

- Full Sui addresses are rendered through a copyable address control owned by
  `sui-wallet-profile`.
- Clicking the copy control copies the full address, never a shortened demo
  string.
- Wallet/account addresses show an external-link icon to:

```text
https://suiscan.xyz/testnet/account/<address>
```

Object ids such as PredictManager can use:

```text
https://suiscan.xyz/testnet/object/<object-id>
```

## Popup Content

Wallet header:

- Wallet name/icon when available.
- Active address with copy and SuiScan actions.
- SuiNS name when available.
- Network badge, defaulting to `testnet`.

Accounts:

- Use `host.getSuiContext().accounts` when available.
- If no account list exists, fallback to the active address.
- Each account row shows wallet name/icon, short address, copy action, and
  SuiScan action.

Balances:

- Token list from the wallet profile plugin when available.
- Predict Club may override or annotate SUI, USDC, and DUSDC balances from
  `PredictClubContext.balances`.
- Show `Unavailable` rather than fake values when data is missing.

Predict extension:

- PredictManager id/status.
- Manager DUSDC balance.
- Binary position count.
- RANGE position count.
- Compact position list when available.

Vault extension:

- Available liquidity.
- Total max payout.
- Total MTM.
- Available withdrawal.
- Wallet PLP balance and wallet LP share when available.

Actions:

- Copy address.
- View wallet on SuiScan.
- Disconnect wallet.

## Implementation Plan

1. Refactor `plugins/sui-wallet-profile` into reusable layers:
   - provider-free `WalletProfileContent`
   - standalone wrapper that keeps current behavior
   - shared address/copy/explorer helpers

2. Register embedded components from the plugin:
   - keep `SuiWalletProfile`
   - add `SuiWalletProfile.Popup` or `SuiWalletProfile.Embedded`
   - keep style URLs unchanged so existing plugin loading still works

3. Extend wallet profile data types:
   - include optional wallet metadata, account list, and explorer helpers
   - keep existing `walletProfile` shared data backward compatible
   - add optional Predict extension data without making the wallet plugin depend
     on Predict Club internals

4. Load the wallet profile plugin in Predict Club:
   - React route: load `sui-wallet-profile` before rendering popup content
   - static/orchestrated route: include the plugin bundle next to
     `predict-club`
   - fail gracefully if the embedded component is unavailable

5. Update Predict Club topbar behavior:
   - connected wallet icon opens the profile popup
   - connected address button opens the profile popup
   - disconnected controls keep the existing connect wallet behavior
   - disconnect is only inside the popup

6. Publish Predict Club wallet context:
   - manager status/id
   - member balances
   - binary and range position summaries
   - vault summary
   - unavailable fields should be explicit instead of demo numbers

7. Update UI styling:
   - popup max width around `420px`
   - mobile width `calc(100vw - 24px)`
   - internal scroll for long DeepBook/Predict details
   - section dividers instead of nested cards
   - address rows use icon buttons for copy/external link

## Test Plan

Unit/light tests:

- SuiScan account URL is exactly
  `https://suiscan.xyz/testnet/account/<address>`.
- Object/manager SuiScan URL uses `/object/<id>`.
- Copy action copies only valid full Sui addresses.
- Embedded popup renders without creating a second provider.
- Standalone `SuiWalletProfile` still renders.

Playwright:

- On `/predict-club.html`, disconnected wallet icon opens the wallet connect
  panel.
- In a connected wallet fixture, wallet icon opens the profile popup.
- In a connected wallet fixture, wallet address button opens the same popup.
- Popup shows active address, balances, PredictManager status, and vault
  context when available.
- SuiScan link has the expected testnet URL.
- Disconnect button calls wallet disconnect and returns topbar to
  `Connect Wallet`.

Regression:

- `rtk bun run build`
- `rtk bun run test:unit`
- `rtk bun run test:e2e` when local server binding is allowed

## HMR / Fast Refresh Guardrail

Vite React Fast Refresh requires files that export React components to keep
consistent component-only exports. Do not export `usePredictClub` from
`plugins/predict-club/presentation/PredictClubContext.tsx`.

Observed warning:

```text
hmr invalidate /plugins/predict-club/presentation/PredictClubContext.tsx Could not Fast Refresh ("usePredictClub" export is incompatible).
```

Preventive structure:

- `PredictClubContext.tsx` owns and exports `PredictClubProvider`.
- `PredictClubContextCore.ts` owns the context object and context/action types.
- `usePredictClub.ts` owns and exports the `usePredictClub` hook.
- Panel components import the hook from `./usePredictClub`, not from
  `./PredictClubContext`.

If future work adds helper hooks, selectors, or non-component exports, put them
in separate files next to the provider. This keeps HMR incremental and avoids
full module invalidation while editing the Predict Club UI.

## Acceptance Criteria

- Predict Club uses `plugins/sui-wallet-profile` for the wallet popup instead
  of owning a duplicate wallet profile implementation.
- A new user can click the wallet icon/address and understand wallet status,
  PredictManager status, open positions, and vault context without searching
  across panels.
- Copying an address never copies a shortened/demo address.
- SuiScan links consistently use testnet.
- Existing wallet connect flow is preserved for disconnected users.
- Existing standalone wallet profile plugin behavior is preserved.

## Implementation Status

- State: implemented through wallet popup, shared Predict context, HMR guard,
  and popup performance cleanup
- Priority: high for Predict Club usability after wallet/Predict pricing work
- Risk: medium because it touches wallet plugin boundaries, shared context, and
  E2E behavior

Implemented in phase 1:

- `sui-wallet-profile` now registers standalone and embedded popup components.
- Predict Club React/static routes load the wallet profile plugin alongside
  `predict-club`.
- Connected wallet icon/address opens wallet profile instead of disconnecting
  directly.
- Predict Club publishes wallet profile extension data through
  `predictClubWalletProfile`.
- Wallet profile renders copyable full-address controls and SuiScan testnet
  account/object links.

Completed follow-up fixes:

- Predict Club renders the wallet profile popup through a React portal attached
  to `document.body`, so it is not hidden by the orchestrator root
  `display: none`.
- Wallet icon and connected address both use the shared wallet trigger.
- Embedded wallet profile uses the effective address from DAppKit or host
  context, preventing host-context-only crashes.
- Popup mounts only while open; wallet profile fetches are skipped when an
  embedded popup is closed.
- Removed full-screen `backdrop-filter` from the wallet profile overlay to
  avoid mouse/scroll jank while the popup is open.
- Predict Club preserves the latest usable manager/vault snapshot instead of
  overwriting profile data with `null` from another panel provider while a
  snapshot is loading or partially unavailable.
- Predict manager snapshot no longer fails completely if position/dynamic-field
  reads fail; manager balance and id can still render.
- `usePredictClub` was moved out of `PredictClubContext.tsx` to satisfy Vite
  Fast Refresh export rules.

Validation completed:

- `bun run build`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`
