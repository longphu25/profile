# Predict Club Architecture Diagrams

## Summary

This document collects the architecture diagrams and planned file structure for
`predict-club.html`, `plugins/predict-club`, and the future
`contracts/predict-club` package.

Predict Club is a high-risk feature because it touches wallet signing,
authorization, funding routes, escrow exchange, Scallop borrowing risk,
DeepBook Predict, and future pooled-capital custody.

## System Context

```mermaid
flowchart LR
  Leader[Leader] --> Page[predict-club.html]
  Member[Member] --> Page
  Observer[Observer] --> Page

  Page --> Host[React Page Host]
  Host --> Plugin[Predict Club Plugin]
  Plugin --> Wallet[Sui Wallet / DAppKit HostAPI]
  Plugin --> PredictAPI[DeepBook Predict Server]
  Plugin --> DeepBook[DeepBook V3 SUI_USDC Swap]
  Plugin --> Scallop[Scallop Borrow / Oracle / Liquidation]
  Plugin --> Bridge[Bridge Handoff]
  Plugin --> Store[localStorage V1]

  Wallet --> Sui[Sui Network]
  Sui --> PM[User PredictManager]
  Sui --> Escrow[Club Escrow Market]
  Sui --> FutureVault[Future PredictClubVault]
```

## Page and Plugin Runtime

```mermaid
sequenceDiagram
  participant Html as predict-club.html
  participant Main as src/predict-club/main.tsx
  participant Page as PredictClubPage
  participant Renderer as PluginRenderer
  participant Loader as Plugin Loader
  participant Plugin as plugins/predict-club/plugin.tsx
  participant Shadow as Shadow DOM
  participant Root as PredictClubRoot

  Html->>Main: load module
  Main->>Page: render React page
  Page->>Renderer: src=/plugins/predict-club/plugin.tsx
  Renderer->>Loader: dynamic import
  Loader->>Plugin: init(hostAPI)
  Plugin->>Renderer: registerComponent("PredictClub")
  Renderer->>Shadow: create shadow root + inject style.css
  Shadow->>Root: render portal
  Renderer->>Plugin: mount()
```

## Clean Architecture Boundaries

```mermaid
flowchart TB
  Presentation[Presentation<br/>React components + hooks]
  Application[Application<br/>Use cases / commands]
  Domain[Domain<br/>entities / policies / state machine]
  Ports[Ports<br/>repositories / gateways]
  Data[Data<br/>localStorage + server adapters]
  Infra[Infrastructure<br/>Sui / DeepBook / Scallop / indicators]

  Presentation --> Application
  Application --> Domain
  Application --> Ports
  Data --> Ports
  Infra --> Ports

  Domain -. no React, fetch, Sui SDK .-> Domain
```

Rules:

- Domain is pure and dependency-free.
- Application depends on interfaces, not concrete fetch/Sui clients.
- Presentation never contains protocol rules.
- Infrastructure owns wallet, Sui SDK, DeepBook, Scallop, and external provider
  details.

## Round Lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> open: leader publishes
  open --> confirmed: leader confirms
  open --> cancelled: cancel / expired
  confirmed --> funding: members need DUSDC
  funding --> executed: funded + member signs
  confirmed --> executed: already funded + member signs
  funding --> cancelled: funding expired / policy failure
  executed --> settled: oracle settles
  settled --> claimed: payout claimed
  claimed --> [*]
  cancelled --> [*]
```

## Member Self-Sign Trade Flow

```mermaid
sequenceDiagram
  participant Leader
  participant Club as Predict Club Plugin
  participant Member
  participant Wallet
  participant Predict as DeepBook Predict

  Leader->>Club: create proposal
  Club->>Club: snapshot indicators and risk checks
  Member->>Club: pledge / accept signal
  Club->>Club: run readiness checklist
  Leader->>Club: confirm proposal
  Club->>Member: build trade plan
  Member->>Wallet: review + sign PTB
  Wallet->>Predict: deposit DUSDC / mint / mint_range
  Predict-->>Club: tx digest / indexed position
  Club->>Member: monitor settlement and claim
```

## Funding Router

```mermaid
flowchart LR
  Start[Member wants to join] --> Check{Has DUSDC?}
  Check -->|Yes| Ready[Ready for PredictManager deposit]
  Check -->|No, has USDC| Escrow[USDC to DUSDC escrow]
  Check -->|Only SUI, sell SUI| Swap[DeepBook SUI_USDC swap]
  Check -->|Only SUI, keep SUI| Borrow[Scallop borrow USDC]
  Check -->|External assets| Bridge[Bridge assets to Sui]

  Swap --> USDC[USDC on Sui]
  Borrow --> Risk[Liquidation + oracle checklist]
  Risk --> USDC
  Bridge --> USDC
  USDC --> Escrow
  Escrow --> DUSDC[DUSDC]
  DUSDC --> Ready
  Ready --> Trade[Member self-signs Predict trade]
```

## Escrow Exchange

```mermaid
sequenceDiagram
  participant Maker
  participant Market as ClubEscrowMarket
  participant Filler
  participant UI as Predict Club UI

  Maker->>Market: create_offer(offer_coin, want_amount, expiry)
  Market-->>UI: OfferCreated event
  Filler->>Market: fill_offer(payment_coin)
  Market-->>Filler: transfer offered coin
  Market-->>Maker: transfer wanted coin
  Market-->>UI: OfferFilled event
```

Use cases:

- Leader offers DUSDC and wants USDC.
- Member offers USDC and wants DUSDC.
- Recipient-restricted offers support one specific member.
- Round-linked offers support funding for one active prediction round.

## Scallop Borrow Risk Flow

```mermaid
flowchart TB
  Wallet[Member wallet] --> Obligation{Has Scallop obligation?}
  Obligation -->|No| Create[Create/select obligation]
  Obligation -->|Yes| Collateral[Review SUI collateral]
  Create --> Collateral
  Collateral --> Oracle[Update/check oracle]
  Oracle --> Borrow[Borrow USDC]
  Borrow --> Health[Health / liquidation monitor]
  Health -->|Safe| Escrow[USDC to DUSDC escrow]
  Health -->|Warning| Reduce[Reduce size / add collateral]
  Health -->|Danger| Block[Block new Predict participation]
  Health -->|Liquidatable| Repay[Repay / top up before joining]
```

## Future Group Vault

```mermaid
flowchart TB
  Members[Members deposit DUSDC] --> Vault[PredictClubVault]
  Vault --> Shares[Member shares / accounting]
  LeaderCap[LeaderCap] --> Policy[Policy Guard]
  Policy -->|Allowed| Execute[Execute bounded Predict round]
  Policy -->|Blocked| Reject[Reject action]

  Execute --> VaultManager[Vault-controlled Predict path]
  VaultManager --> Predict[DeepBook Predict]
  Predict --> Settlement[Settlement payout]
  Settlement --> Vault
  Vault --> Claim[Member claim / withdrawal]
```

V2 vault work is explicitly separate from V1. It requires a Move story,
contract tests, and wallet-flow review before implementation.

## Escrow Contract Module Architecture

```mermaid
flowchart TB
  Errors[errors.move]
  Events[events.move]
  Types[types.move]
  Escrow[escrow.move]
  Approvals[approvals.move]
  Receipts[receipts.move]
  Views[views.move]
  ExTypes[exchange_types.move]
  ExMarket[exchange_market.move]
  ExViews[exchange_views.move]
  ExEvents[exchange_events.move]

  Escrow --> Errors
  Escrow --> Events
  Escrow --> Types
  Escrow --> Receipts
  Approvals --> Errors
  Approvals --> Types
  Views --> Types
  ExMarket --> Errors
  ExMarket --> ExTypes
  ExMarket --> ExEvents
  ExViews --> ExTypes
```

The Move package should be split into small files. Do not place the
time-locked escrow and generic USDC/DUSDC exchange logic in one large module.

## Planned File Structure

### Page Host

```text
predict-club.html
src/predict-club/
  main.tsx
  PredictClubPage.tsx
  predict-club.css
```

Purpose:

- `predict-club.html`: standalone entry point.
- `main.tsx`: React root bootstrap.
- `PredictClubPage.tsx`: page shell, wallet provider, and plugin renderer.
- `predict-club.css`: host page layout only; plugin UI remains scoped in
  Shadow DOM.

### Plugin

```text
plugins/predict-club/
  plugin.tsx
  style.css
  domain/
    entities.ts
    valueObjects.ts
    policies.ts
    events.ts
    stateMachine.ts
  application/
    createProposal.ts
    pledgeToRound.ts
    confirmProposal.ts
    recommendFundingRoute.ts
    createEscrowOffer.ts
    fillEscrowOffer.ts
    buildMemberTradePlan.ts
    settleRound.ts
  data/
    predictClubRepository.ts
    predictRepositoryAdapter.ts
    localClubStore.ts
    escrowRepository.ts
  infrastructure/
    suiPredictGateway.ts
    deepbookSwapGateway.ts
    scallopGateway.ts
    indicatorSignalGateway.ts
    bridgeGateway.ts
  presentation/
    PredictClubRoot.tsx
    hooks/
      useClubState.ts
      useFundingRoutes.ts
      useRoundActions.ts
    components/
      DecisionStrip.tsx
      PredictionRoom.tsx
      IndicatorConsensus.tsx
      MemberCommitments.tsx
      RiskChecklist.tsx
      LeaderCommandPanel.tsx
      FundingRouter.tsx
      EscrowExchange.tsx
      ScallopRiskPanel.tsx
      LoanPlanner.tsx
      RoundHistory.tsx
      ClaimQueue.tsx
```

### Future Move Package

```text
contracts/predict-club/
  Move.toml
  sources/
    errors.move
    events.move
    types.move
    escrow.move
    approvals.move
    receipts.move
    views.move
    exchange_types.move
    exchange_market.move
    exchange_views.move
    exchange_events.move
    club_vault.move
  tests/
    escrow_tests.move
    approval_tests.move
    cancellation_tests.move
    exchange_offer_tests.move
    exchange_cancel_tests.move
    exchange_recipient_tests.move
    club_vault_tests.move
```

Purpose:

- `escrow.move`: SUI time-locked escrow using epoch-based release.
- `exchange_market.move`: P2P generic `EscrowOffer<OfferT, WantT>` market for
  USDC/DUSDC funding.
- `club_vault.move`: future DUSDC pooled-capital vault; not part of V1.
- tests verify offer fill/cancel/expiry/recipient restrictions and future vault
  policy checks.

## Type Contracts

```ts
type RoundStatus =
  | 'draft'
  | 'open'
  | 'confirmed'
  | 'funding'
  | 'executed'
  | 'settled'
  | 'claimed'
  | 'cancelled'

type FundingRoute =
  | 'ready-with-dusdc'
  | 'deepbook-sui-to-usdc'
  | 'scallop-borrow-usdc'
  | 'bridge-assets-to-sui'
  | 'club-escrow-usdc-to-dusdc'

type ScallopRiskState = 'safe' | 'warning' | 'danger' | 'liquidatable' | 'unknown'

interface EscrowOfferView {
  id: string
  maker: string
  recipient?: string
  roundId?: string
  offerCoinType: string
  wantCoinType: string
  offerAmount: string
  wantAmount: string
  expiresAtMs: number
  status: 'open' | 'filled' | 'cancelled' | 'expired'
}
```

## Validation Map

| Area | Proof |
| --- | --- |
| Docs / diagrams | Mermaid renders and links resolve in Obsidian-compatible markdown. |
| Page host | `rtk bun run build`; browser smoke on `predict-club.html`. |
| Plugin runtime | Plugin loads inside Shadow DOM and registers `PredictClub`. |
| Funding router | SUI-only, USDC-only, DUSDC-ready, and external-asset states route correctly. |
| Scallop borrow | Borrow route shows oracle and liquidation warnings before signing. |
| Escrow | Create, fill, cancel, expiry, recipient restriction, and overpayment scenarios. |
| Predict flow | Member self-signs; no bot or leader holds private keys. |

## Related Docs

- `docs/product/predict-club.md`
- `docs/product/predict-club-escrow-contract.md`
- `docs/product/predict-club-funding.md`
- `docs/stories/plans/13-predict-club-community.md`
- `docs/decisions/predict-club-architecture.md`
- `docs/decisions/predict-club-funding-escrow.md`
