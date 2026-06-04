---
tags: [navi, mcp, api-reference, tools]
aliases: [NAVI MCP Reference, MCP Tools]
---

# NAVI MCP — Tham Chiếu Đầy Đủ

## Endpoint

```text
URL:      https://open-api.naviprotocol.io/api/mcp
Protocol: JSON-RPC 2.0 over Streamable HTTP
Auth:     None
Cost:     Free
Mode:     Read-only
```

## Call Pattern

NAVI MCP hỗ trợ:
- `initialize`
- `tools/list`
- `tools/call`

Response thành công luôn để dữ liệu trong `content[0].text` dưới dạng chuỗi
JSON, nên cần parse cẩn thận. Response lỗi có thể chỉ là text thuần.

## Các Nhóm Tool

- Protocol & Market
- Pools
- User Position & Health
- Rewards
- Swap
- Token Search
- Flash Loans
- Price Feeds
- Bridge
- DCA
- Volo Vaults
- Transaction

## Gotchas Quan Trọng

- Nhiều field của pool là string, phải `Number()`.
- `tvl` cần tự tính từ `supply * price`.
- `healthFactor` có thể là `null`.
- Swap params dùng camelCase: `fromCoin`, `toCoin`.
- Swap `amount` là number.
- `volo_get_vaults` trả CSV.
- Error response đôi khi không phải JSON.
- Query theo address có thể bị rate-limit.

## Move Call Patterns

Tài liệu này ghi lại các pattern raw moveCall quan trọng cho:
- deposit
- borrow
- Volo stake
- xử lý non-SUI coin objects

## Nguồn

Địa chỉ contract được lấy từ `navi-sdk/src/address.ts`. SDK mới của NAVI không
tương thích trực tiếp với `@mysten/sui` v2 trong repo này, nên raw moveCall là
con đường thực tế hơn ở đây.
