# Tài Liệu DeepBook

Toàn bộ tài liệu cho các tích hợp DeepBook v3 trong dự án này.

---

## Nội Dung

| File | Mô tả |
|------|-------------|
| [SESSION-CONTEXT.md](SESSION-CONTEXT.md) | **Bắt đầu từ đây** — ngữ cảnh phiên Kiro, bố cục dự án, vấn đề đã biết, trạng thái refactor |
| [error-log.md](error-log.md) | **15 lỗi đã gặp** — nguyên nhân gốc, cách sửa trong code, các pattern rút ra |
| [plugins.md](plugins.md) | Toàn bộ 9 plugin DeepBook — trạng thái, tính năng, nguồn dữ liệu |
| [hedging-bot.md](hedging-bot.md) | Hedging bot — kiến trúc, auto-balance, quản lý khóa, points |
| [margin-trading.md](margin-trading.md) | Margin Manager — vay, leverage, repay, chiến lược points (port từ depbuk-hedging) |
| [api-reference.md](api-reference.md) | Tham chiếu DeepBook Indexer REST API + SDK + Sui RPC |
| [predict-club-devinspect-pricing.vi.md](predict-club-devinspect-pricing.vi.md) | Predict Club — pricing `devInspect` quan sát được, scale SVI và kế hoạch triển khai |
| [predict-club-payout-preview.vi.md](predict-club-payout-preview.vi.md) | Predict Club — ghi chú Capped Payout, Win Probability, SVI và payout preview |
| [balance-manager.md](balance-manager.md) | Balance Manager — khái niệm, SDK API, lỗi thường gặp, token recycling |
| [trading-strategies.md](trading-strategies.md) | So sánh chiến lược, bài học kinh nghiệm, phân tích chi phí, chọn pool |
| [btc/](btc/README.md) | **BTC Chart Pro** — dashboard giao dịch độc lập, alerts, snapshot, VP heatmap |

---

## Tổng Quan Plugin

| # | Plugin | Loại | Trạng thái |
|---|--------|------|--------|
| 1 | `sui-pool-explorer` | Chỉ đọc | ✅ Done |
| 2 | `sui-price-feed` | Chỉ đọc | ✅ Done |
| 3 | `sui-deepbook-portfolio` | Chỉ đọc | ✅ Done |
| 4 | `sui-deepbook-history` | Chỉ đọc | ✅ Done |
| 5 | `sui-swap` | Giao dịch on-chain | ✅ Done |
| 6 | `sui-deepbook-orderbook` | Chỉ đọc | ✅ Done |
| 7 | `sui-hedging-monitor` | REST/SSE | ✅ Done |
| 8 | `sui-margin-manager` | Chỉ đọc | ✅ Done |
| 9 | `sui-deepbook-hedging-bot` | Giao dịch on-chain | ✅ Done |

---

## Liên Kết Nhanh

- DeepBook Indexer: `https://deepbook-indexer.mainnet.mystenlabs.com`
- SDK: `@mysten/deepbook-v3` ([npm](https://www.npmjs.com/package/@mysten/deepbook-v3))
- Sui SDK: `@mysten/sui` v2
- Explorer: `https://suiscan.xyz`
