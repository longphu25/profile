# Predict Club Community Plan

## Goal

Create `predict-club.html` and a `predict-club` plugin that help a community
coordinate DeepBook Predict rounds with indicators, leader confirmation, member
pledges, self-signed execution, and settlement tracking.

## Scope

In:

- Harness docs and story contract for Predict Club.
- `predict-club.html` page plan.
- `plugins/predict-club` clean-architecture plugin plan.
- V1 local club state and member self-sign workflow.
- Indicator consensus and risk checklist.
- Simulation-only loan and liquidity planner.
- Funding Router for SUI, USDC, bridge handoff, Scallop borrow planning, and
  DUSDC escrow exchange.

Out:

- Move group vault contract.
- Automated custody over member funds.
- Real DeepBook Margin borrowing.
- Mainnet package IDs or production custody claims.

## Product Docs

- `docs/product/predict-club.md`
- `docs/product/predict-club-architecture.md`
- `docs/deepbook/onchain-finance/deepbook-predict.md`
- `docs/product/predict-club-funding.md`
- `docs/stories/plans/09-predict-manager-bot-architecture.md`
- `docs/stories/plans/08-deepbook-predict-user-assist.md`

## Architecture Docs

- `docs/plugin-architecture.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/TEST_MATRIX.md`
- `docs/decisions/predict-club-architecture.md`

## Risk Classification

High-risk.

Risk flags:

- Wallet/signing
- Authorization
- Data model
- External systems
- Public contract
- Existing DeepBook Predict behavior
- Multi-domain UI and finance workflow

## Clean Architecture

```mermaid
flowchart TB
  UI[Presentation<br/>React Components] --> APP[Application<br/>Use Cases]
  APP --> DOM[Domain<br/>Entities + Policies]
  APP --> PORTS[Ports<br/>Repository / Gateway Interfaces]
  INFRA[Infrastructure<br/>Sui / Predict / Indicators] --> PORTS
  DATA[Data<br/>localStorage / Server Adapters] --> PORTS

  DOM -.no external deps.-> DOM
```

## Planned File Structure

```text
predict-club.html
src/predict-club/
  main.tsx
  PredictClubPage.tsx
  predict-club.css

plugins/predict-club/
  plugin.tsx
  style.css
  domain/
    entities.ts
    valueObjects.ts
    policies.ts
    events.ts
  application/
    createProposal.ts
    pledgeToRound.ts
    confirmProposal.ts
    buildMemberTradePlan.ts
    recommendFundingRoute.ts
    settleRound.ts
  data/
    predictClubRepository.ts
    predictRepositoryAdapter.ts
    localClubStore.ts
  infrastructure/
    suiPredictGateway.ts
    indicatorSignalGateway.ts
    deepbookSwapGateway.ts
    scallopGateway.ts
  presentation/
    PredictClubRoot.tsx
    components/
      DecisionStrip.tsx
      PredictionRoom.tsx
      IndicatorConsensus.tsx
      MemberCommitments.tsx
      RiskChecklist.tsx
      LeaderCommandPanel.tsx
      LoanPlanner.tsx
      FundingRouter.tsx
      EscrowExchange.tsx
      RoundHistory.tsx
      ClaimQueue.tsx
```

## Plugin Runtime

```mermaid
sequenceDiagram
  participant Page as predict-club.html
  participant Host as PluginRenderer / HostAPI
  participant Plugin as plugins/predict-club/plugin.tsx
  participant Shadow as Shadow DOM
  participant UI as PredictClubRoot

  Page->>Host: load plugin src
  Host->>Plugin: dynamic import
  Host->>Plugin: init(hostAPI)
  Plugin->>Host: registerComponent("PredictClub")
  Host->>Shadow: create shadow root + inject style.css
  Shadow->>UI: render React portal
  Host->>Plugin: mount()
```

## V1 Member Self-Sign Flow

```mermaid
sequenceDiagram
  participant Leader
  participant Club as Predict Club
  participant Member
  participant Wallet
  participant Predict as DeepBook Predict

  Leader->>Club: Create proposal
  Club->>Club: Snapshot indicators + risk checks
  Member->>Club: Pledge / accept signal
  Leader->>Club: Confirm proposal
  Club->>Member: Build member trade plan
  Member->>Wallet: Review + sign PTB
  Wallet->>Predict: mint / mint_range via user's PredictManager
  Predict-->>Club: tx digest / position state
  Club->>Member: Monitor / claim after settlement
```

## Funding Router Flow

```mermaid
flowchart LR
  SUI[SUI only] --> DB[DeepBook SUI_USDC swap]
  SUI --> SC[Scallop borrow USDC]
  EXT[External assets] --> BR[Bridge assets to Sui]
  DB --> USDC[USDC on Sui]
  SC --> USDC
  BR --> USDC
  USDC --> ESC[Club escrow USDC to DUSDC]
  ESC --> DUSDC[DUSDC]
  DUSDC --> PM[PredictManager deposit]
  PM --> PRED[Predict mint/range]
```

Funding implementation notes:

- DeepBook `SUI_USDC` route converts SUI to USDC and must preserve SUI gas.
- Scallop route is a borrowing landing first: show collateral, debt, oracle,
  liquidation risk, and health state before any wallet signing.
- Bridge route is an external handoff, not a custody bridge.
- USDC to DUSDC is done through club escrow or leader reserve, not by treating
  USDC as a Predict quote asset.

## Escrow Exchange Flow

```mermaid
sequenceDiagram
  participant Maker
  participant Escrow as ClubEscrowMarket
  participant Filler
  participant Club as Predict Club

  Maker->>Escrow: create_offer(offer_coin, want_amount, expiry)
  Escrow-->>Club: OfferCreated
  Filler->>Escrow: fill_offer(payment_coin)
  Escrow-->>Filler: offered coin
  Escrow-->>Maker: wanted payment
  Escrow-->>Club: OfferFilled
```

## Design Patterns

- Repository: abstract localStorage, server, and future on-chain state.
- Adapter: map DeepBook Predict and BTC indicator data into domain objects.
- Strategy: switch loan planner between no leverage, PLP hedge, and margin
  simulation.
- State Machine: enforce round lifecycle transitions.
- Command: represent leader/member actions as explicit application commands.
- Policy Object: centralize max size, expiry, oracle health, and paused checks.
- Escrow: atomically exchange USDC and DUSDC between leader/member offers.

## Implementation Steps

1. Add the product, story, and decision docs.
2. Add `predict-club.html` and `src/predict-club` page shell.
3. Add `plugins/predict-club` plugin entry with Shadow DOM scoped CSS.
4. Implement pure domain entities and policy checks.
5. Implement V1 localStorage repository.
6. Implement DeepBook Predict read adapters and indicator gateway.
7. Implement use cases for proposal, pledge, confirm, trade-plan, and settle.
8. Build the page UI around one active round and one primary action.
9. Add loan planner as simulation-only with explicit labeling.
10. Add Funding Router with DeepBook SUI to USDC, Scallop borrow planning,
    bridge handoff, and escrow USDC to DUSDC.
11. Update Vite input entries and optional DeepBook navigation.
12. Validate build, plugin load, layout, funding route, and wallet-flow review.

## Validation

- `rtk bun run build`
- `rtk bun run test:e2e`
- Browser smoke for `predict-club.html`
- Plugin load check inside Shadow DOM
- Desktop and mobile layout check
- Manual wallet-flow review for self-signed member trade plan
- Verify stale oracle and unsafe expiry block execution
- Verify loan planner remains labeled `Simulated`
- Verify SUI-only wallet sees DeepBook swap and Scallop borrow funding routes.
- Verify Scallop borrow route shows liquidation/oracle warnings.
- Verify USDC holder sees escrow USDC to DUSDC route.

## Status

- State: implemented V1, wallet/member flow hardening in progress
- Evidence: product contract and architecture decision docs define the V1/V2
  boundary; build and Playwright smoke coverage validate the current member
  funding gate.

## Implementation Log - 2026-06-06

Implemented in the current session:

- Added wallet connect/disconnect from the Predict Club header and primary CTA.
- Added current-member resolution from the connected wallet. If the wallet is
  not already in the demo club, the app adds a local `You` member row.
- Added PredictManager lookup for the connected wallet and a `Create Manager`
  action when the manager is missing.
- Updated the decision strip so `Connect Wallet` is not blocked by risk-gate
  state.
- Updated `Fund to Join` to show wallet, club member, PredictManager, DUSDC
  balance, and preview-only funding routes.
- Updated `Execute My Trade` modal to show member stake, live manager/oracle
  status, capped payout label, and condition-based checklist state.
- Fixed pledge accounting so repeat pledges update by delta instead of adding
  the full pledged amount repeatedly.
- Added Playwright E2E infrastructure:
  - `playwright.config.ts`
  - `tests/e2e/predict-club.spec.ts`
  - `package.json` scripts `test:e2e` and `test:e2e:report`
  - ignored `test-results/` and `playwright-report/`
- Installed the Playwright Chromium browser binary locally so E2E can run.

Validation performed:

- `rtk bun run build` passed.
- `rtk bun run test:e2e` passed with Chromium.
- Targeted ESLint passed for Predict Club files, Playwright config, and the new
  E2E test.

Known boundaries:

- Funding routes other than Direct DUSDC are still preview-only in the current
  UI.
- A real wallet must still sign PredictManager creation and Predict execution.
- Network success for Predict PTBs should not be claimed unless a real wallet
  transaction is executed on the target Sui network.
- Repo-wide `bun run lint` still fails because of pre-existing lint issues
  outside this story scope.

Next plan:

1. Add a wallet-mocked Playwright route or fixture so the test can cover the
   connected-wallet branch without relying on a browser extension.
2. Add a PredictManager API/contract fixture so `Create Manager` and
   manager-ready states can be tested deterministically.
3. Add a DUSDC balance fixture and exercise `Pledge DUSDC` through the funding
   modal.
4. Add an execution-preview test for `Execute My Trade` once the round can be
   placed in a deterministic executable state.
5. Document the exact manual wallet runbook for testnet transactions once a
   known funded test wallet is available.
