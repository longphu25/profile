# Sui Dashboard — Cơ Sở Tri Thức

> Vault bộ nhớ dự án. Hãy mở thư mục này như một Obsidian vault.

## Harness

- [[README]] — Bản đồ tài liệu và vai trò của từng thư mục
- [[ORGANIZATION]] — Quy tắc đặt tài liệu, chính sách ngôn ngữ và chính sách index QMD
- [[ROOT_DOC_AUDIT]] — Phân loại tài liệu root-level và các ứng viên di chuyển
- [[REFERENCE]] — Tài liệu tham chiếu bên ngoài và tài liệu tham chiếu cấp repo
- [[SETUP]] — Ghi chú thiết lập harness, RTK, QMD và MCP
- [[HARNESS]] — Mô hình cộng tác giữa con người và agent cho repo này
- [[HARNESS_FACTORY]] — Bản port repo-native của logic skill `revfactory/harness`
- [[FEATURE_INTAKE]] — Phân loại tiny / normal / high-risk trước khi làm việc
- [[ARCHITECTURE]] — Boundary kiến trúc và tài liệu nguồn
- [[TEST_MATRIX]] — Kỳ vọng validation theo loại công việc
- [[HARNESS_BACKLOG]] — Những cải tiến harness còn thiếu
- [[QMD]] — Thiết lập tìm kiếm docs cục bộ không dùng model LLM local
- [[TERMINOLOGY.vi]] — Quy ước thuật ngữ tiếng Việt cho các bản dịch `*.vi.md`
- [[product/README]] — Bản đồ product contract
- [[product/predict-club]] — Product contract Predict Club và vòng đời round
- [[product/predict-club-architecture]] — Sơ đồ Predict Club, runtime boundary và cấu trúc file dự kiến
- [[product/predict-club-escrow-contract]] — Kế hoạch contract cho escrow khóa thời gian và trao đổi USDC/DUSDC tổng quát
- [[product/predict-club-funding]] — Funding Router, rủi ro vay Scallop, bridge handoff và DUSDC escrow
- [[product/predict-club-ui-motion]] — Quy tắc motion UI Predict Club dùng pattern Transitions.dev
- [[product/predict-club-ui-requirements]] — UI contract cockpit Predict Club, trách nhiệm panel, wallet/address UX, lỗi và validation
- [[stories/README]] — Thư mục story packet và plan
- [[decisions/README]] — Hồ sơ quyết định bền vững
- [[decisions/predict-club-architecture]] — Quyết định custody lai và boundary group vault ở V2
- [[decisions/predict-club-funding-escrow]] — Quyết định escrow P2P để nạp vốn USDC sang DUSDC
- [[templates/story]] — Mẫu story
- [[templates/decision]] — Mẫu decision
- [[templates/validation]] — Mẫu báo cáo validation
- [[templates/feature-intake]] — Mẫu feature intake
- [[templates/spec]] — Mẫu spec
- [[templates/README]] — Bản đồ cách dùng template
- [[demo/README]] — Demo flow repository-harness tối thiểu
- [[demo/feature-intake]] — Demo phân loại yêu cầu
- [[demo/product-contract]] — Demo product contract
- [[demo/story]] — Demo story packet
- [[demo/decision]] — Demo decision record
- [[demo/validation]] — Demo validation note

## Hướng Dẫn Dự Án

- [[project-overview]] — Bức tranh tổng thể: mục tiêu repo, các lớp hệ thống, lộ trình đọc
- [[repo-map]] — Bản đồ thư mục: phần nào là production, demo, shared utilities, docs
- [[runtime-entry-points]] — Các entry HTML/TSX, trang nào dùng để làm gì, build ra sao
- [[plugin-catalog]] — Danh mục plugin theo domain: wallet, DeFi, DeepBook, Seal, Walrus
- [[development-workflow]] — Cách chạy, build, thêm plugin mới và các lưu ý release/docs

## Tổ Chức Tài Liệu

- Giữ tài liệu nguồn tiếng Anh ở dạng `*.md`.
- Giữ bản dịch tiếng Việt ở dạng `*.vi.md` cạnh tài liệu nguồn.
- Dùng tài liệu root-level cho bản đồ repo và kiến trúc plugin/runtime dùng chung.
- Dùng thư mục domain cho ghi chú kỹ thuật sâu.
- Chạy `qmd update` sau khi thêm, dịch, di chuyển hoặc xóa tài liệu.

## Bảng Canvas

- [[project-technical-structure.canvas]] — Sơ đồ kỹ thuật tổng thể
- [[plugin-catalog.canvas]] — Bảng plugin theo domain

## Kiến Trúc

- [[plugin-architecture]] — Thiết kế plugin system (Shadow DOM, HostAPI)
- [[plugin-architecture-wasm]] — Kiến trúc dashboard WASM
- [[plugin-wasm]] — Bộ nạp WASM plugin (lý do thiết kế)
- [[wasm-native]] — Native Rust → WASM: build pipeline, cấu hình Cargo, TS loader, troubleshooting
- [[plugin-sui-wallet]] — Thiết kế plugin ví
- [[plugin-ideas]] — Backlog ý tưởng plugin

## Smart Contracts

- [[contracts/SEAL-POLICY]] — **4 Seal policy contracts (Move): allowlist, timelock, private, token_gate**

## Seal Encryption (9 plugin)

- [[seal/PLAN]] — Lộ trình & trạng thái
- [[seal/TECHNICAL]] — Kiến trúc, pattern API, toàn bộ plugin
- [[seal/VOTING]] — Phân tích sâu plugin voting + PTB giải mã on-chain

### Plugins
| Plugin | Pattern | Trạng thái |
|--------|---------|--------|
| sui-seal-encrypt | Mã hóa tổng quát | ✅ |
| sui-seal-decrypt | Giải mã tổng quát | ✅ |
| sui-seal-vault | Quản lý secret | ✅ |
| sui-seal-walrus | Seal + Walrus (mã hóa/giải mã) | ✅ |
| sui-seal-walrus-upload | **Seal mã hóa → tải lên Walrus (tinh gọn)** | ✅ |
| sui-seal-private | Private Data | ✅ |
| sui-seal-timelock | Time-Lock | ✅ |
| sui-seal-allowlist | Allowlist | ✅ |
| sui-seal-voting | Sealed Voting | ✅ |

## ZK Proofs (2 plugin)

- [[zklogin/TECHNICAL]] — ZK Login: OAuth → prover → wallet, các điểm cần lưu ý ở SDK v2
- [[zklogin/ZK-MERKLE]] — ZK Merkle Identity: Poseidon BN254, Groth16 public inputs, Move verification

### Plugins
| Plugin | Mục đích | WASM | Trạng thái |
|--------|---------|------|--------|
| sui-zk-login | OAuth → ZK Proof → Wallet + Send (devnet) | — | ✅ |
| sui-zk-merkle | Poseidon Merkle tree → blob `identity.json` | Rust 155KB | ✅ |

## DeFi — NAVI Protocol (4 plugin)

- [[defi/navi/TECHNICAL]] — MCP API, dashboard, advisor, thực thi giao dịch
- [[defi/navi/MCP-REFERENCE]] — Toàn bộ 37 công cụ MCP, địa chỉ contract, pattern gọi Move, các lưu ý
- [[defi/navi/ADVISOR]] — Strategy engine, 5 chiến lược, execute flow, phân tích CSV Volo
- [[defi/navi/CHATBOT-ANALYSIS]] — Phát hiện ý định chatbot, Analysis WASM engine, Scallop cross-protocol
- [[defi/navi/EXPANSION]] — Lộ trình mở rộng MCP: 30 công cụ chưa dùng, 6 giai đoạn

### Plugins
| Plugin | Mục đích | WASM | Trạng thái |
|--------|---------|------|--------|
| sui-navi-dashboard | Tổng quan protocol, pool, portfolio, swap, giải thích giao dịch | — | ✅ |
| sui-navi-advisor | Chiến lược yield + thực thi supply/volo + các lựa chọn swap | — | ✅ |
| sui-navi-chatbot | Cố vấn DeFi dạng chat qua MCP (nhận biết ví) | — | ✅ |
| sui-navi-analysis | Xếp hạng pool thời gian thực + Scallop cross-protocol | Rust 128KB | ✅ |

## DeepBook Trading (10 plugin)

- [[deepbook/README]] — Tổng quan
- [[deepbook/api-reference]] — DeepBook v3 API
- [[deepbook/plugins]] — Đặc tả plugin
- [[deepbook/hedging-bot]] — Thiết kế hedging bot
- [[deepbook/margin-trading]] — Margin trading
- [[deepbook/balance-manager]] — Balance manager
- [[deepbook/predict-club-data-contract]] — Data contract Predict Club cho oracle, SVI, quote, portfolio, vault, cache và rate-limit
- [[deepbook/predict-club-devinspect-pricing]] — Ghi chú contract quote và pricing `devInspect` của Predict Club
- [[deepbook/trading-strategies]] — Các loại chiến lược
- [[deepbook/error-log]] — Theo dõi lỗi
- [[deepbook/SESSION-CONTEXT]] — Ghi chú ngữ cảnh phiên
- [[deepbook-plugins]] — Danh sách plugin (cấp root)

## Story Plans

- [[stories/plans/README]] — Chỉ mục kế hoạch DeepBook Predict / TaskOS
- [[stories/plans/01-deepbook-predict-hackathon]] — Kế hoạch hackathon DeepBook Predict Command Center
- [[stories/plans/02-deepbook-predict-ux]] — Đơn giản hóa UX Predict cho người dùng lần đầu
- [[stories/plans/03-deepbook-app-suite-trend-predict]] — Bộ ứng dụng DeepBook và Trend Predict
- [[stories/plans/04-deepbook-static-plugin-split]] — Chiến lược tách trang tĩnh và plugin
- [[stories/plans/05-commander-taskos]] — Mô hình mission Commander / TaskOS
- [[stories/plans/06-work-breakdown]] — Phân rã công việc và thứ tự ưu tiên
- [[stories/plans/07-hashi-suilink-later]] — Onboarding Hashi + SuiLink ở giai đoạn sau
- [[stories/plans/08-deepbook-predict-user-assist]] — Predict Assistant và giao dịch có hướng dẫn
- [[stories/plans/09-predict-manager-bot-architecture]] — Kiến trúc bot PredictManager non-custodial
- [[stories/plans/10-interactive-predict-position-chart]] — Biểu đồ vị thế Predict tương tác
- [[stories/plans/11-deepbook-suite-modular-refactor]] — Refactor module cho DeepBook Suite
- [[stories/plans/12-deepbook-predict-standalone-chart-trading]] — Kế hoạch `deepbook-predict.html` độc lập với popup giao dịch DUSDC theo click biểu đồ và overlay vị thế theo ví
- [[stories/plans/13-predict-club-community]] — Quy trình cộng đồng Predict Club, clean architecture, kế hoạch plugin và boundary group vault tương lai
- [[stories/plans/14-predict-club-contract-integration]] — TODO deploy predict-club contracts, nối codegen bindings và hoàn thiện escrow + exchange flow
- [[stories/plans/15-swap-scallop-integration]] — Đánh giá DeepBook swap và Scallop borrow cho funding routes Predict Club
- [[stories/plans/16-predict-club-wallet-profile-popup]] — Triển khai wallet profile popup và guardrail Fast Refresh
- [[stories/plans/17-scallop-plugin-extraction]] — Kế hoạch tách Scallop plugin và Host Component Registry
- [[stories/plans/18-predict-club-quick-predict]] — Luồng Quick Predict
- [[stories/plans/19-predict-club-ui-roadmap]] — Roadmap triển khai UI Predict Club theo phase

## Walrus Storage (3 plugin)

- [[walrus/integration]] — Hướng dẫn tích hợp Walrus
- [[walrus/dev-notes]] — Ghi chú phát triển
- [[walrus/bug-log]] — Theo dõi bug
- [[walrus/viewer-roadmap]] — Lộ trình plugin viewer

## Thống Kê Nhanh

- **Thư mục plugin:** 39 (38 chạy được + sui-seal-shared)
- **Seal plugin:** 9 (8 bản gốc + seal-walrus-upload)
- **ZK plugin:** 2 (zkLogin + zkMerkle)
- **NAVI plugin:** 4 (dashboard, advisor, chatbot, analysis)
- **DeepBook plugin:** 10
- **Walrus plugin:** 3
- **Move contracts:** 4 module trong `contracts/seal-policy/`
- **WASM crate:** 2 (`navi-analysis` 128KB, `zk-merkle` 155KB)
- **Trang runtime:** 6
- **Tech stack:** React 19 · TypeScript · Vite · Shadow DOM · Sui SDK 2.x · Rust/WASM · Move
- **SDK chính:** @mysten/sui v2 · @mysten/seal · @mysten/walrus · NAVI MCP · wasm-bindgen · zklogin · light-poseidon · ark-bn254

## Các Thay Đổi Gần Đây (Apr 17-18, 2026)

### Plugin Mới (7)
| Plugin | Domain | Tính năng chính |
|--------|--------|-------------|
| `sui-navi-chatbot` | DeFi | Cố vấn hội thoại, 9 ý định, tiếng Việt/Anh |
| `sui-navi-analysis` | DeFi | Xếp hạng pool thời gian thực, Scallop cross-protocol, Rust WASM |
| `sui-zk-login` | ZK | zkLogin 4 bước: Ed25519 → OAuth → ZK Proof → Wallet |
| `sui-zk-merkle` | ZK | Poseidon BN254 Merkle tree, Groth16 identity blobs |
| `sui-seal-walrus-upload` | Seal | Mã hóa file → tải blob đã mã hóa lên Walrus |

### Move Contracts
- `contracts/seal-policy/` — 4 module policy của Seal:
  - `allowlist` — Admin tạo danh sách, thêm/xóa member, `seal_approve` kiểm tra membership
  - `timelock` — Chỉ giải mã sau timestamp, `seal_approve` kiểm tra Clock
  - `private` — Chỉ owner, `seal_approve` kiểm tra `bcs(sender)`
  - `token_gate` — Người giữ Coin/NFT, `seal_approve` kiểm tra số dư `Coin<T>`

### WASM Pipeline
- Pre-commit hook tự build WASM khi mã nguồn Rust thay đổi
- `pkg/` được commit vào git → CI không cần Rust toolchain
- 2 Rust crate: `navi-analysis-wasm` (128KB) + `zk-merkle-wasm` (155KB)

### Sửa Lỗi
- Token resolution: `navi_get_coins` raw → đối chiếu chéo với giá pool
- Chuẩn hóa CoinType: `0x000...002` → `0x2`
- Trùng tiền tố `0x` trong `typeArguments` của NAVI advisor (6 chỗ)
- Đã bỏ DeepBook swap PTB → chuyển hướng sang app NAVI + hiển thị quote

### Tài Liệu Mới (6)
| Tài liệu | Nội dung |
|-----|---------|
| `docs/wasm-native.md` | Rust WASM build pipeline, Cargo config, troubleshooting |
| `docs/zklogin/TECHNICAL.md` | ZK Login 4-step flow, SDK v2 gotchas |
| `docs/zklogin/ZK-MERKLE.md` | Poseidon Merkle, Groth16 format, Move verification |
| `docs/defi/navi/CHATBOT-ANALYSIS.md` | Chatbot intents, Analysis engine, Scallop API |
| `docs/contracts/SEAL-POLICY.md` | Move contract specs, deploy guide, identity formats |

## Thẻ

#seal #navi #deepbook #walrus #zklogin #zk-merkle #groth16 #poseidon #wasm #move #plugin #architecture #defi #encryption
