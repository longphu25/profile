# NAVI Chatbot & Analysis — Tài Liệu Kỹ Thuật

## `sui-navi-chatbot`

Chat-based DeFi advisor. Người dùng có thể hỏi bằng tiếng Việt hoặc tiếng Anh,
bot sẽ gọi MCP tool rồi mới trả lời.

### Intent Detection

Plugin ánh xạ các nhóm từ khóa như:
- `wallet`, `balance`
- `yield`, `apy`
- `health`, `liquidation`
- `reward`
- `swap`
- `pool`
- `bridge`
- `position`

vào các MCP tool tương ứng.

### Token Resolution Bug Fix

`navi_get_coins` không trả đủ symbol, decimals hay price, nên plugin phải:
1. fetch `navi_get_pools`
2. normalize coin type
3. tra decimals từ bảng known values
4. fallback sang `navi_search_tokens` nếu pool map thiếu token

### Copyable Addresses

- địa chỉ ví trong header có thể click để copy
- địa chỉ `0x...` trong chat được tự nhận diện và copy được

## `sui-navi-analysis`

Real-time pool analysis engine, auto-refresh mỗi 15 giây, ưu tiên dùng WASM nếu
có.

### 4 Tabs

- Best Yields
- Pools
- Changes
- My Wallet

### Scallop Cross-Protocol

Plugin còn lấy dữ liệu pool từ Scallop để đưa vào ranking cơ hội yield.

### WASM vs TS

Footer hiển thị:
- trạng thái WASM
- fallback sang TS nếu cần
- thời gian compute mỗi chu kỳ refresh

## Cập Nhật Cho Advisor

### Swap Options

Khi chiến lược nhắm tới token mà ví chưa có, plugin:
1. kiểm tra usdValue khả dụng
2. hiển thị token nguồn có thể dùng
3. fetch quote song song
4. hiển thị amount dễ đọc
5. redirect sang NAVI app swap page khi người dùng chọn

### Double `0x` Bug Fix

`NAVI_POOL_CFG` đã có tiền tố `0x`, nên không được ghép thêm `0x` lần nữa.
Lỗi này đã được sửa ở tất cả các điểm liên quan.
