---
tags: [seal, encryption, technical, architecture]
aliases: [Seal Technical, Seal Architecture]
---

# Seal Plugins — Tài Liệu Kỹ Thuật

Tài liệu kỹ thuật cho 8 plugin Seal trong Sui Dashboard.

## Kiến Trúc

Seal plugins chạy trong SuiWasmDashboard, dùng `SuiHostAPI`, được cô lập bằng
Shadow DOM và chia sẻ cấu hình qua `plugins/sui-seal-shared/config.ts`.

## Host API Extensions

Seal plugins cần thêm:
- `signAndExecuteTransaction`
- `signPersonalMessage`

`signPersonalMessage` được thêm để hỗ trợ tạo `SessionKey`. Ví ký personal
message, rồi SDK dùng chữ ký đó để xác thực với key servers.

## Shared Config

`plugins/sui-seal-shared/config.ts` là nguồn cấu hình chung cho tất cả Seal
plugins:
- package ID
- key server configs
- threshold mặc định
- Sui Clock object
- RPC URLs

Server decentralized, aggregator-backed được chọn vì ít round-trip hơn và làm
client đơn giản hơn.

## Các Plugin Chính

### `sui-seal-encrypt`

Mã hóa dữ liệu tùy ý với package ID và identity tùy chỉnh.

### `sui-seal-decrypt`

Giải mã dữ liệu Seal sau khi được ví phê duyệt.

### `sui-seal-vault`

Secret manager lưu dữ liệu mã hóa trong `localStorage`, tách riêng theo từng ví.

### `sui-seal-walrus`

Mã hóa file, tải lên Walrus, rồi tải xuống và giải mã.

### `sui-seal-private`

Pattern private data: chỉ owner giải mã được.

### `sui-seal-timelock`

Pattern time-lock: giải mã sau khi `clock.timestamp_ms()` vượt qua thời điểm mở khóa.

### `sui-seal-allowlist`

Pattern allowlist: cần các thao tác on-chain để tạo allowlist và quản lý member.

### `sui-seal-voting`

Pattern sealed voting: ballot mã hóa, hỗ trợ tally phía client hoặc on-chain.

## Common Patterns

### SealClient Initialization

Mọi plugin thường khởi tạo `SuiGrpcClient` rồi tạo `SealClient`, sau đó cache
trong `useRef`.

### SessionKey Flow

Luồng chung:
1. tạo `SessionKey`
2. lấy personal message
3. ký bằng ví
4. set signature
5. dùng `seal_approve` để giải mã hoặc lấy key

## Ghi Chú Quan Trọng

- `txBytes` cho Seal thường phải build ở chế độ transaction-kind, không phải full transaction
- `SessionKey` nên được cache tới khi hết hạn
- network change phải invalidate các client cache liên quan
