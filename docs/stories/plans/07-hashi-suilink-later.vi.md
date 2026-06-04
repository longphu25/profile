# Kế Hoạch Hashi + SuiLink Ở Giai Đoạn Sau

## Tóm Tắt

Đây là kế hoạch giai đoạn sau để thêm onboarding BTC-on-Sui và identity
readiness bằng cách kết hợp:

- plugin `sui-link` hiện có
- plugin `sui-hashi` dự kiến
- module `sui-btc-credit-console` dự kiến

Ràng buộc mạng quan trọng: Hashi hiện ở Sui devnet, còn `sui-link` hiện dùng
package ID cho mainnet/testnet. V1 phải nói rõ sự mismatch này, không giả vờ là
một luồng testnet liền mạch.

## Các Module Dự Kiến

### 1. `sui-hashi`

Mục đích: hướng dẫn người dùng từ bước chuẩn bị BTC testnet/devnet tới trạng thái
hBTC sẵn sàng trên Sui.

Luồng:
1. chuẩn bị Sui wallet
2. chuẩn bị BTC testnet wallet
3. mở Hashi devnet
4. theo dõi deposit
5. xác minh hBTC
6. giải thích luồng withdraw

### 2. Mở Rộng `sui-link`

Các cải tiến cần có:
- Identity Readiness panel
- action như `Open SuiLink`, `Refresh Links`, `Copy linked address`
- shared data output `suilinkProfile`
- giải thích sự khác biệt network giữa SuiLink và Hashi

### 3. `sui-btc-credit-console`

Màn hình tổng hợp:
- trạng thái ví
- SuiLink identity
- Hashi hBTC state
- risk/credit readiness
- next action

## Tích Hợp Với DeepBook Suite / TaskOS

Trong `deepbook.html`, thêm group `BTC Credit` với:
- Hashi Onboarding
- SuiLink Identity
- BTC Credit Console

Ví dụ mission:
- Link Cross-Chain Identity
- Bring BTC to Sui
- Prepare BTC Collateral

## Types

Các type chính:
- `HashiStep`
- `HashiDepositStatus`
- `SuiLinkReadiness`
- `BtcCreditReadiness`
- `SuiLinkProfile`
- `HashiDepositDraft`

## Shared Data Keys

- `suilinkProfile`
- `hashiDepositDraft`
- `btcCreditReadiness`

## Test Plan

- ví chưa kết nối
- SuiLink trên testnet
- Hashi flow trên devnet
- xác minh hBTC
- network mismatch
- tích hợp với DeepBook Suite
- regression

## Giả Định

- Hashi devnet là target đầu tiên
- chưa giả định có API deposit/claim trực tiếp của Hashi
- SuiLink là identity layer, Hashi là BTC collateral layer
