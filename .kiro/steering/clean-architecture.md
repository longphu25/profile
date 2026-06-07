---
inclusion: always
---

# Clean Architecture & SOLID Principles

Mọi code trong repo phải tuân thủ clean architecture boundaries và SOLID.
Agent phải kiểm tra cấu trúc hiện tại trước khi thêm code mới.

## Layer Rules

```
Presentation → Application → Domain ← Ports ← Infrastructure
```

| Layer | Chứa | Depends On | KHÔNG depends on |
|-------|------|------------|-----------------|
| **Domain** | Types, entities, policies, state machines, validation | Không gì cả | React, fetch, SDK, Sui, IO |
| **Application** | Use cases, commands, orchestration | Domain, Ports (interfaces) | Infrastructure, Presentation |
| **Ports** | Interfaces/contracts cho gateways, repositories | Domain types | Implementations |
| **Infrastructure** | SDK clients, RPC, API adapters, wallet, Sui TX | Ports, Domain | Presentation |
| **Presentation** | React components, hooks, UI state | Application, Domain types | Infrastructure trực tiếp |

## SOLID trong Predict Club

### S — Single Responsibility
- Mỗi file một use case hoặc một gateway
- `recommendFundingRoute.ts` chỉ recommend, không execute
- `suiPredictGateway.ts` chỉ build TX, không sign

### O — Open/Closed
- Thêm funding route mới = thêm case trong recommender, không sửa existing
- Thêm coin type mới cho escrow = generic `<T>`, không sửa contract

### L — Liskov Substitution
- Mọi gateway implement cùng interface → swap implementation không break caller
- `SuiPredictGateway` interface → có thể mock trong tests

### I — Interface Segregation
- Gateway interface tách nhỏ: `buildMintTx`, `buildClaimTx`, `fetchManagerId`
- Không có god-interface chứa mọi thứ

### D — Dependency Inversion
- Application depends on `SuiPredictGateway` interface, không import SDK trực tiếp
- Domain KHÔNG import `@mysten/sui`, `@scallop-io/*`, hay bất kỳ external package

## Design Patterns Đang Dùng

| Pattern | Nơi áp dụng | Ví dụ |
|---------|-------------|-------|
| **Factory** | Gateway creation | `createSuiPredictGateway()` |
| **Strategy** | Funding route selection | `recommendFundingRoute()` returns route, caller executes |
| **Repository** | Data access abstraction | `localClubStore.ts`, `clubStore.ts` |
| **Facade** | Complex SDK wrapping | `DeepBookClient` wrapped in swap plugin |
| **Observer** | Shared state | `host.onSharedDataChange('walletProfile', ...)` |
| **Command** | Use case execution | `createRound.ts`, `pledgeToRound.ts`, `executeTradeplan.ts` |
| **Builder** | Transaction construction | PTB building in gateways |

## Rules Khi Viết Code Mới

1. **Domain thuần** — `domain/` KHÔNG import external packages, chỉ types + pure logic
2. **Gateway = interface + factory** — khai báo interface trong `infrastructure/`, export factory function
3. **Use case = 1 file, 1 function** — `application/doThing.ts` exports `doThing(deps, params)`
4. **Deps qua params, không global** — use case nhận gateways qua argument
5. **UI gọi application, không gọi infrastructure** — component → hook → use case → gateway
6. **Không side effects trong domain** — no fetch, no console.log, no Date.now() trong domain
7. **Composable contract design** — public functions return values, entry wrappers transfer

## Ví Dụ Đúng: Thêm Scallop Borrow

```
plugins/predict-club/
  domain/types.ts           ← thêm ScallopRiskState type (pure)
  domain/policies.ts        ← thêm canBorrowSafely(health) (pure logic)
  infrastructure/
    scallopGateway.ts       ← interface ScallopGateway + createScallopGateway()
  application/
    borrowUsdc.ts           ← borrowUsdc(gateway, params) → Transaction
  presentation/
    ScallopBorrowModal.tsx  ← UI, gọi borrowUsdc qua hook
```

## Ví Dụ Sai

```typescript
// ❌ Domain import SDK
import { Scallop } from '@scallop-io/sui-scallop-sdk'
export function getHealthFactor() { ... }

// ❌ Component gọi SDK trực tiếp
function BorrowButton() {
  const scallop = new Scallop(...)
  scallop.borrow(...)
}

// ❌ Use case tự transfer (không composable)
export async function borrowAndTransfer(ctx) {
  const coin = borrow(...)
  transfer(coin, ctx.sender()) // ← nên return coin
}
```
