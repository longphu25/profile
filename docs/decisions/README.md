# Decisions

Use this folder for durable decisions and tradeoffs.

Create a decision record when a change meaningfully alters architecture,
authorization, wallet/signing boundaries, provider behavior, validation
requirements, or user-visible product contracts.

Use `../templates/decision.md` for new records.

## Records

| File | Decision |
| --- | --- |
| [predict-club-architecture.md](predict-club-architecture.md) | Predict Club starts as hybrid non-custodial coordination and defers pooled DUSDC custody to a future policy-guarded group vault. |
| [predict-club-funding-escrow.md](predict-club-funding-escrow.md) | Predict Club uses P2P escrow exchange for USDC to DUSDC funding instead of treating USDC as a Predict quote asset. |
| [btc-chart-exchange-backend.md](btc-chart-exchange-backend.md) | Phase 1: Cloudflare Worker for OKX/MEXC CORS on static Pages; Phase 2: Convex or D1 aggregator for multi-venue OI. |
