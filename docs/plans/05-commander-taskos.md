# Commander TaskOS Plan for DeepBook

## Summary

Reframe each connected user as a **Commander** operating a **TaskOS**. Instead of browsing plugins manually, the user issues commands, receives missions, reviews risk, and approves execution.

- Commander = connected wallet/user identity.
- TaskOS = orchestration shell that turns goals into actionable tasks.
- Mission = user-facing objective such as trade, hedge, review risk, run bot, claim settlement.
- Task = executable or reviewable step backed by an existing plugin.
- Plugin = capability provider that renders UI and executes wallet-safe actions.

This should sit above DeepBook plugins first, then generalize to other Sui domains later.

## Commander Profile

Derived from wallet state:

- wallet address
- network
- connected apps/plugins
- risk exposure
- recent activity
- mission progress
- streaks/achievements

Commander statuses:

- `Ready`
- `Needs Wallet`
- `At Risk`
- `Action Available`
- `Awaiting Signature`

Commander dashboard should answer:

- What is my current state?
- What should I do next?
- What needs my approval?

## TaskOS Shell

Target:

- Static page: `deepbook.html`
- Root app: `DeepBookTaskOS`
- Runtime: reuse `SuiHostAPI`, `ShadowContainer`, dynamic plugin loading, wallet context, shared data store

Layout:

- Top command bar:
  - wallet/network
  - command input
  - global status
- Mission Control:
  - recommended missions
  - active tasks
  - alerts
  - recent completions
- Workspace:
  - active plugin panel
  - task stepper
  - execution preview
- Side rail:
  - Commander profile
  - risk status
  - quest/streak status
  - pending approvals

## Command Model

Use deterministic command routing in v1; no LLM dependency required.

Command categories:

- `Trade`
  - "swap SUI to USDC"
  - "open orderbook for SUI/USDC"
  - "find high-volume pools"
- `Predict`
  - "show BTC Predict opportunities"
  - "run trend signal"
  - "open guided Predict trade"
- `Risk`
  - "review my margin risk"
  - "show open positions"
  - "check portfolio"
- `Bot`
  - "inspect hedging bot"
  - "run bot mission"
  - "show bot cycles"
- `Rewards`
  - "show quests"
  - "continue streak"
  - "show leaderboard"

## Mission and Task Model

Example missions:

- `First DeepBook Trade`
  - connect wallet
  - open swap
  - preview output
  - sign transaction
  - review portfolio
- `Predict With Trend`
  - select BTC oracle
  - compute trend signal
  - compare implied probability
  - preview max loss
  - mint or skip
- `Daily Risk Review`
  - load portfolio
  - inspect margin manager
  - flag risky positions
  - mark review complete
- `Bot Operator`
  - connect hedging monitor
  - inspect cycle status
  - review PnL
  - complete bot check
- `Claim Settlements`
  - scan claimable/settled positions
  - preview batch redeem
  - sign transaction

## Plugin Capability Registry

Treat plugins as capability providers.

```ts
type PluginCapability =
  | 'market-data'
  | 'swap'
  | 'orderbook'
  | 'portfolio'
  | 'predict'
  | 'risk'
  | 'bot'
  | 'quest'
  | 'history'
```

Example mapping:

- `sui-swap`: `swap`, `trade`
- `sui-deepbook-orderbook`: `orderbook`, `market-data`
- `sui-deepbook-portfolio`: `portfolio`, `risk`
- `sui-margin-manager`: `risk`, `margin`
- `sui-deepbook-predict`: `predict`, `portfolio`, `keeper`
- `sui-deepbook-analysis`: `market-analysis`
- `sui-deepbook-hedging-bot`: `bot`
- `sui-hedging-monitor`: `bot`

## Approval and Safety Model

Every transaction task must have:

- human-readable action summary
- required wallet/network
- estimated effect
- risk warning
- max loss when relevant
- final `Approve in Wallet` step

Rules:

- TaskOS can recommend actions.
- TaskOS cannot auto-sign.
- Predict trend signals must be labeled probabilistic.
- Risk review should be recommended before high-risk actions.
- Stale oracle or missing balance blocks execution tasks.

## Types

```ts
type CommanderState = {
  address: string | null
  network: string
  isConnected: boolean
  status: 'needs-wallet' | 'ready' | 'at-risk' | 'action-available' | 'awaiting-signature'
}

type CommanderCommandIntent =
  | 'trade'
  | 'predict'
  | 'risk-review'
  | 'bot-control'
  | 'quest'
  | 'market-analysis'

type MissionStatus = 'recommended' | 'available' | 'active' | 'completed' | 'blocked'

type TaskStatus =
  | 'locked'
  | 'available'
  | 'in-progress'
  | 'needs-review'
  | 'needs-signature'
  | 'completed'
  | 'failed'
```

## Test Plan

- Wallet disconnected: Commander status is `needs-wallet`; wallet missions are blocked.
- Wallet connected: status becomes `ready` and recommended missions appear.
- Command "predict trend": routes to Predict mission and no transaction executes without approval.
- Command "review risk": routes to portfolio/margin plugins and completes without signing.
- Stale Predict oracle: execution task is blocked, analyze/review remains available.
- Claimable settlement: claim mission is recommended and batch redeem requires approval preview.

