# Predict Club Contract Integration — Status

## Goal

Wire the published `predict-club` Move package into the frontend plugin,
deploy to testnet, and complete the end-to-end escrow + exchange + funding flow.

## Status

| Phase | Status | Commit |
|-------|--------|--------|
| Contract code (escrow + exchange) | ✅ Done | `521b83c` |
| Unit tests (13/13) | ✅ Done | `521b83c` |
| TypeScript codegen bindings | ✅ Done | `64c8250` |
| Testnet publish | ✅ Done | `01a65a7` |
| ClubEscrowMarket created (shared) | ✅ Done | `01a65a7` |
| Constants file + Published.toml | ✅ Done | `c477d78` |
| Escrow gateway (build TX) | ✅ Done | `01a65a7` |
| Funding gateway (DeepBook swap) | ✅ Done | `01a65a7` |
| On-chain escrow use cases | ✅ Done | `bf2ae27` |
| Context wiring (actions) | ✅ Done | `a42afb4` |
| EscrowOffersPanel on-chain | ✅ Done | `e791301` |
| Claim settlement on-chain | ✅ Done | `d6e0c38` |
| DeepBook swap execution | ✅ Done | `8fba0a5` |
| Scallop borrow gateway + use case | ✅ Done | `c4ff4d3` |
| Auto-refresh on-chain offers | ✅ Done | `71d5548` |
| Scallop borrow wired to modal | ✅ Done | `cc7bd93` |
| E2E integration tests | 🔲 TODO | — |

## On-Chain Deployments (Testnet)

| Object | ID |
|--------|-----|
| Package | `0x269bdb57cbf02c46a7fe0a72e33c53b36203272d0e029557fca75d4462a96613` |
| ClubEscrowMarket | `0xb6f225294072afd25255b3215e89876af6221e5e4a3b5c485180753dff04eb11` |
| UpgradeCap | `0xa86e967ff1443d908b09214ca34c12d8e006c0229a2603d5edad3caec8ca7ce2` |

## Architecture (Implemented)

```
┌─ Presentation ──────────────────────────────────────────┐
│ EscrowOffersPanel  FundingRouterPanel  ModalLayer       │
└───────────────────────────┬─────────────────────────────┘
                            │
┌─ Context Actions ─────────┴─────────────────────────────┐
│ createEscrowOfferOnChain   swapSuiToUsdc               │
│ fillEscrowOfferOnChain     borrowUsdc                  │
│ cancelEscrowOfferOnChain   claimSettlementOnChain      │
│ executeRound               (+ local-state variants)    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌─ Application (Use Cases) ─┴─────────────────────────────┐
│ escrowOnChain.ts    swapSuiToUsdc.ts    borrowUsdc.ts  │
│ claimWinnings.ts    executeTradeplan.ts  manageEscrow   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌─ Infrastructure ──────────┴─────────────────────────────┐
│ escrowGateway.ts      → predict_club::exchange         │
│ fundingGateway.ts     → DeepBook v3 SUI_USDC           │
│ scallopGateway.ts     → Scallop deposit + borrow       │
│ suiPredictGateway.ts  → Predict mint/claim             │
│ escrowQueryService.ts → RPC market dynamic fields      │
└─────────────────────────────────────────────────────────┘
                            │
┌─ Domain ──────────────────┴─────────────────────────────┐
│ policies.ts (canBorrowSafely, MIN_HEALTH_FACTOR)       │
│ types.ts, roundLifecycle.ts, riskGate.ts               │
└─────────────────────────────────────────────────────────┘
```

## Remaining TODO

### P4: Quality & Polish

- [ ] Write E2E test scenarios (`tests/e2e/predict-club.spec.ts`)
- [ ] Display `#[error]` messages from contract aborts in UI toast
- [ ] Subscribe to events (`OfferCreated`, `OfferFilled`, `OfferCancelled`) via WebSocket
- [ ] Loading states and optimistic updates for escrow operations
- [ ] Scallop health factor live display in borrow modal
- [ ] Oracle freshness validation before trade execution

### P5: Future / V2

- [ ] `club_vault.move` — pooled DUSDC vault with LeaderCap policy guard
- [ ] Multi-sig approval (`release_conditions == 2`)
- [ ] Partial fill for exchange offers
- [ ] Fee collection on exchange fills
- [ ] Walrus Sites deploy for predict-club standalone
- [ ] Scallop liquidation monitor + alert panel
- [ ] Oracle-price-linked exchange rates

## Open Decisions (Resolved)

1. ✅ Round state: **off-chain localStorage V1** (decided)
2. ✅ Exchange offers: **owned objects + events for indexing** (decided)
3. ✅ Funding execution: **per-route buttons in modal** (implemented)

## Affected Files

| Layer | Path |
|-------|------|
| Contract | `contracts/predict-club/sources/` |
| Constants | `src/constants/predict-club.ts` |
| Codegen | `src/generated/predict-club/` |
| Domain | `plugins/predict-club/domain/` |
| Application | `plugins/predict-club/application/` |
| Infrastructure | `plugins/predict-club/infrastructure/` |
| Presentation | `plugins/predict-club/presentation/` |
| Config | `contracts/predict-club/Published.toml` |
