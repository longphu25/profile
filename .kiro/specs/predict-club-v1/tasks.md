# Implementation Plan: Predict Club V1

## Overview

Implement the Predict Club V1 feature following a 5-layer clean architecture: Domain (pure functions) → Application (use case orchestration) → Infrastructure (Sui PTB gateways) → Data (versioned localStorage) → Presentation (React context integration). Each layer builds on the previous, with property-based tests validating correctness properties from the design document.

## Tasks

- [x] 1. Implement Domain Layer (Pure Functions)
  - [x] 1.1 Implement RoundLifecycleEngine state machine
    - Create `plugins/predict-club/domain/roundLifecycle.ts`
    - Implement `TRANSITION_MAP` constant mapping `(RoundStatus, LifecycleEvent) → RoundStatus`
    - Implement `transition(current, event)` returning `TransitionResult`
    - Implement `validEvents(status)` returning available `LifecycleEvent[]`
    - Export `LifecycleEvent` type
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 1.2 Write property test for valid state machine transitions
    - **Property 1: Valid State Machine Transitions**
    - Generate all valid `(currentStatus, event)` pairs from TRANSITION_MAP
    - Assert `transition()` returns `{ ok: true, newStatus }` matching the map
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

  - [ ]* 1.3 Write property test for invalid state machine transitions
    - **Property 2: Invalid State Machine Transitions Rejected**
    - Generate `(status, event)` pairs NOT in TRANSITION_MAP
    - Assert `transition()` returns `{ ok: false }` and status is unchanged
    - **Validates: Requirements 1.8**

  - [x] 1.4 Implement IndicatorConsensus
    - Create `plugins/predict-club/domain/indicatorConsensus.ts`
    - Implement `computeConsensus(indicators)` returning `ConsensusResult`
    - Majority-based logic: blocked majority → no-trade, bullish majority → bullish, bearish majority → bearish, otherwise neutral
    - Compute confidence based on agreement strength (Low/Medium/High)
    - _Requirements: 6.2, 6.5_

  - [ ]* 1.5 Write property test for signal bias consensus
    - **Property 5: Signal Bias Consensus**
    - Generate arbitrary `IndicatorSignal[]` arrays with varying state distributions
    - Assert majority-based bias computation is correct
    - **Validates: Requirements 6.2, 6.5**

  - [x] 1.6 Implement RiskGate
    - Create `plugins/predict-club/domain/riskGate.ts`
    - Implement `evaluateRiskGate(input)` returning `RiskEvaluation`
    - Check oracle staleness, expiry safety, signal bias no-trade, balance sufficiency
    - Return composite `RiskState` and individual `RiskCheck[]`
    - _Requirements: 3.3, 3.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 1.7 Write property test for risk gate evaluation
    - **Property 6: Risk Gate Evaluation**
    - Generate arbitrary `RiskGateInput` with various threshold combinations
    - Assert blocking conditions produce `{ state: 'blocked', canExecute: false }`
    - Assert all-pass conditions produce `{ state: 'ready', canExecute: true }`
    - **Validates: Requirements 3.3, 3.4, 7.2, 7.3, 7.4, 7.5, 7.6, 14.2, 14.3**

  - [x] 1.8 Implement Policies
    - Create `plugins/predict-club/domain/policies.ts`
    - Implement `validateRoundParams(params)` returning `ValidationResult`
    - Implement `canMemberPledge(round, memberState)` → boolean
    - Implement `canMemberAccept(round, memberState)` → boolean
    - Implement `isOracleStale(lastUpdateMs, thresholdMs)` → boolean
    - Implement `isExpirySafe(expiryMinutes, minSafe)` → boolean
    - _Requirements: 2.1, 2.2, 2.5, 4.1, 4.4_

- [x] 2. Checkpoint - Domain layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Application Layer (Use Cases)
  - [x] 3.1 Implement createRound use case
    - Create `plugins/predict-club/application/createRound.ts`
    - Validate params via `validateRoundParams` policy
    - Compute consensus from indicators
    - Create round with status `draft`, assign unique ID
    - Return `CreateRoundResult` with new round or validation errors
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 3.2 Write property test for round creation validation
    - **Property 3: Round Creation Validation**
    - Generate valid and invalid `CreateRoundParams` (missing fields, RANGE without strikes)
    - Assert valid params → round with status `draft`; invalid params → error
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**

  - [ ]* 3.3 Write property test for indicator snapshot preservation
    - **Property 4: Indicator Snapshot Preservation**
    - Generate arbitrary `IndicatorSignal[]` arrays
    - Assert round record contains deeply equal snapshot of input signals
    - **Validates: Requirements 2.4, 6.1, 6.3**

  - [x] 3.4 Implement confirmRound use case
    - Create `plugins/predict-club/application/confirmRound.ts`
    - Evaluate risk gate; block if risk state is `blocked`
    - Transition round status from `open` → `confirmed` via RoundLifecycleEngine
    - Record confirmation timestamp, lock round parameters
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.5 Implement pledgeToRound use case
    - Create `plugins/predict-club/application/pledgeToRound.ts`
    - Validate round status is `open`, member balance ≥ pledge amount
    - Update member state to `pledged` with stored amount
    - Update round `totalPledgedDusdc`
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ]* 3.6 Write property test for pledge validation
    - **Property 7: Pledge Validation**
    - Generate arbitrary amounts, balances, and round statuses
    - Assert pledge rejected when round not open or balance insufficient
    - Assert pledge accepted with correct member state transition
    - **Validates: Requirements 4.1, 4.4, 4.5**

  - [x] 3.7 Implement executeTradeplan use case
    - Create `plugins/predict-club/application/executeTradeplan.ts`
    - Evaluate risk gate before execution
    - Coordinate: risk check → PTB construction via gateway → wallet signing
    - On success: transition member state to `executed`, store digest
    - On failure: keep member state as `accepted`, return error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 3.8 Write property test for execution state transition
    - **Property 8: Execution State Transition**
    - Mock signer that randomly succeeds/fails
    - Assert success → member state `executed` with digest; failure → state remains `accepted`
    - **Validates: Requirements 5.4, 5.5**

  - [x] 3.9 Implement settleRound use case
    - Create `plugins/predict-club/application/settleRound.ts`
    - Accept `SettlementOutcome` (roundId, result, settledPrice, settledAt)
    - Compute member payouts: winners get proportional share, losers get zero
    - Transition round status to `settled`, create `ClaimItem[]`
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 3.10 Write property test for settlement payout computation
    - **Property 13: Settlement Payout Computation**
    - Generate arbitrary outcomes and member position arrays
    - Assert payouts sum ≤ total pool, winners get positive, losers get zero
    - **Validates: Requirements 11.2**

  - [x] 3.11 Implement claimSettlement use case
    - Create `plugins/predict-club/application/claimSettlement.ts`
    - Build claim PTB via gateway, delegate signing to wallet
    - On success: mark claim as claimed, update history
    - On failure: keep claim status unchanged
    - _Requirements: 11.3, 11.4, 11.6_

  - [x] 3.12 Implement manageEscrow use case
    - Create `plugins/predict-club/application/manageEscrow.ts`
    - Implement `createEscrowOffer(club, params)` → new offer with status `open`
    - Implement `fillEscrowOffer(club, offerId, payment)` → atomic transfer + overpayment handling
    - Implement `cancelEscrowOffer(club, offerId)` → status to cancelled
    - Implement `expireEscrowOffers(club, nowMs)` → expire past-due offers
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 3.13 Write property tests for escrow operations
    - **Property 10: Escrow Offer Creation**
    - **Property 11: Escrow Fill with Overpayment Handling**
    - **Property 12: Escrow Expiry**
    - Generate arbitrary escrow params, fill amounts, and expiry times
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6**

  - [ ]* 3.14 Write property test for funding route recommendation
    - **Property 9: Funding Route Recommendation**
    - Generate arbitrary `AssetBalances` and `PredictionRound`
    - Assert deterministic priority: dusdc → usdc → sui → bridge
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.6**

- [x] 4. Checkpoint - Application layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Infrastructure Layer (Gateways)
  - [x] 5.1 Implement SuiPredictGateway
    - Create `plugins/predict-club/infrastructure/suiPredictGateway.ts`
    - Implement `buildMintTx(params)` → PTB for directional prediction (UP/DOWN)
    - Implement `buildMintRangeTx(params)` → PTB for RANGE prediction
    - Implement `buildClaimTx(params)` → PTB for claiming settled positions
    - Implement `buildSwapSuiToUsdcTx(params)` → PTB for DeepBook swap preserving gas
    - Uses `@mysten/sui/transactions` Transaction builder
    - _Requirements: 5.1, 9.4, 11.4_

  - [x] 5.2 Implement IndicatorSignalGateway
    - Create `plugins/predict-club/infrastructure/indicatorSignalGateway.ts`
    - Implement `fetchSignals(market)` → returns configurable/simulated indicator data for V1
    - Implement `checkOracleHealth(oracleId)` → returns `{ lastUpdateMs, isHealthy }` with configurable threshold
    - V1 uses demo/simulated data; no live Pyth integration required
    - _Requirements: 6.1, 14.1, 14.4_

  - [ ]* 5.3 Write unit tests for SuiPredictGateway PTB construction
    - Test that `buildMintTx` constructs correct move calls for UP/DOWN
    - Test that `buildMintRangeTx` includes both strike bounds
    - Test that `buildClaimTx` targets the correct position
    - Test that `buildSwapSuiToUsdcTx` preserves gas amount
    - _Requirements: 5.1, 9.4_

- [x] 6. Upgrade Data Layer (Versioned localStorage)
  - [x] 6.1 Upgrade localClubStore with versioned schema
    - Modify `plugins/predict-club/data/localClubStore.ts`
    - Add `PersistedClubStateV1` wrapper with `_version: 1` and `_updatedAt` timestamp
    - Implement versioned `saveClubState(state)` → writes `{ _version: 1, _updatedAt, club }`
    - Implement versioned `loadClubState()` → validates version, migrates if needed, fallback on corruption
    - Handle graceful fallback for corrupted/missing data → return default state without throwing
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 6.2 Write property test for ClubState serialization round-trip
    - **Property 14: ClubState Serialization Round-Trip**
    - Generate arbitrary valid `ClubState` objects via fast-check
    - Assert `loadClubState(saveClubState(state)) ≡ state`
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.5**

  - [ ]* 6.3 Write property test for corrupted localStorage graceful fallback
    - **Property 15: Corrupted localStorage Graceful Fallback**
    - Generate arbitrary non-JSON strings and malformed JSON
    - Assert `loadClubState` returns valid default state without throwing
    - **Validates: Requirements 13.3**

- [x] 7. Checkpoint - Domain through Data layers complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate Context and Presentation Layer
  - [x] 8.1 Upgrade PredictClubContext with use case dispatch
    - Modify `plugins/predict-club/presentation/PredictClubContext.tsx`
    - Add `PredictClubActions` interface with all use case dispatch methods
    - Wire `createRound`, `confirmRound`, `pledgeToRound`, `executeTradeplan`, `settleRound`, `claimSettlement` through context
    - Wire `createEscrowOffer`, `fillEscrowOffer`, `cancelEscrowOffer` for escrow management
    - Replace hardcoded `demoBalances` with wallet-queried balances when connected
    - Persist state changes via versioned `saveClubState` after each action
    - _Requirements: 1.9, 8.1, 8.2, 8.3, 8.4_

  - [x] 8.2 Wire ModalLayer to use case actions
    - Modify `plugins/predict-club/presentation/ModalLayer.tsx`
    - Connect create-round modal to `createRound` use case with form validation
    - Connect execute-trade modal to `executeTradeplan` use case with PTB preview
    - Connect claim-settlement modal to `claimSettlement` use case
    - Connect fund-to-join modal to funding router display
    - Connect create-escrow and fill-escrow modals to `manageEscrow` use cases
    - Display errors from use case results via toast/inline messages
    - _Requirements: 2.1, 5.2, 10.1, 10.3, 11.4_

  - [x] 8.3 Wire panels to domain computations
    - Update `PredictionRoomPanel` to display live `computeConsensus` results
    - Update `RiskPanel` to display live `evaluateRiskGate` results with blocking reasons
    - Update `FundingRouterPanel` to show all funding cards with status from `recommendFundingRoute`
    - Update `EscrowOffersPanel` to list offers and wire fill/cancel actions
    - Update `ClubPanel` to show member states, pledges, and acceptance status
    - Update `RoundHistoryPanel` to show archived rounds with PnL and claim status
    - _Requirements: 3.2, 4.3, 6.4, 7.1, 7.5, 7.6, 9.1, 9.6, 11.6_

  - [x] 8.4 Implement wallet integration and error handling
    - Wire `SuiHostAPI.signAndExecuteTransaction` as the signer for execute/claim use cases
    - Display wallet connection state, address, network in decision strip
    - Disable signature-requiring actions when wallet disconnected
    - Handle wallet errors (rejected, failed, network mismatch) with user-visible messages
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 5.5, 5.6_

- [ ] 9. Checkpoint - Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration tests
  - [ ]* 10.1 Write integration test for full round lifecycle
    - Test create → publish → pledge → confirm → execute → settle → claim flow
    - Verify state transitions at each step, member states, and final history entry
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 10.2 Write integration test for escrow fill flow
    - Test create offer → fill → verify state updates and balance changes
    - Test overpayment handling returns excess
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

- [ ] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- `recommendFundingRoute` is already implemented — property test (3.14) validates its correctness
- The 8 React panels are already scaffolded with Tailwind classes — tasks 8.x wire them to real use cases
- `SuiHostAPI.signAndExecuteTransaction` is the wallet signing interface (no private key handling)
- V1 uses simulated indicator data and configurable oracle thresholds (no live Pyth)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "1.6", "1.8"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.5", "1.7"] },
    { "id": 2, "tasks": ["3.1", "3.4", "3.5", "3.7", "3.9", "3.11", "3.12"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.6", "3.8", "3.10", "3.13", "3.14"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 5, "tasks": ["5.3", "6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 8, "tasks": ["10.1", "10.2"] }
  ]
}
```
