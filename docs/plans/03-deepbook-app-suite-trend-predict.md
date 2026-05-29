# DeepBook Interactive App Suite and Trend Predict Roadmap

## Summary

Build a more interactive DeepBook ecosystem focused on gamified trading for power users, with a Trend Predict layer for directional DeepBook Predict strategies.

The suite should make DeepBook feel like a repeat-use trading operating system: users can trade, inspect risk, run bots, complete missions, compare performance, and test probabilistic strategy signals.

Important rule: Trend Predict must never be presented as guaranteed winning logic. Trend and momentum signals are probabilistic edge tools that require backtesting, sizing discipline, and live monitoring.

## DeepBook Home Hub

Create a top-level hub that links existing DeepBook apps into one journey:

- `Trade Now`: swap, orderbook, Predict trading.
- `Predict With Trend`: directional Predict workflow using trend/momentum signals.
- `Manage Risk`: portfolio, margin manager, hedging monitor.
- `Run Bots`: hedging bot, keeper-style tasks, automation status.
- `Earn Points`: quests, streaks, volume goals, leaderboard.
- `Analyze Markets`: price feed, pool explorer, history, market analysis.

The hub should show recommended next actions based on wallet state, open positions, trading history, bot activity, and available Predict opportunities.

## Gamified Trading Layer

- Daily quests:
  - Make one DeepBook swap.
  - Review one orderbook.
  - Check portfolio risk.
  - Run or inspect a hedging cycle.
  - Review one Predict trend signal.
  - Claim or settle an eligible position.
- Streaks:
  - Daily login/check-in.
  - Daily trading activity.
  - Daily risk review.
  - Daily Predict signal review.
- Achievements:
  - First swap.
  - First Predict trade.
  - First margin inspection.
  - First bot cycle.
  - First profitable session.
  - First 7-day streak.
- Leaderboards:
  - Volume.
  - Consistency.
  - Bot cycles.
  - Predict signal discipline.
  - Risk-adjusted PnL.

For v1, leaderboards can be local/session-based or derived from available indexer data.

## Trend Predict App

Purpose: help users find higher-quality UP/DOWN Predict entries by matching Predict expiry horizon with BTC trend/momentum signals.

Core rules:

- Use trend-following as a probabilistic signal, not as a guaranteed win predictor.
- Match signal timeframe to expiry:
  - short expiry: 15m/1h candles
  - medium expiry: 1h/4h candles
  - longer expiry: 4h/1d candles
- Regime filter:
  - BTC above SMA50 or SMA100 with positive slope -> only consider `UP`.
  - BTC below SMA50 or SMA100 with negative slope -> only consider `DOWN`.
  - frequent MA crossovers in the recent window -> `NO_TRADE`.
- Momentum filter:
  - ROC positive for UP.
  - ROC negative for DOWN.
  - weak ROC or flat MA slope -> reduce size or no trade.
- Predict mapping:
  - UP signal -> nearest suitable active oracle and moderately OTM UP strike.
  - DOWN signal -> nearest suitable active oracle and moderately OTM DOWN strike.
  - neutral/sideway -> no directional trade; suggest range or PLP+hedge instead.
- Edge check:
  - Compare model probability with Predict implied probability/fair value.
  - Trade only when estimated edge remains positive after fees/slippage assumptions.

UX outputs:

- `Signal`: UP / DOWN / NEUTRAL / NO_TRADE
- `Confidence`: Low / Medium / High
- `Reason`: MA regime, MA slope, ROC, sideway filter
- `Suggested Predict Action`: oracle, expiry, direction, strike, amount range
- `Risk Warning`: max loss, expiry risk, stale oracle warning
- `Backtest Required`: visible reminder before live use

## App Modules

- `DeepBook Mission Control`: wallet summary, positions, active risk, points, recommended actions.
- `Trading Quest Board`: daily and weekly objectives.
- `Trend Predict Lab`: candle import, MA/ROC signal generation, Predict mapping, backtest summary.
- `Smart Trade Launcher`: swap, orderbook, price feed, slippage, portfolio impact.
- `Risk Review Center`: margin risk, collateral health, open orders, hedging state.
- `Bot Arena`: hedging bot sessions, cycle history, runtime status, mission progress.
- `Market Radar`: volume spikes, spread changes, price movement, opportunity tags.
- `Achievement Profile`: streaks, badges, completed missions, milestones, session stats.

## Types

```ts
type DeepBookIntent =
  | 'trade'
  | 'predict-trend'
  | 'analyze'
  | 'manage-risk'
  | 'run-bot'
  | 'earn-points'

type MissionStatus = 'available' | 'in-progress' | 'completed' | 'blocked'
type MissionCategory = 'trade' | 'risk' | 'bot' | 'portfolio' | 'predict' | 'learning'
type TrendSignal = 'up' | 'down' | 'neutral' | 'no-trade'
type SignalConfidence = 'low' | 'medium' | 'high'
```

## Test Plan

- Bullish regime shows UP only when price is above MA and momentum confirms.
- Bearish regime shows DOWN only when price is below MA and momentum confirms.
- Sideway regime shows NO_TRADE and suggests range/PLP+hedge.
- Quest completion updates local mission state.
- Existing DeepBook plugins remain accessible.

