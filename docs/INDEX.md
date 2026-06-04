# Sui Dashboard — Knowledge Base

> Project memory vault. Open this folder as an Obsidian vault.

## Harness

- [[README]] — Documentation map and folder roles
- [[REFERENCE]] — External references and repo reference docs
- [[SETUP]] — Harness, RTK, QMD, and MCP setup notes
- [[HARNESS]] — Human-agent collaboration model for this repo
- [[FEATURE_INTAKE]] — Tiny / normal / high-risk classification before work
- [[ARCHITECTURE]] — Architecture boundaries and source docs
- [[TEST_MATRIX]] — Validation expectations by work type
- [[HARNESS_BACKLOG]] — Missing harness improvements
- [[QMD]] — Local docs search setup without local LLM models
- [[product/README]] — Product contract map
- [[product/predict-club]] — Predict Club product contract and round lifecycle
- [[product/predict-club-architecture]] — Predict Club diagrams, runtime boundaries, and planned file structure
- [[product/predict-club-escrow-contract]] — Time-locked escrow and generic USDC/DUSDC exchange contract plan
- [[product/predict-club-funding]] — Funding Router, Scallop borrow risk, bridge handoff, and DUSDC escrow
- [[stories/README]] — Story packet and plan folder
- [[decisions/README]] — Durable decision records
- [[decisions/predict-club-architecture]] — Hybrid custody and future vault decision
- [[decisions/predict-club-funding-escrow]] — P2P escrow exchange decision for USDC to DUSDC funding
- [[templates/story]] — Story template
- [[templates/decision]] — Decision template
- [[templates/validation]] — Validation report template

## Project Guide

- [[project-overview]] — Bức tranh tổng thể: mục tiêu repo, các lớp hệ thống, lộ trình đọc
- [[repo-map]] — Bản đồ thư mục: phần nào là production, demo, shared utilities, docs
- [[runtime-entry-points]] — Các entry HTML/TSX, trang nào dùng để làm gì, build ra sao
- [[plugin-catalog]] — Danh mục plugin theo domain: wallet, DeFi, DeepBook, Seal, Walrus
- [[development-workflow]] — Cách chạy, build, thêm plugin mới, và các lưu ý release/docs

## Canvas Boards

- [[project-technical-structure.canvas]] — Sơ đồ kỹ thuật tổng thể
- [[plugin-catalog.canvas]] — Bảng plugin theo domain

## Architecture

- [[plugin-architecture]] — Plugin system design (Shadow DOM, HostAPI)
- [[plugin-architecture-wasm]] — WASM dashboard architecture
- [[plugin-wasm]] — WASM plugin loader (design rationale)
- [[wasm-native]] — Native Rust → WASM: build pipeline, Cargo config, TS loader, troubleshooting
- [[plugin-sui-wallet]] — Wallet plugin design
- [[plugin-ideas]] — Plugin ideas backlog

## Smart Contracts

- [[contracts/SEAL-POLICY]] — **4 Seal policy contracts (Move): allowlist, timelock, private, token_gate**

## Seal Encryption (9 plugins)

- [[seal/PLAN]] — Roadmap & status
- [[seal/TECHNICAL]] — Architecture, API patterns, all plugins
- [[seal/VOTING]] — Voting plugin deep-dive + on-chain decryption PTB

### Plugins
| Plugin | Pattern | Status |
|--------|---------|--------|
| sui-seal-encrypt | Generic encrypt | ✅ |
| sui-seal-decrypt | Generic decrypt | ✅ |
| sui-seal-vault | Secret manager | ✅ |
| sui-seal-walrus | Seal + Walrus (encrypt/decrypt) | ✅ |
| sui-seal-walrus-upload | **Seal encrypt → Walrus upload (streamlined)** | ✅ |
| sui-seal-private | Private Data | ✅ |
| sui-seal-timelock | Time-Lock | ✅ |
| sui-seal-allowlist | Allowlist | ✅ |
| sui-seal-voting | Sealed Voting | ✅ |

## ZK Proofs (2 plugins)

- [[zklogin/TECHNICAL]] — ZK Login: OAuth → prover → wallet, SDK v2 gotchas
- [[zklogin/ZK-MERKLE]] — ZK Merkle Identity: Poseidon BN254, Groth16 public inputs, Move verification

### Plugins
| Plugin | Purpose | WASM | Status |
|--------|---------|------|--------|
| sui-zk-login | OAuth → ZK Proof → Wallet + Send (devnet) | — | ✅ |
| sui-zk-merkle | Poseidon Merkle tree → identity.json blobs | Rust 155KB | ✅ |

## DeFi — NAVI Protocol (4 plugins)

- [[defi/navi/TECHNICAL]] — MCP API, dashboard, advisor, tx execution
- [[defi/navi/MCP-REFERENCE]] — All 37 MCP tools, contract addresses, Move call patterns, gotchas
- [[defi/navi/ADVISOR]] — Strategy engine, 5 strategies, execute flow, Volo CSV parsing
- [[defi/navi/CHATBOT-ANALYSIS]] — Chatbot intent detection, Analysis WASM engine, Scallop cross-protocol
- [[defi/navi/EXPANSION]] — MCP expansion roadmap: 30 unused tools, 6 phases

### Plugins
| Plugin | Purpose | WASM | Status |
|--------|---------|------|--------|
| sui-navi-dashboard | Protocol overview, pools, portfolio, swap, tx explain | — | ✅ |
| sui-navi-advisor | Yield strategy + execute supply/volo + swap options | — | ✅ |
| sui-navi-chatbot | Chat-based DeFi advisor via MCP (wallet-aware) | — | ✅ |
| sui-navi-analysis | Real-time pool stats + Scallop cross-protocol | Rust 128KB | ✅ |

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

## Story Plans

- [[stories/plans/README]] — DeepBook Predict / TaskOS planning index
- [[stories/plans/12-deepbook-predict-standalone-chart-trading]] — Standalone `deepbook-predict.html` plan with chart-click DUSDC trade popup and wallet-scoped position overlays
- [[stories/plans/13-predict-club-community]] — Predict Club community workflow, clean architecture, plugin plan, and future group vault boundary

## Walrus Storage (3 plugins)

- [[walrus/integration]] — Walrus integration guide
- [[walrus/dev-notes]] — Development notes
- [[walrus/bug-log]] — Bug tracking
- [[walrus/viewer-roadmap]] — Viewer plugin roadmap

## Quick Stats

- **Plugin directories:** 39 (38 runnable + sui-seal-shared)
- **Seal plugins:** 9 (8 original + seal-walrus-upload)
- **ZK plugins:** 2 (zkLogin + zkMerkle)
- **NAVI plugins:** 4 (dashboard, advisor, chatbot, analysis)
- **DeepBook plugins:** 10
- **Walrus plugins:** 3
- **Move contracts:** 4 modules in `contracts/seal-policy/`
- **WASM crates:** 2 (navi-analysis 128KB, zk-merkle 155KB)
- **Runtime pages:** 6
- **Tech stack:** React 19 · TypeScript · Vite · Shadow DOM · Sui SDK 2.x · Rust/WASM · Move
- **Key SDKs:** @mysten/sui v2 · @mysten/seal · @mysten/walrus · NAVI MCP · wasm-bindgen · zklogin · light-poseidon · ark-bn254

## Recent Changes (Apr 17-18, 2026)

### New Plugins (7)
| Plugin | Domain | Key Feature |
|--------|--------|-------------|
| `sui-navi-chatbot` | DeFi | Conversational advisor, 9 intents, tiếng Việt/Anh |
| `sui-navi-analysis` | DeFi | Real-time pool ranking, Scallop cross-protocol, Rust WASM |
| `sui-zk-login` | ZK | 4-step zkLogin: Ed25519 → OAuth → ZK Proof → Wallet |
| `sui-zk-merkle` | ZK | Poseidon BN254 Merkle tree, Groth16 identity blobs |
| `sui-seal-walrus-upload` | Seal | Encrypt file → upload encrypted blob to Walrus |

### Move Contracts
- `contracts/seal-policy/` — 4 Seal policy modules:
  - `allowlist` — Admin creates list, add/remove members, `seal_approve` checks membership
  - `timelock` — Decrypt only after timestamp, `seal_approve` checks Clock
  - `private` — Owner-only, `seal_approve` checks `bcs(sender)`
  - `token_gate` — Coin/NFT holders, `seal_approve` checks `Coin<T>` balance

### WASM Pipeline
- Pre-commit hook auto-builds WASM khi Rust source thay đổi
- `pkg/` committed to git → CI không cần Rust toolchain
- 2 Rust crates: `navi-analysis-wasm` (128KB) + `zk-merkle-wasm` (155KB)

### Bug Fixes
- Token resolution: `navi_get_coins` raw → cross-reference pool prices
- CoinType normalization: `0x000...002` → `0x2`
- Double `0x` prefix trong NAVI advisor typeArguments (6 chỗ)
- DeepBook swap PTB removed → NAVI app redirect + quote display

### New Docs (6)
| Doc | Content |
|-----|---------|
| `docs/wasm-native.md` | Rust WASM build pipeline, Cargo config, troubleshooting |
| `docs/zklogin/TECHNICAL.md` | ZK Login 4-step flow, SDK v2 gotchas |
| `docs/zklogin/ZK-MERKLE.md` | Poseidon Merkle, Groth16 format, Move verification |
| `docs/defi/navi/CHATBOT-ANALYSIS.md` | Chatbot intents, Analysis engine, Scallop API |
| `docs/contracts/SEAL-POLICY.md` | Move contract specs, deploy guide, identity formats |

## Tags

#seal #navi #deepbook #walrus #zklogin #zk-merkle #groth16 #poseidon #wasm #move #plugin #architecture #defi #encryption
