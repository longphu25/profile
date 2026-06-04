---
tags: [seal, encryption, plan, roadmap]
aliases: [Seal Plan, Seal Roadmap]
---

# Kế Hoạch Plugin Seal

Kế hoạch xây dựng các plugin Seal cho Sui Dashboard, dựa trên:
- Bootcamp K5 `seal-demo`
- tài liệu Seal SDK
- kiến trúc plugin hiện có (`SuiHostAPI` + Shadow DOM)

## Tham Chiếu Move Package

Bootcamp demo đã được deploy trên testnet, kèm key server dạng decentralized,
aggregator-backed.

Ba Move module sẵn có:
- `private_seal`
- `timelock_seal`
- `allowlist_seal`

## Inventory Plugin

### Đã build (8 plugin)

- `sui-seal-encrypt`
- `sui-seal-decrypt`
- `sui-seal-vault`
- `sui-seal-walrus`
- `sui-seal-private`
- `sui-seal-timelock`
- `sui-seal-allowlist`
- `sui-seal-voting`

### Còn phải build (Phase 2)

- `sui-seal-subscription`
- `sui-seal-gated-content`

## Các Plugin Chính

### `sui-seal-private`

Pattern private data: chỉ owner decrypt được.

### `sui-seal-timelock`

Pattern time-lock: chỉ decrypt được sau một timestamp xác định.

### `sui-seal-allowlist`

Pattern allowlist: quản lý quyền truy cập theo nhóm, cần các thao tác on-chain
để tạo allowlist và thêm/xóa member.

### `sui-seal-subscription`

Pattern subscription: cần Move contract mới cho pass có thời hạn.

### `sui-seal-voting`

Pattern secure voting: ballot mã hóa, hỗ trợ tally phía client hoặc on-chain.

### `sui-seal-gated-content`

Pattern allowlist + Walrus: nội dung mã hóa chỉ cho holder hoặc member được quyền giải mã.

## Các Phase Triển Khai

### Phase 1

Dùng package có sẵn từ bootcamp, không cần deploy Move mới.

### Phase 2

Thêm subscription và gated-content, cần contract mới hoặc compose pattern có sẵn.

### Phase 3

Voting nâng cao với on-chain decryption và HMAC-CTR.

## Ghi Chú Kỹ Thuật

Bootcamp demo cache `SessionKey` và tái sử dụng khi chưa hết hạn. Các plugin nên
làm tương tự để giảm số lần người dùng phải ký lại.
