# Sui Dashboard — Knowledge Base

> Project memory vault. Open this folder as an Obsidian vault.

## Architecture

- [[plugin-architecture]] — Plugin system design (Shadow DOM, HostAPI)
- [[plugin-architecture-wasm]] — WASM dashboard architecture
- [[plugin-wasm]] — WASM plugin loader
- [[plugin-sui-wallet]] — Wallet plugin design
- [[plugin-ideas]] — Plugin ideas backlog

## Seal Encryption (8 plugins)

- [[seal/PLAN]] — Roadmap & status (8/10 done)
- [[seal/TECHNICAL]] — Architecture, API patterns, all 8 plugins
- [[seal/VOTING]] — Voting plugin deep-dive + on-chain decryption PTB

### Plugins
| Plugin | Pattern | Status |
|--------|---------|--------|
| sui-seal-encrypt | Generic encrypt | ✅ |
| sui-seal-decrypt | Generic decrypt | ✅ |
| sui-seal-vault | Secret manager | ✅ |
| sui-seal-walrus | Seal + Walrus | ✅ |
| sui-seal-private | Private Data | ✅ |
| sui-seal-timelock | Time-Lock | ✅ |
| sui-seal-allowlist | Allowlist | ✅ |
| sui-seal-voting | Sealed Voting | ✅ |

## DeFi — NAVI Protocol (2 plugins)

- [[defi/navi/TECHNICAL]] — MCP API, dashboard, advisor, tx execution
- [[defi/navi/MCP-REFERENCE]] — All 37 MCP tools, contract addresses, Move call patterns, gotchas
- [[defi/navi/ADVISOR]] — Strategy engine, 5 strategies, execute flow, Volo CSV parsing, non-SUI coin handling

### Plugins
| Plugin | Purpose | Status |
|--------|---------|--------|
| sui-navi-dashboard | Protocol overview, pools, portfolio, swap, tx explain | ✅ |
| sui-navi-advisor | Yield strategy advisor + execute supply/volo stake | ✅ |

## DeepBook Trading (10 plugins)

- [[deepbook/README]] — Overview
- [[deepbook/api-reference]] — DeepBook v3 API
- [[deepbook/plugins]] — Plugin specs
- [[deepbook/hedging-bot]] — Hedging bot design
- [[deepbook/margin-trading]] — Margin trading
- [[deepbook/balance-manager]] — Balance manager
- [[deepbook/trading-strategies]] — Strategy types
- [[deepbook/error-log]] — Error tracking
- [[deepbook/SESSION-CONTEXT]] — Session context notes
- [[deepbook-plugins]] — Plugin list (root level)

## Walrus Storage (3 plugins)

- [[walrus/integration]] — Walrus integration guide
- [[walrus/dev-notes]] — Development notes
- [[walrus/bug-log]] — Bug tracking
- [[walrus/viewer-roadmap]] — Viewer plugin roadmap

## Quick Stats

- **Total plugins:** 23+
- **Seal plugins:** 8
- **NAVI plugins:** 2
- **DeepBook plugins:** 10
- **Walrus plugins:** 3
- **Tech stack:** React + TypeScript + Vite + Shadow DOM
- **Key SDKs:** @mysten/sui v2, @mysten/seal, @mysten/walrus, NAVI MCP

## Tags

#seal #navi #deepbook #walrus #plugin #architecture #defi #encryption
