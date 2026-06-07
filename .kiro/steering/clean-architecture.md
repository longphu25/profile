---
inclusion: always
---

# Clean Architecture & SOLID Principles

All code in this repo must follow clean architecture boundaries and SOLID.
The agent must check existing structure before adding new code.

## Layer Rules

```
Presentation → Application → Domain ← Ports ← Infrastructure
```

| Layer | Contains | Depends On | NEVER depends on |
|-------|----------|------------|-----------------|
| **Domain** | Types, entities, policies, state machines, validation | Nothing | React, fetch, SDK, Sui, IO |
| **Application** | Use cases, commands, orchestration | Domain, Ports (interfaces) | Infrastructure, Presentation |
| **Ports** | Interfaces/contracts for gateways, repositories | Domain types | Implementations |
| **Infrastructure** | SDK clients, RPC, API adapters, wallet, Sui TX | Ports, Domain | Presentation |
| **Presentation** | React components, hooks, UI state | Application, Domain types | Infrastructure directly |

## SOLID in Predict Club

### S — Single Responsibility
- One file per use case or gateway
- `recommendFundingRoute.ts` only recommends, does not execute
- `suiPredictGateway.ts` only builds TX, does not sign

### O — Open/Closed
- Adding a new funding route = add case in recommender, don't modify existing
- Adding a new coin type for escrow = generic `<T>`, don't modify contract

### L — Liskov Substitution
- All gateways implement the same interface → swap implementation without breaking callers
- `SuiPredictGateway` interface → can mock in tests

### I — Interface Segregation
- Gateway interfaces are small: `buildMintTx`, `buildClaimTx`, `fetchManagerId`
- No god-interface containing everything

### D — Dependency Inversion
- Application depends on `SuiPredictGateway` interface, never imports SDK directly
- Domain NEVER imports `@mysten/sui`, `@scallop-io/*`, or any external package

## Design Patterns in Use

| Pattern | Where Applied | Example |
|---------|---------------|---------|
| **Factory** | Gateway creation | `createSuiPredictGateway()` |
| **Strategy** | Funding route selection | `recommendFundingRoute()` returns route, caller executes |
| **Repository** | Data access abstraction | `localClubStore.ts`, `clubStore.ts` |
| **Facade** | Complex SDK wrapping | `DeepBookClient` wrapped in swap plugin |
| **Observer** | Shared state | `host.onSharedDataChange('walletProfile', ...)` |
| **Command** | Use case execution | `createRound.ts`, `pledgeToRound.ts`, `executeTradeplan.ts` |
| **Builder** | Transaction construction | PTB building in gateways |

## Rules When Writing New Code

1. **Pure domain** — `domain/` NEVER imports external packages, only types + pure logic
2. **Gateway = interface + factory** — declare interface in `infrastructure/`, export factory function
3. **Use case = 1 file, 1 function** — `application/doThing.ts` exports `doThing(deps, params)`
4. **Deps via params, not globals** — use case receives gateways via argument
5. **UI calls application, not infrastructure** — component → hook → use case → gateway
6. **No side effects in domain** — no fetch, no console.log, no Date.now() in domain
7. **Composable contract design** — public functions return values, entry wrappers transfer

## Correct Example: Adding Scallop Borrow

```
plugins/predict-club/
  domain/types.ts           ← add ScallopRiskState type (pure)
  domain/policies.ts        ← add canBorrowSafely(health) (pure logic)
  infrastructure/
    scallopGateway.ts       ← interface ScallopGateway + createScallopGateway()
  application/
    borrowUsdc.ts           ← borrowUsdc(gateway, params) → Transaction
  presentation/
    ScallopBorrowModal.tsx  ← UI, calls borrowUsdc via hook
```

## Wrong Examples

```typescript
// ❌ Domain imports SDK
import { Scallop } from '@scallop-io/sui-scallop-sdk'
export function getHealthFactor() { ... }

// ❌ Component calls SDK directly
function BorrowButton() {
  const scallop = new Scallop(...)
  scallop.borrow(...)
}

// ❌ Use case transfers internally (not composable)
export async function borrowAndTransfer(ctx) {
  const coin = borrow(...)
  transfer(coin, ctx.sender()) // ← should return coin instead
}
```
