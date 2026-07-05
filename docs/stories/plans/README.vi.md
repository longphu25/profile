# Chỉ Mục Story Plans

Thư mục này tập hợp các tài liệu planning cỡ story cho hướng DeepBook / Predict /
TaskOS. Nó nằm dưới `docs/stories/` vì các file này mô tả các lát cắt công việc
ứng viên, thứ tự roadmap và các gói triển khai.

## Các File

| File | Mục đích |
|---|---|
| [01-deepbook-predict-hackathon.md](01-deepbook-predict-hackathon.md) | Kế hoạch nộp bài cho DeepBook Predict Command Center. |
| [02-deepbook-predict-ux.md](02-deepbook-predict-ux.md) | Kế hoạch UX để giảm thao tác và cải thiện trải nghiệm người dùng lần đầu. |
| [03-deepbook-app-suite-trend-predict.md](03-deepbook-app-suite-trend-predict.md) | Lộ trình multi-app DeepBook với gamification và Trend Predict. |
| [04-deepbook-static-plugin-split.md](04-deepbook-static-plugin-split.md) | Chiến lược đề xuất để tách static HTML page và plugin. |
| [05-commander-taskos.md](05-commander-taskos.md) | Mô hình sản phẩm Commander / TaskOS cho tương tác theo mission. |
| [06-work-breakdown.md](06-work-breakdown.md) | Gói công việc, mức ưu tiên và thứ tự triển khai. |
| [07-hashi-suilink-later.md](07-hashi-suilink-later.md) | Kế hoạch onboarding tín dụng BTC với Hashi + SuiLink ở giai đoạn sau. |
| [08-deepbook-predict-user-assist.md](08-deepbook-predict-user-assist.md) | Lớp hỗ trợ người dùng Predict kết hợp bối cảnh thị trường BTC, guided trade, rủi ro PLP và keeper prompts. |
| [09-predict-manager-bot-architecture.md](09-predict-manager-bot-architecture.md) | Kiến trúc bot non-custodial cho việc theo dõi PredictManager, PTB do người dùng ký, keeper và tự động hóa vault tương lai. |
| [10-interactive-predict-position-chart.md](10-interactive-predict-position-chart.md) | Biểu đồ Predict tương tác để click chọn binary strike, kéo chọn range và overlay vị thế đã mint. |
| [11-deepbook-suite-modular-refactor.md](11-deepbook-suite-modular-refactor.md) | Kế hoạch refactor cho `deepbook.html`, reusable plugin modules, Predict plugin entry mỏng, clean architecture và chart integration. |
| [12-deepbook-predict-standalone-chart-trading.md](12-deepbook-predict-standalone-chart-trading.md) | Kế hoạch `deepbook-predict.html` độc lập với host kiểu BTC chart, wallet wiring, chart trade popup, preview DUSDC và overlay vị thế hiện có. |
| [13-predict-club-community.md](13-predict-club-community.md) | ✅ **HOÀN THÀNH (V1)** — Workflow cộng đồng Predict Club với leader proposal, member tự ký thực thi, clean architecture. 37 commits Jun 3–5. |
| [14-predict-club-contract-integration.md](14-predict-club-contract-integration.md) | Kế hoạch deploy predict-club contracts lên testnet, nối codegen bindings và hoàn thiện luồng escrow + exchange end-to-end. |
| [15-swap-scallop-integration.md](15-swap-scallop-integration.md) | Kế hoạch tích hợp swap và Scallop cho funding routes của Predict Club. |
| [16-predict-club-wallet-profile-popup.vi.md](16-predict-club-wallet-profile-popup.vi.md) | Đã triển khai wallet profile popup cho Predict Club, gồm shared Predict context, fix performance popup và guardrail Fast Refresh. |
| [17-scallop-plugin-extraction.md](17-scallop-plugin-extraction.md) | Tách Scallop borrow thành plugin độc lập `sui-scallop`, mount vào predict-club qua Host Component Registry. |
| [18-predict-club-quick-predict.md](18-predict-club-quick-predict.md) | Luồng Quick Predict để tạo round và thao tác prediction nhanh hơn. |
| [19-predict-club-ui-roadmap.vi.md](19-predict-club-ui-roadmap.vi.md) | Roadmap từng bước để hoàn thiện giao diện Predict Club, data contracts, risk/exposure, wallet UX, portfolio/vaults, funding, lifecycle, tests và docs. |
| [24-telegram-btc-alert.vi.md](24-telegram-btc-alert.vi.md) | Mini App Telegram: alert ML bias và Trade Setup, auto-login, backend Turso/Convex chung (Phase 0 đã ship). |

## Thứ Tự Xây Dựng Được Khuyến Nghị

1. Xây shell DeepBook và mô hình điều hướng.
2. Thêm Mission Control và các hành động được khuyến nghị.
3. Cải thiện UX của Predict với guided trade.
4. Thêm quest game hóa và achievement cục bộ.
5. Thêm Trend Predict signal lab và backtest workflow.
6. Mở rộng sang command routing kiểu Commander TaskOS.
7. Thêm onboarding tín dụng BTC bằng Hashi + SuiLink sau khi DeepBook shell ổn định.
8. Thêm lớp Predict Assistant để hướng dẫn người dùng mới qua các quyết định nạp tiền, giao dịch, theo dõi và claim.
9. Thêm hỗ trợ bot non-custodial cho việc theo dõi PredictManager và keeper flow cho các vị thế đã settled.
10. Thêm khả năng chọn vị thế qua biểu đồ tương tác và overlay vị thế binary/range.
11. Refactor DeepBook Suite và Predict plugin thành các module reusable theo clean architecture trước khi tách rộng hơn thành sub-plugin.
12. Thêm trang DeepBook Predict độc lập với chart-click DUSDC trade popup và overlay vị thế theo ví.
13. Thêm Predict Club như một trang điều phối cộng đồng với leader-confirmed round, indicator consensus và member self-sign execution.
14. Deploy predict-club contracts lên testnet, nối TypeScript bindings vào plugin và hoàn thiện escrow + exchange funding flow end-to-end.
15. Tích hợp swap và Scallop funding routes khi đủ an toàn và vẫn do ví người dùng ký.
16. Duy trì wallet profile popup của Predict Club và giữ split Fast Refresh giữa provider, context core và hook files.
17. Tách Scallop borrow thành plugin độc lập `sui-scallop` và mount lại vào predict-club qua Host Component Registry để tái sử dụng giữa plugin.
18. Giữ Quick Predict đồng bộ với luồng Predict Club chính để shortcut không bỏ qua risk hoặc quote checks.
19. Triển khai roadmap UI Predict Club theo phase: data contract, decision strip, risk/exposure, wallet/address UX, portfolio/vaults, funding, lifecycle và hardening tests/docs.
