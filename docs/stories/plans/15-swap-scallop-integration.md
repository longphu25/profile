# Swap & Scallop Integration — Status

## Implementation Complete

All funding routes are now wired end-to-end with on-chain execution.

| Route | Method | Status |
|-------|--------|--------|
| Direct DUSDC | Wallet balance check | ✅ Always worked |
| USDC → DUSDC | Club escrow `fillOffer` | ✅ On-chain via `escrowGateway` |
| SUI → USDC | DeepBook v3 `swapExactBaseForQuote` | ✅ `fundingGateway` + swap button |
| SUI → USDC (borrow) | Scallop collateral + borrow | ✅ `scallopGateway` + borrow button |
| External bridge | UI redirect only | ✅ No integration needed |

---

## Implemented Components

### DeepBook Swap (Route 3)

| File | Purpose |
|------|---------|
| `infrastructure/fundingGateway.ts` | `buildSwapSuiToUsdcTx`, `buildSwapAndFillTx` |
| `application/swapSuiToUsdc.ts` | Use case wrapping gateway + signer |
| `presentation/ModalLayer.tsx` | Swap button in funding modal |

**Flow:** User clicks "Swap X SUI → USDC" → `swapSuiToUsdc` → `fundingGateway.buildSwapSuiToUsdcTx` → `host.signAndExecuteTransaction`

### Scallop Borrow (Route 4)

| File | Purpose |
|------|---------|
| `infrastructure/scallopGateway.ts` | `getHealthFactor`, `buildBorrowUsdcTx` |
| `application/borrowUsdc.ts` | Use case with health factor safety check |
| `domain/policies.ts` | `canBorrowSafely(health)` (min 1.5) |
| `presentation/ModalLayer.tsx` | Borrow button in Scallop modal |

**Flow:** User clicks "Borrow USDC" → `borrowUsdc` → health check → `scallopGateway.buildBorrowUsdcTx` → `host.signAndExecuteTransaction`

### Club Escrow Exchange (Route 2)

| File | Purpose |
|------|---------|
| `infrastructure/escrowGateway.ts` | `buildCreateOfferTx`, `buildFillOfferTx`, `buildCancelOfferTx` |
| `application/escrowOnChain.ts` | On-chain escrow CRUD use cases |
| `infrastructure/escrowQueryService.ts` | Fetch offers from market dynamic fields |
| `presentation/EscrowOffersPanel.tsx` | Fill/cancel with on-chain routing |

---

## SDK Versions Used

| Package | Version | Usage |
|---------|---------|-------|
| `@mysten/deepbook-v3` | ^1.4.1 | Swap SUI_USDC pool |
| `@scallop-io/sui-scallop-sdk` | ^3.0.2 | Borrow USDC against SUI |
| `@mysten/sui` | ^2.17.0 | Transaction building, RPC |

## Remaining Work

- [ ] Scallop health factor live display in borrow modal
- [ ] Liquidation price warning UI
- [ ] Multi-step PTB composition (swap + fill in single tx)
- [ ] Oracle price feed in exchange rate display
- [ ] E2E tests for each funding route
