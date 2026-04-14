# DeepBook Documentation

All documentation for DeepBook v3 integrations in this project.

---

## Contents

| File | Description |
|------|-------------|
| [plugins.md](plugins.md) | All 9 DeepBook plugins — status, features, data sources |
| [hedging-bot.md](hedging-bot.md) | Hedging bot — architecture, auto-balance, key management, points |
| [api-reference.md](api-reference.md) | DeepBook Indexer REST API + SDK + Sui RPC reference |

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
