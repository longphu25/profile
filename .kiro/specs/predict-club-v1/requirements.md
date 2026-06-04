# Requirements Document

## Introduction

Predict Club V1 is a community trading cockpit for DeepBook Predict on the Sui blockchain. It enables a leader to create prediction rounds, members to pledge and accept rounds, and each member to execute user-signed Predict trades with clear indicator and risk context. V1 uses self-sign coordination (non-custodial), localStorage for state, and a Funding Router with P2P escrow exchange to help members acquire DUSDC.

## Glossary

- **Predict_Club**: The community coordination layer application that manages prediction rounds, member interactions, and trade execution workflows for DeepBook Predict.
- **Leader**: A club member with elevated permissions who creates proposals, records trade theses, confirms rounds, and manages group workflow.
- **Member**: A club participant who joins a club, pledges intent, accepts signals, signs personal trades, monitors settlement, and claims positions.
- **Keeper**: An external actor who scans settled positions and helps redeem when the protocol function is permissionless.
- **Observer**: A read-only participant who reviews round history, indicators, and leader performance without trading.
- **Round**: A single prediction opportunity that progresses through a defined lifecycle from draft to claimed or cancelled.
- **Round_Lifecycle_Engine**: The state machine component that enforces valid transitions between round statuses.
- **PredictManager**: A user-owned on-chain account on DeepBook Predict used to execute mint and range trades.
- **DUSDC**: The DeepBook-specific USD stablecoin required for minting prediction positions.
- **Indicator_Consensus**: A snapshot of multiple technical indicator signals used to support or block a trade thesis.
- **Risk_Gate**: The component that evaluates oracle health, expiry safety, DUSDC readiness, and indicator consensus before allowing trade execution.
- **Funding_Router**: The component that recommends and facilitates funding paths for members who lack DUSDC.
- **Escrow_Market**: The P2P exchange system allowing atomic swaps between USDC and DUSDC within a club.
- **PTB**: Programmable Transaction Block, the Sui transaction format used for composing multi-step on-chain operations.
- **Oracle**: An external price feed (Pyth BTC/USD) used by DeepBook Predict for settlement.
- **Signal_Bias**: The directional consensus derived from indicators: bullish, bearish, neutral, or no-trade.
- **Decision_Strip**: The top-level UI element showing the active round summary and primary call-to-action.
- **Wallet_Connector**: The component that integrates Sui DAppKit for wallet connection, network selection, and transaction signing.

## Requirements

### Requirement 1: Round Lifecycle State Machine

**User Story:** As a Leader, I want prediction rounds to follow a strict lifecycle, so that all participants understand the current state and available actions.

#### Acceptance Criteria

1. THE Round_Lifecycle_Engine SHALL support the following statuses: draft, open, confirmed, funding, executed, settled, claimed, and cancelled.
2. WHEN a Leader publishes a draft round, THE Round_Lifecycle_Engine SHALL transition the round status from draft to open.
3. WHEN a Leader confirms an open round, THE Round_Lifecycle_Engine SHALL transition the round status from open to confirmed.
4. WHEN all participating members complete trade signing for a confirmed round, THE Round_Lifecycle_Engine SHALL transition the round status from confirmed to executed.
5. WHEN the oracle settles the prediction outcome for an executed round, THE Round_Lifecycle_Engine SHALL transition the round status from executed to settled.
6. WHEN all claimable payouts for a settled round are claimed, THE Round_Lifecycle_Engine SHALL transition the round status from settled to claimed.
7. WHEN a Leader cancels an open round or a policy failure occurs on a confirmed round, THE Round_Lifecycle_Engine SHALL transition the round status to cancelled.
8. IF an invalid status transition is attempted, THEN THE Round_Lifecycle_Engine SHALL reject the transition and preserve the current status.
9. THE Round_Lifecycle_Engine SHALL persist round state to localStorage after each valid transition.

### Requirement 2: Leader Round Creation

**User Story:** As a Leader, I want to create prediction rounds with a thesis and market parameters, so that members can evaluate and participate.

#### Acceptance Criteria

1. THE Predict_Club SHALL allow a Leader to create a round specifying: oracle asset, expiry time, direction (UP, DOWN, or RANGE), strike price, suggested DUSDC amount, and trade thesis text.
2. WHEN a Leader creates a round with direction RANGE, THE Predict_Club SHALL require both a lower strike and an upper strike value.
3. WHEN a Leader submits a new round, THE Predict_Club SHALL save the round with status draft and the Leader as the round creator.
4. WHEN a Leader publishes a draft round, THE Predict_Club SHALL snapshot the current Indicator_Consensus before transitioning to open status.
5. IF a Leader attempts to create a round without specifying oracle, expiry, direction, or strike, THEN THE Predict_Club SHALL display a validation error and prevent round creation.

### Requirement 3: Leader Round Confirmation

**User Story:** As a Leader, I want to confirm a round after reviewing pledges and indicators, so that members know execution is authorized.

#### Acceptance Criteria

1. WHEN a Leader confirms an open round, THE Predict_Club SHALL record the confirmation timestamp and lock the round parameters.
2. WHEN a round is confirmed, THE Predict_Club SHALL display oracle health status, expiry countdown, maximum loss estimate, and aggregate DUSDC readiness to all members.
3. IF a Leader attempts to confirm a round with a stale oracle feed, THEN THE Predict_Club SHALL block confirmation and display an oracle health warning.
4. IF a Leader attempts to confirm a round where the Indicator_Consensus resolves to no-trade, THEN THE Predict_Club SHALL block confirmation and display a no-trade warning.

### Requirement 4: Member Pledge and Acceptance

**User Story:** As a Member, I want to pledge my intent and accept a signal, so that the Leader and other members can see group commitment.

#### Acceptance Criteria

1. WHEN a Member pledges to an open round, THE Predict_Club SHALL record the Member state as pledged and store the pledged DUSDC amount.
2. WHEN a Member accepts a confirmed signal, THE Predict_Club SHALL transition the Member state from pledged to accepted.
3. THE Predict_Club SHALL display all member names, pledge amounts, and current states in the club panel.
4. WHILE a round status is draft, THE Predict_Club SHALL prevent members from pledging.
5. IF a Member attempts to pledge more DUSDC than their wallet balance, THEN THE Predict_Club SHALL display an insufficient balance warning and suggest the Funding_Router.

### Requirement 5: Trade Execution (User-Signed)

**User Story:** As a Member, I want to sign my own Predict trade through my wallet, so that I retain custody of my funds at all times.

#### Acceptance Criteria

1. WHEN a Member initiates trade execution for an accepted round, THE Predict_Club SHALL construct a PTB containing the appropriate DeepBook Predict mint or mint_range call targeting the Member own PredictManager.
2. THE Predict_Club SHALL present the constructed PTB details (direction, strike, amount, expiry, oracle) to the Member for review before requesting a wallet signature.
3. WHEN the Member approves the transaction in their wallet, THE Wallet_Connector SHALL submit the signed PTB to the Sui network and return the transaction digest.
4. WHEN a transaction is confirmed on-chain, THE Predict_Club SHALL transition the Member state from accepted to executed and store the transaction digest.
5. IF the wallet rejects or the transaction fails, THEN THE Predict_Club SHALL display the error reason and keep the Member state as accepted.
6. THE Predict_Club SHALL ensure that no private key is held, stored, or transmitted by the application at any point during execution.

### Requirement 6: Indicator Consensus Snapshot

**User Story:** As a Leader, I want indicators to be snapshotted before confirmation, so that the trade thesis has recorded evidence.

#### Acceptance Criteria

1. WHEN a Leader publishes a round, THE Predict_Club SHALL capture the current state, value, and confidence of each configured indicator.
2. THE Predict_Club SHALL compute a Signal_Bias (bullish, bearish, neutral, or no-trade) from the aggregate indicator states.
3. THE Predict_Club SHALL store the indicator snapshot immutably with the round record.
4. THE Predict_Club SHALL display each indicator name, state, value, and confidence in the Prediction Room panel.
5. WHEN the majority of indicators resolve to a blocked state, THE Predict_Club SHALL set the Signal_Bias to no-trade.

### Requirement 7: Risk Gate Checks

**User Story:** As a Member, I want the system to check risk conditions before I execute, so that I am protected from unsafe trades.

#### Acceptance Criteria

1. WHILE a round is in confirmed status, THE Risk_Gate SHALL evaluate oracle health, expiry safety, DUSDC readiness, and indicator consensus.
2. IF the oracle feed age exceeds the staleness threshold, THEN THE Risk_Gate SHALL set the risk state to blocked and display an oracle stale warning.
3. IF the expiry time remaining is below the minimum safe window, THEN THE Risk_Gate SHALL set the risk state to blocked and display an unsafe expiry warning.
4. IF a Member DUSDC balance is below the suggested round amount, THEN THE Risk_Gate SHALL set the risk state to warning and suggest the Funding_Router.
5. IF any risk check resolves to blocked, THEN THE Risk_Gate SHALL disable the execute trade button and display all blocking reasons.
6. WHEN all risk checks pass, THE Risk_Gate SHALL set the risk state to ready and enable the execute trade button.

### Requirement 8: Wallet Integration

**User Story:** As a Member, I want to connect my Sui wallet to the cockpit, so that I can sign transactions and view my balances.

#### Acceptance Criteria

1. THE Wallet_Connector SHALL integrate with Sui DAppKit to discover, connect, and disconnect compatible Sui wallets.
2. WHEN a wallet is connected, THE Predict_Club SHALL display the connected address and current network (Testnet) in the top bar.
3. WHEN a wallet is connected, THE Predict_Club SHALL query and display the SUI, USDC, and DUSDC balances.
4. IF no wallet is connected, THEN THE Predict_Club SHALL disable all actions that require a wallet signature and display a connect prompt.
5. WHEN the connected network does not match Sui Testnet, THE Wallet_Connector SHALL display a network mismatch warning.

### Requirement 9: Funding Router

**User Story:** As a Member without DUSDC, I want to see available funding paths, so that I can acquire DUSDC and participate in rounds.

#### Acceptance Criteria

1. THE Funding_Router SHALL evaluate the Member wallet balances and recommend applicable funding routes from: ready-with-dusdc, deepbook-sui-to-usdc, scallop-borrow-usdc, bridge-assets-to-sui, and club-escrow-usdc-to-dusdc.
2. WHEN a Member has sufficient DUSDC, THE Funding_Router SHALL mark the ready-with-dusdc route as ready.
3. WHEN a Member has SUI but no USDC or DUSDC, THE Funding_Router SHALL mark the deepbook-sui-to-usdc route as available.
4. WHEN a Member selects the DeepBook swap route, THE Funding_Router SHALL construct a PTB that swaps SUI to USDC while preserving sufficient SUI for gas fees.
5. WHEN a Member selects the Scallop borrow route, THE Funding_Router SHALL display collateral amount, borrow amount, health factor, and liquidation risk before any wallet signing.
6. THE Funding_Router SHALL mark each route with a status of ready, available, needs-review, or blocked based on wallet state and prerequisites.

### Requirement 10: P2P Escrow Exchange

**User Story:** As a Member, I want to exchange USDC for DUSDC through a club escrow offer, so that I can fund my PredictManager.

#### Acceptance Criteria

1. THE Escrow_Market SHALL allow any club member to create an offer specifying: offered asset, wanted asset, offer amount, want amount, and expiry time.
2. WHEN a maker creates an escrow offer, THE Escrow_Market SHALL store the offer with status open and display the offer in the escrow panel.
3. WHEN a filler fills an open offer, THE Escrow_Market SHALL atomically transfer the offered asset to the filler and the wanted asset to the maker.
4. WHEN an offer expiry time is reached without being filled, THE Escrow_Market SHALL transition the offer status to expired and return assets to the maker.
5. WHEN a maker cancels their own open offer, THE Escrow_Market SHALL transition the offer status to cancelled and return assets to the maker.
6. IF a filler provides payment exceeding the want amount, THEN THE Escrow_Market SHALL split the exact want amount and return the excess to the filler.

### Requirement 11: Settlement Tracking and Claims

**User Story:** As a Member, I want to track round settlement and claim my winnings, so that I receive my earned DUSDC.

#### Acceptance Criteria

1. WHEN a round reaches executed status, THE Predict_Club SHALL monitor the oracle settlement state for the prediction outcome.
2. WHEN the oracle settles a round outcome, THE Predict_Club SHALL compute each Member payout based on position result (won, lost, or void).
3. WHEN a claimable position is identified, THE Predict_Club SHALL display the claim amount and a claim action in the claims panel.
4. WHEN a Member initiates a claim, THE Predict_Club SHALL construct a PTB calling the DeepBook Predict claim function on the Member PredictManager.
5. WHEN a Keeper identifies a settled position with a permissionless redeem, THE Predict_Club SHALL allow the Keeper to trigger the redeem on behalf of the position owner.
6. THE Predict_Club SHALL archive completed rounds with PnL, participation count, thesis evidence, and claim status in the round history.

### Requirement 12: Mobile Responsive Layout

**User Story:** As a Member using a mobile device, I want to navigate the cockpit through tabs, so that I can participate on smaller screens.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE Predict_Club SHALL display a tab-based navigation with five tabs: Clubs, Predict, Execution, Funding, and Account.
2. WHEN the viewport width is 768px or above, THE Predict_Club SHALL display the desktop three-panel layout with Decision Strip.
3. THE Predict_Club SHALL maintain a sticky bottom action bar on mobile showing the next primary action for the active round.
4. THE Predict_Club SHALL ensure all interactive elements meet a minimum touch target size of 44x44 pixels on mobile viewports.

### Requirement 13: Data Persistence (localStorage V1)

**User Story:** As a Member, I want my club state to persist across browser sessions, so that I do not lose round progress or history.

#### Acceptance Criteria

1. THE Predict_Club SHALL persist all club state (rounds, members, indicators, escrow offers, history, claims) to localStorage.
2. WHEN the application loads, THE Predict_Club SHALL restore the most recent club state from localStorage.
3. IF localStorage data is corrupted or missing required fields, THEN THE Predict_Club SHALL initialize a default empty club state and log the error.
4. THE Predict_Club SHALL serialize club state to JSON using a versioned schema identifier to support future migrations.
5. FOR ALL valid ClubState objects, serializing to JSON then deserializing SHALL produce an equivalent ClubState object (round-trip property).

### Requirement 14: Oracle Health Monitoring

**User Story:** As a Member, I want to see oracle health status, so that I know whether the price feed is reliable before executing.

#### Acceptance Criteria

1. THE Predict_Club SHALL display the oracle name, last update timestamp, and health status for the active round.
2. WHEN the oracle last update exceeds 60 seconds, THE Predict_Club SHALL mark the oracle status as stale.
3. WHILE the oracle status is stale, THE Risk_Gate SHALL block trade execution.
4. THE Predict_Club SHALL simulate oracle health monitoring using configurable thresholds for V1 (no live Pyth integration required).
