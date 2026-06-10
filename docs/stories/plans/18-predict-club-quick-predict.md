# Plan 18 — Predict Club Quick Predict Mode

## Status: ✅ All Phases Complete

## Goal

Add a "Quick Predict" mode to the Predict Club plugin — short-expiry binary
rounds where members tap UP or DOWN in seconds, inspired by the crash game UX
at crash.suize.io but retaining Predict Club's community-led, risk-disclosed
identity.

## Motivation

- **Demo impact:** Fast rounds are more engaging for hackathon judging than
  multi-minute deliberation flows.
- **Viral loop:** Social speed-betting creates excitement — leaderboard, streak,
  group energy.
- **Infrastructure reuse:** All existing pieces (PredictManager, funding,
  escrow, oracle service) are needed; this is a UX mode, not new infra.
- **Differentiation from Suize:** Suize is individual + gamified. Quick Predict
  is community-led with risk context preserved.

## Scope

In:

- New `QuickPredictPanel` component as a tab/mode in Predict Club
- Leader "starts a quick round" — picks oracle + accepts shortest expiry
- Members see live price stream + tap UP or DOWN before a join deadline
- Simplified strike selection (ATM auto-pick or leader-specified)
- Countdown timer for join window and expiry settlement
- Auto-redeem on settlement (keeper-style claim)
- Quick round history with win/loss per member
- Risk disclosure remains visible (oracle health, max loss, expiry)

Out:

- Move contract changes (uses existing DeepBook Predict mint/redeem)
- Leverage / Margin compose (future Plan)
- PLP vault strategy (separate research)
- Animated "crash multiplier" gamification (we are NOT a casino)
- Mainnet deploy

## User Flow

```
Leader                              Members
  │                                    │
  ├─ Click "Start Quick Round"         │
  ├─ Select oracle (BTC/ETH)          │
  ├─ Pick expiry (shortest active)    │
  ├─ Set join window (30s/60s)        │
  ├─ Optional: specify strike          │
  │   (default: ATM at round start)   │
  ├─ Confirm → Round goes LIVE        │
  │                                    │
  │   ┌───────────────────────────┐   │
  │   │ LIVE — Join Window Open   │   │
  │   │ Oracle: BTC $95,420       │   │
  │   │ Strike: $95,400 (ATM)     │   │
  │   │ Expiry: 3 min             │   │
  │   │ Max Loss: 0.50 DUSDC      │   │
  │   │                           │   │
  │   │   [ ▲ UP ]   [ ▼ DOWN ]  │◄──┤ Members tap
  │   │                           │   │
  │   │ Joined: Alice ▲, Bob ▼   │   │
  │   │ Timer: 0:22 remaining     │   │
  │   └───────────────────────────┘   │
  │                                    │
  │   ┌───────────────────────────┐   │
  │   │ LIVE — Waiting Settlement │   │
  │   │ Current: $95,510 (+0.12%) │   │
  │   │ Expiry in: 2:38           │   │
  │   │ UP holders winning ✓      │   │
  │   └───────────────────────────┘   │
  │                                    │
  │   ┌───────────────────────────┐   │
  │   │ SETTLED                   │   │
  │   │ Settlement: $95,620       │   │
  │   │ Result: UP wins ✓         │   │
  │   │ Alice: +0.42 DUSDC        │   │
  │   │ Bob: -0.50 DUSDC          │   │
  │   │ Auto-claimed ✓            │   │
  │   └───────────────────────────┘   │
  │                                    │
  ├─ Click "Start Next Round"          │
  └────────────────────────────────────┘
```

## Round Lifecycle (Quick Mode)

```
draft → live → locked → settling → settled → claimed
```

| Status | Duration | Description |
|--------|----------|-------------|
| `draft` | Instant | Leader configuring parameters |
| `live` | 30-60s (configurable) | Join window open, members tap UP/DOWN |
| `locked` | Until expiry | No new joins, watching price |
| `settling` | Seconds | Oracle reaches expiry, pending settlement push |
| `settled` | Seconds | Settlement price frozen |
| `claimed` | Instant | Auto-redeem triggered for all participants |

This maps to existing `RoundStatus` with additions:

```typescript
// Existing statuses reused:
// 'draft' → 'open' (live) → 'confirmed' (locked) → 'executed' → 'settled' → 'claimed'
// Quick mode just speeds through with auto-transitions
```

## Architecture

### New Files

| Layer | File | Purpose |
|-------|------|---------|
| Domain | `domain/quickRound.ts` | Quick round types, validation, ATM strike calc |
| Application | `application/startQuickRound.ts` | Leader starts round, resolves oracle + expiry |
| Application | `application/joinQuickRound.ts` | Member taps UP/DOWN, triggers mint |
| Application | `application/settleQuickRound.ts` | Watch settlement, auto-redeem all |
| Presentation | `presentation/QuickPredictPanel.tsx` | Main tab UI |
| Presentation | `presentation/QuickRoundLive.tsx` | Live round view (price, timer, members) |
| Presentation | `presentation/QuickRoundHistory.tsx` | Past rounds leaderboard |

### Reused Existing

| Existing | Used For |
|----------|----------|
| `deepbookOracleService.ts` | Oracle list, price stream, health check |
| `suiPredictGateway.ts` | `buildMintPositionTx`, `buildRedeemTx` |
| `deepbookPredictPricingService.ts` | Fair value / cost preview |
| `domain/policies.ts` | Oracle stale check, expiry safety |
| `domain/payoutPreview.ts` | Win probability, max loss display |
| `walletBalanceService.ts` | DUSDC balance check before join |
| `fundingGateway.ts` | Quick funding if DUSDC insufficient |
| `localClubStore.ts` | Persist quick round history locally |

### Data Flow

```
┌─ QuickPredictPanel ─────────────────────────────────────────┐
│                                                              │
│  ┌─ Leader View ──┐   ┌─ Member View ──────────────────┐   │
│  │ Start Round    │   │ Live Price + Timer              │   │
│  │ Oracle Select  │   │ [ ▲ UP ] [ ▼ DOWN ]            │   │
│  │ Expiry/Strike  │   │ Members joined list             │   │
│  └───────┬────────┘   └──────────────┬──────────────────┘   │
│          │                            │                      │
│          ▼                            ▼                      │
│  startQuickRound()            joinQuickRound(direction)      │
│          │                            │                      │
│          ▼                            ▼                      │
│  deepbookOracleService        suiPredictGateway              │
│  → resolve oracle + ATM       → buildMintPositionTx          │
│  → start price stream         → signAndExecute               │
│                                                              │
│  ┌─ Settlement Watcher ────────────────────────────────┐    │
│  │ Poll oracle state until settled                      │    │
│  │ → settleQuickRound() → batch redeem for all members │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Domain: `quickRound.ts`

```typescript
export interface QuickRoundConfig {
  oracleId: string
  expiry: number
  strike: number               // ATM or leader-specified
  joinWindowSeconds: number    // 30 or 60
  maxQuantityPerMember: number // DUSDC cap per person
}

export interface QuickRoundParticipant {
  address: string
  name: string
  direction: 'UP' | 'DOWN'
  quantity: number
  joinedAt: number
  txDigest?: string           // mint tx
  redeemDigest?: string       // redeem tx
  payout?: number             // after settlement
}

export interface QuickRound {
  id: string
  config: QuickRoundConfig
  status: 'draft' | 'live' | 'locked' | 'settling' | 'settled' | 'claimed'
  startedAt: number
  lockedAt?: number
  settledAt?: number
  settlementPrice?: number
  participants: QuickRoundParticipant[]
  result?: 'UP' | 'DOWN'     // which side won
}

export function resolveATMStrike(spotPrice: number, tickSize: number): number {
  return Math.round(spotPrice / tickSize) * tickSize
}

export function isJoinWindowOpen(round: QuickRound): boolean {
  if (round.status !== 'live') return false
  const elapsed = (Date.now() - round.startedAt) / 1000
  return elapsed < round.config.joinWindowSeconds
}

export function determineResult(
  strike: number,
  settlementPrice: number
): 'UP' | 'DOWN' {
  return settlementPrice > strike ? 'UP' : 'DOWN'
}
```

## Application: `startQuickRound.ts`

```typescript
export async function startQuickRound(
  oracleService: DeepBookOracleService,
  config: { oracleId?: string; joinWindowSeconds?: number; strikeOverride?: number }
): Promise<QuickRound> {
  // 1. Get oracles, pick shortest active expiry
  // 2. Fetch latest price for ATM strike
  // 3. Create QuickRound in 'live' status
  // 4. Start countdown timer
  // 5. Return round for UI binding
}
```

## Application: `joinQuickRound.ts`

```typescript
export async function joinQuickRound(
  round: QuickRound,
  direction: 'UP' | 'DOWN',
  quantity: number,
  deps: {
    predictGateway: SuiPredictGateway
    host: HostAPI
  }
): Promise<{ txDigest: string }> {
  // 1. Validate join window still open
  // 2. Validate DUSDC balance sufficient
  // 3. Build mint position TX (binary, is_up = direction === 'UP')
  // 4. Sign and execute
  // 5. Add participant to round state
}
```

## Application: `settleQuickRound.ts`

```typescript
export async function settleQuickRound(
  round: QuickRound,
  deps: {
    oracleService: DeepBookOracleService
    predictGateway: SuiPredictGateway
    host: HostAPI
  }
): Promise<QuickRound> {
  // 1. Poll oracle state until 'settled'
  // 2. Read settlement price
  // 3. Determine result (UP or DOWN)
  // 4. For each participant with winning position → build redeem TX
  // 5. Batch sign/execute redeems (or prompt each member in V1)
  // 6. Update round status to 'claimed'
}
```

## Presentation: `QuickPredictPanel.tsx`

Three states:

1. **No active round** → Leader sees "Start Quick Round" button, history below
2. **Live/Locked round** → Live price, timer, UP/DOWN buttons, participant list
3. **Settled** → Result card, PnL per member, "Next Round" button

### Key UI Rules

- Always show: oracle health badge, expiry countdown, max loss per member
- Timer must be prominent (large countdown)
- UP/DOWN buttons disabled when: join window closed, DUSDC insufficient, already joined
- After join: show pending animation until TX confirmed
- After settle: auto-show result with 2s celebration/commiseration
- No multiplier animation (we are not a casino)
- Price chart: simple sparkline of oracle price during round

## Oracle Streaming Enhancement

Current `deepbookOracleService.ts` already has WebSocket scaffolding. For Quick
Predict, ensure:

1. Price updates arrive every 1-2s during live rounds
2. Settlement detection via `OracleSettled` event
3. Fallback: poll `/oracles/:id/state` every 3s if WS unavailable

```typescript
// Enhancement to deepbookOracleService.ts
export function subscribeToOraclePrice(
  oracleId: string,
  callback: (price: OraclePrice) => void
): () => void {
  // Filter Sui events by oracle_id + OraclePricesUpdated
  // Return unsubscribe function
}

export function waitForSettlement(
  oracleId: string,
  callback: (settlementPrice: number) => void
): () => void {
  // Poll state or subscribe OracleSettled event
  // Fire once and auto-unsubscribe
}
```

## Auto-Redeem Strategy

### V1 (member-signed, per product rules):
Each member redeems their own position after settlement. The UI prompts
"Claim your winnings" with one-click redeem.

### V1.5 (batch prompt):
After settlement, show all claimable members. Each signs individually but
the UI batches the UX into "Claim All" which fires sequential TXs.

### V2 (keeper — future):
A permissionless keeper service calls `predict::redeem` for settled positions.
Requires Predict protocol to allow third-party redeems (check contract).

**Decision: Start with V1 (member-signed claim).** Auto-prompt immediately
after settlement is detected.

## Risk Disclosure (Non-Negotiable)

Even in Quick mode, the following must be visible:

| Item | Where | Format |
|------|-------|--------|
| Max loss per position | Join confirmation | "You risk up to X DUSDC" |
| Oracle health | Top badge | Green/yellow/red dot |
| Expiry time | Countdown timer | MM:SS format |
| Win probability (fair) | Below UP/DOWN buttons | "~52% based on SVI" |
| Settlement is oracle-driven | Disclaimer text | Small footer note |

## Migration Path

Quick Predict rounds can coexist with the existing "deliberate" rounds:

- `PredictClubRoot.tsx` adds a tab: `Prediction Room` | `Quick Predict` | `History`
- Both modes share the same club, members, funding infrastructure
- Quick rounds stored separately in `localClubStore` under a `quickRounds` key
- Same wallet/PredictManager used for both modes

## Phased Delivery

| Phase | Tasks | Estimate |
|-------|-------|----------|
| **P1: Core** | `quickRound.ts` domain, `startQuickRound`, `joinQuickRound`, `QuickPredictPanel` (static) | ✅ Done |
| **P2: Live** | Oracle price streaming during round, countdown timer, live participant list | ✅ Done |
| **P3: Settlement** | `settleQuickRound`, auto-detect settlement, prompt claim | ✅ Done |
| **P4: History** | `QuickRoundHistory`, win/loss per member, streak counter | ✅ Done |
| **P5: Polish** | Loading states, error handling, mobile responsive, contextual warnings | ✅ Done |

**Total estimate: 8-12 hours**

## Success Criteria

- [ ] Leader can start a quick round in < 5 seconds
- [ ] Members can join (UP/DOWN) within the join window
- [ ] Live oracle price updates visible during round
- [ ] Settlement auto-detected and result displayed
- [ ] Member can claim winning position in one click
- [ ] Round history shows win/loss per member
- [ ] Risk disclosure visible at all times
- [ ] Works on mobile viewport (375px)

## Open Questions

1. **Join window duration** — Default 30s or 60s? → Start with 30s, make configurable
2. **Multiple rounds per session** — Allow overlapping or sequential only? → Sequential only (V1)
3. **Quantity flexibility** — Fixed per round or member chooses? → Fixed by leader (simplicity)
4. **Losing positions** — Do they expire worthless or need explicit redeem? → Check Predict contract behavior for OTM positions at settlement

## References

- [Crash Suize Analysis](../deepbook/crash-suize-deepbook-predict-analysis.md)
- [Predict Club Product](../product/predict-club.md)
- [Predict Club Funding](../product/predict-club-funding.md)
- [Plan 14 — Contract Integration](./14-predict-club-contract-integration.md)
- [DeepBook Predict Design](https://docs.sui.io/onchain-finance/deepbook-predict/design)
