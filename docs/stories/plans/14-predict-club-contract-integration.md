# Predict Club Contract Integration — Next Steps

## Goal

Wire the published `predict-club` Move package into the frontend plugin,
deploy to testnet, and complete the end-to-end escrow + exchange flow for
member funding and trade execution.

## Status

| Phase | Status |
|-------|--------|
| Contract code (escrow + exchange) | ✅ Done |
| Unit tests (13/13) | ✅ Done |
| TypeScript codegen bindings | ✅ Done |
| Sui skills installed | ✅ Done |
| Probe script + docs | ✅ Done |
| Testnet deploy | 🔲 TODO |
| Plugin integration | 🔲 TODO |
| E2E tests | 🔲 TODO |

## TODO — Prioritized

### P0: Contract → Testnet Deploy

- [ ] `sui client publish` the `contracts/predict-club` package to testnet
- [ ] Record package ID in `contracts/predict-club/Published.toml`
- [ ] Regenerate codegen with real package ID (`make codegen`)
- [ ] Call `create_market` to create shared `ClubEscrowMarket` object on testnet
- [ ] Record market object ID in a constants file (`src/constants/predict-club.ts`)

### P1: Plugin ↔ On-chain Wiring

- [ ] Wire `plugins/predict-club/application/manageEscrow.ts` to use generated
      `createEscrow`, `deposit`, `releaseFunds`, `cancelEscrow` bindings
- [ ] Wire `EscrowOffersPanel.tsx` to display live offers from on-chain
      (`getObject` + event subscription)
- [ ] Wire `FundingRouterPanel.tsx` to execute full funding flow:
      DeepBook swap → USDC → `fillOffer` → DUSDC in wallet
- [ ] Add PTB composition: merge coins, split exact amounts, chain calls

### P2: Round Lifecycle On-chain

- [ ] Decide: round state on-chain (new `round.move`) vs off-chain (localStorage V1)
- [ ] Wire `executeTradeplan.ts` to build member self-sign Predict PTB
      (deposit DUSDC → mint/mint_range via PredictManager)
- [ ] Wire `settleRound.ts` + `claimSettlement.ts` to query settlement
      and claim payouts from DeepBook Predict
- [ ] Add keeper-style auto-claim flow for settled positions

### P3: Quality & UX

- [ ] Write E2E test scenarios in `tests/e2e/predict-club.spec.ts`
- [ ] Display `#[error]` messages from contract aborts in UI toast/modal
- [ ] Subscribe to events (`EscrowCreated`, `OfferFilled`, `FundsReleased`)
      for real-time UI updates
- [ ] Add loading states and optimistic updates for escrow operations
- [ ] Validate oracle health and expiry before allowing trade execution

### P4: Future / V2

- [ ] `club_vault.move` — pooled DUSDC vault with LeaderCap policy guard
- [ ] Multi-sig approval (`release_conditions == 2`)
- [ ] Partial fill for exchange offers
- [ ] Fee collection on exchange fills
- [ ] Walrus Sites deploy for `predict-club.html`
- [ ] Scallop borrow integration with liquidation monitor + oracle panel
- [ ] Oracle-price-linked exchange rates

## Affected Product Docs

- `docs/product/predict-club.md`
- `docs/product/predict-club-architecture.md`
- `docs/product/predict-club-escrow-contract.md`
- `docs/product/predict-club-funding.md`

## Affected Architecture Boundaries

- `contracts/predict-club/` — Move package
- `src/generated/predict-club/` — codegen output
- `plugins/predict-club/application/` — use cases
- `plugins/predict-club/infrastructure/` — Sui gateway
- `plugins/predict-club/presentation/` — UI panels

## Validation Proof

- P0: `sui client call --package <id> --module exchange --function create_market`
      succeeds on testnet
- P1: User can create offer and fill offer through the UI with wallet signature
- P2: Member self-signs Predict trade and sees position in manager
- P3: E2E tests green, error toasts visible on abort

## Open Decisions

1. Round state storage: on-chain `round.move` vs off-chain localStorage?
   - On-chain = transparent history, costs gas
   - Off-chain = free, fast, private, but no audit trail
   - Recommendation: V1 off-chain, V2 on-chain

2. Should exchange offers be stored as owned objects (current) or listed in a
   dynamic field on ClubEscrowMarket?
   - Current: owned by maker, transferred to fill
   - Alternative: dynamic object field on market for discoverability
   - Recommendation: keep owned for composability, use events for indexing

## Related Stories

- `docs/stories/plans/13-predict-club-community.md`
- `docs/stories/plans/09-predict-manager-bot-architecture.md`
- `docs/stories/plans/08-deepbook-predict-user-assist.md`
