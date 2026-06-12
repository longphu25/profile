# Sui Dashboard — Knowledge Base

> Project memory vault. Open this folder as an Obsidian vault.

## Harness

- [[README]] — Documentation map and folder roles
- [[ORGANIZATION]] — Folder placement rules, language policy, and QMD indexing policy
- [[ROOT_DOC_AUDIT]] — Root-level documentation classification and candidate moves
- [[REFERENCE]] — External references and repo reference docs
- [[SETUP]] — Harness, RTK, QMD, and MCP setup notes
- [[HARNESS]] — Human-agent collaboration model for this repo
- [[HARNESS_FACTORY]] — Repo-native port of `revfactory/harness` skill logic
- [[FEATURE_INTAKE]] — Tiny / normal / high-risk classification before work
- [[CONTEXT_RULES]] — What to read per task phase and risk lane (context engineering)
- [[ARCHITECTURE]] — Architecture boundaries and source docs
- [[TEST_MATRIX]] — Validation expectations by work type
- [[HARNESS_BACKLOG]] — Missing harness improvements
- [[QMD]] — Local docs search setup without local LLM models
- [[TERMINOLOGY.vi]] — Vietnamese terminology policy for `*.vi.md` translations
- [[product/README]] — Product contract map
- [[product/predict-club]] — Predict Club product contract and round lifecycle
- [[product/predict-club-architecture]] — Predict Club diagrams, runtime boundaries, and planned file structure
- [[product/predict-club-escrow-contract]] — Time-locked escrow and generic USDC/DUSDC exchange contract plan
- [[product/predict-club-funding]] — Funding Router, Scallop borrow risk, bridge handoff, and DUSDC escrow
- [[product/predict-club-ui-motion]] — Predict Club product motion rules using Transitions.dev patterns
- [[product/predict-club-ui-requirements]] — Predict Club cockpit UI contract, panel responsibilities, wallet/address UX, errors, and validation
- [[stories/README]] — Story packet and plan folder
- [[stories/STATUS]] — Uniform status index for all plans
- [[decisions/README]] — Durable decision records
- [[decisions/predict-club-architecture]] — Hybrid custody and future vault decision
- [[decisions/predict-club-funding-escrow]] — P2P escrow exchange decision for USDC to DUSDC funding
- [[templates/story]] — Story template
- [[templates/decision]] — Decision template
- [[templates/validation]] — Validation report template
- [[templates/feature-intake]] — Feature intake template
- [[templates/spec]] — Spec template
- [[templates/README]] — Template usage map
- [[demo/README]] — Minimal repository-harness demo flow
- [[demo/feature-intake]] — Demo request classification
- [[demo/product-contract]] — Demo product contract
- [[demo/story]] — Demo story packet
- [[demo/decision]] — Demo decision record
- [[demo/validation]] — Demo validation note

## Project Guide

- [[project-overview]] — Bức tranh tổng thể: mục tiêu repo, các lớp hệ thống, lộ trình đọc
- [[repo-map]] — Bản đồ thư mục: phần nào là production, demo, shared utilities, docs
- [[runtime-entry-points]] — Các entry HTML/TSX, trang nào dùng để làm gì, build ra sao
- [[plugin-catalog]] — Danh mục plugin theo domain: wallet, DeFi, DeepBook, Seal, Walrus
- [[development-workflow]] — Cách chạy, build, thêm plugin mới, và các lưu ý release/docs
- [[development-workflow-dev-tooling]] — React Scan (render perf) + React Grab (element→source) dev tools

## Documentation Organization

- Keep English source docs as `*.md`.
- Keep Vietnamese translations as `*.vi.md` beside the source document.
- Use root-level docs for repo-wide maps and shared plugin/runtime architecture.
- Use domain folders for deep technical notes.
- Run `qmd update` after adding, translating, moving, or deleting docs.

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
- [[contracts/Time-Locked_Escrow]] — Reference implementation: time-locked escrow with epoch-based release (teaching example)

### Predict Club Contract (`contracts/predict-club/`)
- `escrow.move` — Generic `Escrow<T>` for any coin type, time-lock + optional approval, composable release/cancel
- `exchange_market.move` — P2P `EscrowOffer<OfferT, WantT>` market, create/fill/cancel with expiry and recipient restriction
- `docs/ARCHITECTURE.md` — Object diagrams, state machine, sequence diagrams, API reference, security notes
- TypeScript bindings: `src/generated/predict-club/` (via `@mysten/codegen`)
- **Testnet deployed:** Package `0x269bdb57...a96613`, Market `0xb6f22529...04eb11`
- Constants: `src/constants/predict-club.ts`
- Published.toml: `contracts/predict-club/Published.toml`

### Predict Club Frontend Integration (v0.43.0)
- [[stories/plans/14-predict-club-contract-integration]] — Master integration plan (P0-P3 ✅, P4-P5 remaining)
- [[stories/plans/15-swap-scallop-integration]] — Swap + Scallop assessment and implementation status
- [[stories/plans/17-scallop-plugin-extraction]] — Extract Scallop into standalone plugin, mount via Host Component Registry
- **Gateways:** `escrowGateway`, `fundingGateway`, `scallopGateway`, `suiPredictGateway`, `escrowQueryService`
- **Use Cases:** `escrowOnChain`, `swapSuiToUsdc`, `borrowUsdc`, `claimWinnings`, `executeTradeplan`
- **Domain:** `canBorrowSafely` policy, `MIN_HEALTH_FACTOR = 1.5`

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

## DeFi — Swap, WASM & RPC

- [[defi/swap-router-optimization]] — Multi-DEX swap aggregator design (DeepBook, Cetus, Turbos, 7k, Bluefin)
- [[defi/wasm-candidates]] — Plugin functions eligible for Rust/WASM acceleration
- [[defi/rpc-cors-and-wallet]] — Browser RPC, CORS proxy, WebSocket gating, and wallet connect
- [[defi/self-host-fonts]] — Self-hosting the Satoshi font (replaces fontshare CDN)

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
- [[deepbook/predict-club-data-contract]] — Predict Club oracle, SVI, quote, portfolio, vault, cache, and rate-limit data contract
- [[deepbook/predict-club-devinspect-pricing]] — Predict Club contract quote and `devInspect` pricing notes
- [[deepbook/trading-strategies]] — Strategy types
- [[deepbook/error-log]] — Error tracking
- [[deepbook/SESSION-CONTEXT]] — Session context notes
- [[deepbook-plugins]] — Plugin list (root level)

## Story Plans

- [[stories/plans/README]] — DeepBook Predict / TaskOS planning index
- [[stories/plans/01-deepbook-predict-hackathon]] — DeepBook Predict Command Center hackathon plan
- [[stories/plans/02-deepbook-predict-ux]] — First-time Predict UX simplification
- [[stories/plans/03-deepbook-app-suite-trend-predict]] — Multi-app DeepBook suite and Trend Predict
- [[stories/plans/04-deepbook-static-plugin-split]] — Static page and plugin split strategy
- [[stories/plans/05-commander-taskos]] — Commander / TaskOS mission model
- [[stories/plans/06-work-breakdown]] — Work breakdown and priority order
- [[stories/plans/07-hashi-suilink-later]] — Later-stage Hashi + SuiLink onboarding
- [[stories/plans/08-deepbook-predict-user-assist]] — Predict Assistant and guided trade plan
- [[stories/plans/09-predict-manager-bot-architecture]] — Non-custodial PredictManager bot architecture
- [[stories/plans/10-interactive-predict-position-chart]] — Interactive Predict position chart
- [[stories/plans/11-deepbook-suite-modular-refactor]] — DeepBook Suite modular refactor
- [[stories/plans/12-deepbook-predict-standalone-chart-trading]] — Standalone `deepbook-predict.html` plan with chart-click DUSDC trade popup and wallet-scoped position overlays
- [[stories/plans/13-predict-club-community]] — Predict Club community workflow, clean architecture, plugin plan, and future group vault boundary
- [[stories/plans/14-predict-club-contract-integration]] — TODOs for deploying predict-club contracts, wiring codegen bindings, and completing escrow + exchange flow
- [[stories/plans/15-swap-scallop-integration]] — Assessment of DeepBook swap and Scallop borrow integration for Predict Club funding routes
- [[stories/plans/16-predict-club-wallet-profile-popup]] — Wallet profile popup implementation and Fast Refresh guardrail
- [[stories/plans/17-scallop-plugin-extraction]] — Scallop plugin extraction and Host Component Registry plan
- [[stories/plans/18-predict-club-quick-predict]] — Quick Predict entry flow
- [[stories/plans/19-predict-club-ui-roadmap]] — Predict Club UI implementation roadmap by phase

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
- **Move contracts:** 4 modules in `contracts/seal-policy/` + 2 modules in `contracts/predict-club/`
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
