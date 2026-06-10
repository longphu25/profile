# DeepBook Documentation

All documentation for DeepBook v3 integrations in this project.

---

## Contents

| File | Description |
|------|-------------|
| [SESSION-CONTEXT.md](SESSION-CONTEXT.md) | **Start here** — Kiro session context, project layout, known issues, refactoring status |
| [error-log.md](error-log.md) | **15 lỗi đã gặp** — nguyên nhân gốc, code fix, pattern tổng kết |
| [plugins.md](plugins.md) | All 9 DeepBook plugins — status, features, data sources |
| [hedging-bot.md](hedging-bot.md) | Hedging bot — architecture, auto-balance, key management, points |
| [margin-trading.md](margin-trading.md) | Margin Manager — borrow, leverage, repay, points strategy (ported từ depbuk-hedging) |
| [api-reference.md](api-reference.md) | DeepBook Indexer REST API + SDK + Sui RPC reference |
| [predict-sdk-yosuku.md](predict-sdk-yosuku.md) | Notes on `@yosuku/deepbook-predict`: SVI pricing, on-chain quote verification, PTB builders, and Predict Club integration plan |
| [predict-club-devinspect-pricing.md](predict-club-devinspect-pricing.md) | Predict Club — observed DeepBook Predict `devInspect` pricing, SVI scaling, and implementation plan |
| [predict-club-payout-preview.vi.md](predict-club-payout-preview.vi.md) | Predict Club — Capped Payout, Win Probability, SVI, and payout preview notes |
| [balance-manager.md](balance-manager.md) | Balance Manager — what it is, SDK API, common errors, token recycling |
| [crash-suize-deepbook-predict-analysis.md](crash-suize-deepbook-predict-analysis.md) | **Competitive analysis** — crash.suize.io crash game on DeepBook Predict, opportunities for Predict Club |
| [trading-strategies.md](trading-strategies.md) | Strategy comparison, lessons learned, cost analysis, pool selection |
| [btc/](btc/README.md) | **BTC Chart Pro** — standalone trading dashboard, alerts, snapshot, VP heatmap |

---

## Plugin Overview

| # | Plugin | Type | Status |
|---|--------|------|--------|
| 1 | `sui-pool-explorer` | Read-only | ✅ Done |
| 2 | `sui-price-feed` | Read-only | ✅ Done |
| 3 | `sui-deepbook-portfolio` | Read-only | ✅ Done |
| 4 | `sui-deepbook-history` | Read-only | ✅ Done |
| 5 | `sui-swap` | On-chain tx | ✅ Done |
| 6 | `sui-deepbook-orderbook` | Read-only | ✅ Done |
| 7 | `sui-hedging-monitor` | REST/SSE | ✅ Done |
| 8 | `sui-margin-manager` | Read-only | ✅ Done |
| 9 | `sui-deepbook-hedging-bot` | On-chain tx | ✅ Done |

---

## Quick Links

- DeepBook Indexer: `https://deepbook-indexer.mainnet.mystenlabs.com`
- SDK: `@mysten/deepbook-v3` ([npm](https://www.npmjs.com/package/@mysten/deepbook-v3))
- Sui SDK: `@mysten/sui` v2
- Explorer: `https://suiscan.xyz`
