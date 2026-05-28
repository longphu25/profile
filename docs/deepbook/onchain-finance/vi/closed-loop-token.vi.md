# Closed-Loop Token (CLT)

## Tổng quan

Closed-Loop Token là chuẩn token cho phép tạo ra token có dòng chảy bị giới hạn bởi chính sách lập trình được. Định nghĩa trong module `sui::token` của Sui framework. Khác với chuẩn `Coin` mở, một `Token` không thể được wrap, lưu dưới dạng dynamic field, hoặc transfer tự do trừ khi có policy cho phép.

## Khi nào nên dùng

- Loyalty point, tiền tệ trong game, gift card
- Bonus token hoặc vesting token có rule redeem
- Stablecoin có quy định tuân thủ
- Bất kỳ token nào mà bên phát hành cần kiểm soát luồng

## CLT vs Coin

| Khía cạnh | `Coin<T>` | `Token<T>` |
|-----------|-----------|------------|
| Abilities | `key + store` | Chỉ `key` |
| Wrap được | Có | Không |
| Lưu dưới dynamic field | Có | Không |
| Transfer tự do | Có | Không (qua policy) |
| Chuyển đổi | N/A | `Token ↔ Coin` qua `to_coin` / `from_coin` |

```move
struct Coin<phantom T> has key, store { id: UID, balance: Balance<T> }
struct Token<phantom T> has key { id: UID, balance: Balance<T> }
```

Việc thiếu ability `store` chính là điều buộc closed-loop. Token không thể rời hệ thống ngoại trừ qua hàm sinh ra `ActionRequest`.

## Public actions (luôn được phép)

Phản chiếu API của `Coin` nhưng tác động lên `Token`:

- `token::keep(token, ctx)` — gửi cho người gửi giao dịch
- `token::join(a, b)` — gộp 2 token
- `token::split(token, amount, ctx)` — tách thành 2
- `token::zero<T>(ctx)` — tạo balance rỗng
- `token::destroy_zero(token)` — huỷ token rỗng

## Protected actions (cần policy duyệt)

Mỗi lệnh trả về một `ActionRequest` phải được giải quyết trước khi giao dịch thành công:

- `token::transfer(token, recipient, ctx)` — transfer tới address
- `token::to_coin(token, ctx)` — chuyển Token → Coin
- `token::from_coin(coin, ctx)` — chuyển Coin → Token
- `token::spend(token, ctx)` — chi tiêu cho service

## Token policy

`TokenPolicy<T>` bật protected actions và gắn các `Rule`. Mỗi action có bộ duyệt riêng:

```move
public struct TokenPolicy<phantom T> has key { id: UID, /* ... */ }

// Issuer tạo policy:
let (policy, cap) = token::new_policy<MY_TOKEN>(treasury, ctx);

// Issuer bật transfer và thêm rule:
token::add_rule_for_action<MY_TOKEN, KycRule>(&mut policy, &cap, "transfer", ctx);
token::allow<MY_TOKEN>(&mut policy, &cap, "transfer", ctx);

// Share policy để user resolve request:
token::share_policy(policy);
```

## Rules

Một `Rule` là witness "đóng dấu" chứng minh action đã thoả check tuỳ chỉnh. Ví dụ:

- KYC rule — caller phải giữ object verified-identity
- Limit rule — số lượng phải dưới giới hạn per-tx
- Whitelist rule — recipient phải nằm trong allowlist
- Time-lock rule — epoch hiện tại phải vượt ngưỡng

```move
// Package rule đóng dấu request:
my_kyc::approve(&kyc_obj, &mut request, ctx);
my_limit::approve(amount, &mut request, ctx);

// Resolve:
token::confirm_request(policy, request, ctx);
```

Nếu rule cần thiết không stamp, `confirm_request` sẽ abort và toàn bộ giao dịch bị rollback (hot potato semantics).

## ActionRequest hot potato

`ActionRequest` chỉ có `key`, không có `drop`, không có `store`. Phải được resolve trước khi tx kết thúc:

1. Tạo bởi protected action (`transfer`, `spend`, ...)
2. Stamp bởi 0+ rule packages
3. Resolve qua `token::confirm_request(policy, request, ctx)` hoặc bằng issuer giữ `TreasuryCap`

Nếu không resolve, Move VM abort transaction.

## Đường resolve

| Đường | Caller | Mô tả |
|-------|--------|-------|
| `confirm_request` | Bất kỳ | Match approvals với policy |
| `confirm_with_treasury_cap` | Issuer | Bypass policy bằng treasury cap |
| Custom resolver | Module-defined | Module tự expose `confirm_request_*` |

## Pattern compliance (luồng điển hình)

```move
// 1. User gọi protected action
let request = token::transfer(&mut my_token, recipient, ctx);

// 2. Contract KYC stamp request
kyc::stamp_transfer(&kyc_obj, &mut request, ctx);

// 3. Contract volume-cap stamp request
volume_cap::stamp_transfer(amount, &mut request, ctx);

// 4. Confirm với policy
token::confirm_request(&policy, request, ctx);
```

Nếu policy yêu cầu `[KycRule, VolumeCapRule]` và request thu thập đúng các stamp đó, tx thành công.

## Đọc state on-chain

```typescript
// Truy vấn balance qua SuiClient chuẩn
const balance = await client.core.getCoins({
  owner: address,
  coinType: '0xPACKAGE::my_token::MY_TOKEN',
})

// TokenPolicy và Rules là shared object thường:
const policy = await client.core.getObject({ id: POLICY_ID, options: { showContent: true } })
```

## Hạn chế

- Không có `store` → token không thể sống bên trong object tuỳ ý (vault, NFT, ...) — chỉ trong account
- Policy do issuer kiểm soát — user không có quyền veto
- Wrap là không thể (theo thiết kế)
- Chuyển sang `Coin` cần policy cho phép rõ ràng

## Liên quan

- [Permissioned Asset Standard](./pas.vi.md) — model đầy đủ dựa trên account, mở rộng concept của CLT
- [Module `sui::token`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/token.md)


---

## Tài liệu tham khảo

### Sui official docs

- [Closed-Loop Token Overview](https://docs.sui.io/onchain-finance/closed-loop-token)
- [Token Policy](https://docs.sui.io/onchain-finance/closed-loop-token/token-policy)
- [Action Request](https://docs.sui.io/onchain-finance/closed-loop-token/action-request)
- [Rules](https://docs.sui.io/onchain-finance/closed-loop-token/rules)
- [Spending](https://docs.sui.io/onchain-finance/closed-loop-token/spending)
- [Currency Standard (open-loop counterpart)](https://docs.sui.io/onchain-finance/fungible-tokens/currency)

### Source

- [`sui::token` module documentation](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/token.md)
- [`sui::token` source](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/token.move)
