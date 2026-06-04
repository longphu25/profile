---
tags: [navi, defi, mcp, lending, volo, advisor]
aliases: [NAVI Technical, NAVI Dashboard]
---

# NAVI Protocol Dashboard — Tài Liệu Kỹ Thuật

Plugin dashboard DeFi cho NAVI Protocol trên Sui, chạy trên NAVI MCP
(Model Context Protocol).

## MCP Endpoint

```text
URL:    https://open-api.naviprotocol.io/api/mcp
Auth:   None (public, free)
Mode:   Read-only — không ký, không thực thi giao dịch
Proto:  JSON-RPC 2.0 over Streamable HTTP
```

Plugin gọi MCP server trực tiếp từ browser, không cần backend hay proxy. Dữ liệu
trả về luôn nằm trong `content[0].text` dưới dạng chuỗi JSON, nên phải parse
hai lần.

## Tool Đang Dùng

Plugin dùng các tool chính cho:
- protocol stats
- pool list
- health factor
- coin balances
- available rewards
- swap quote
- transaction explanation
- token search
- positions
- Volo vault list

## Các Tab Chính

- **Overview**: TVL, borrow, utilization, max APY, users
- **Pools**: danh sách pool, sort theo TVL / supply APY / borrow APY
- **Portfolio**: coin balances, health factor, rewards
- **Swap Quote**: quote read-only
- **Tx Explain**: giải thích transaction digest

## `sui-navi-advisor`

Advisor nhận budget USD, lấy APY pool và yield của Volo vault, rồi tạo và xếp
hạng các chiến lược.

### 5 loại chiến lược

1. Best Supply
2. Best Volo Vault
3. Supply + Borrow Loop
4. Stable Vault
5. Diversified Top 3

Kết quả được xếp theo APY, có risk level, step-by-step actions và ước tính lợi
nhuận năm.

### Execute buttons

- `deposit`
- `volo-stake`
- `supply-borrow`
- `link`

## Vì Sao Không Dùng `@naviprotocol/lending`

SDK mới không tương thích trực tiếp với `@mysten/sui` v2 trong repo này, nên
plugin build raw `moveCall` trực tiếp bằng các địa chỉ lấy từ navi-sdk source.

## Ghi Chú

- MCP có thể rate-limit query theo address.
- `volo_get_vaults` trả CSV, không phải JSON.
- `getPositions` trả dữ liệu nhiều protocol, không chỉ NAVI.
- `healthFactor` có thể là `null` nếu ví chưa có lending position.
