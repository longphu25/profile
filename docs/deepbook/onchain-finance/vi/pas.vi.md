# Permissioned Asset Standard (PAS)

> **Chỉ trên Testnet** — PAS chưa live trên Mainnet.

## Tổng quan

PAS thực thi mô hình closed-loop ownership cho asset trên Sui. Thay vì giữ `Coin` hoặc `Balance` trực tiếp, asset của ví được **proxy qua Account** (object shared). Mọi di chuyển đều qua **logic duyệt lập trình được** mà issuer định nghĩa trong `Policy`.

Đây là tổng quát hoá của [Closed-Loop Token](./closed-loop-token.vi.md) — thay vì giới hạn 1 loại token, PAS giới hạn **bất kỳ** asset chảy qua Namespace.

## Khi nào dùng

- Tokenize tài sản thực (RWA) có rule KYC/jurisdiction
- Stablecoin issuer-controlled với clawback
- Chứng khoán cần issuer duyệt mọi transfer
- Hệ sinh thái đóng (game asset, loyalty)
- Asset cần policy issuer được enforce ở protocol layer

## Khái niệm cốt lõi

### Namespace

Object root shared singleton. Deterministic derive address cho mọi Account, Policy, Template. Giữ:

- `Versioning` — block version khẩn cấp
- `UpgradeCap` UID — gate cho admin operations

### Account

Shared object derive từ `(namespace_id, AccountKey(owner_addr))`. Giữ asset của user:

- Permissionless — bất kỳ ai cũng có thể tạo Account cho bất kỳ address
- Wallet-owned (qua `tx.sender()`) hoặc object-owned (qua `UID`)
- Lưu `Balance<C>` qua `balance::send_funds(balance, account_addr)` (Address Balances)
- Lưu `T` tuỳ ý trên Account UID

### Policy

`Policy<T>` định nghĩa bộ duyệt cho mỗi action trên type `T`:

```
Policy<Balance<MY_COIN>>:
  send_funds:     [TransferApproval]
  unlock_funds:   [WithdrawalApproval]
  clawback_funds: [ClawbackApproval]  // chỉ khi clawback_allowed = true
```

Tạo bằng `policy::new_for_currency(&mut namespace, &mut treasury_cap, clawback_allowed)`. Caller phải giữ `TreasuryCap<C>`.

### PolicyCap

Capability quản lý Policy. Derive 1-1 từ Policy UID. Dùng để:

- Set/update bộ approval cho mỗi action
- Xoá approvals (vô hiệu hoá action đó)

### Auth

Bằng chứng quyền sở hữu, sống ngắn hạn trong giao dịch:

```move
// Account wallet-owned
let auth = account::new_auth(ctx);

// Account object-owned
let auth = account::new_auth_as_object(&mut my_object_uid);
```

## Pattern Request (hot potato)

Mọi action thay đổi state đi theo pattern **hot-potato request**:

```
1. Tạo Request   → bộ approvals rỗng
2. Approve (1..N)  → stamp bằng witness type
3. Resolve     → match approvals → execute hoặc abort
```

### Bước 1: Tạo

Account method wrap data thành request:

```move
let request: Request<SendFunds<Balance<MY_COIN>>> = account::send_funds(
  &mut account, &auth, balance, recipient_addr, ctx
);
```

### Bước 2: Approve

Mỗi approval là **bằng chứng cấp type-level** stamp bởi package ngoài:

```move
// Contract KYC của bạn:
public fun approve_transfer(kyc: &KycCert, request: &mut Request<Action<T>>) {
  request.approve(TransferApproval {});
}

// Trong tx:
my_kyc::approve_transfer(&kyc_obj, &mut request);
my_compliance::stamp(&mut request);
```

Approvals match bằng `TypeName` — không thể giả mạo approval từ package khác.

### Bước 3: Resolve

```move
account::confirm_send(&mut request, &policy);
// Verify: request.approvals == policy.required_approvals (match chính xác)
// Nếu lệch → abort
// Nếu match → thực thi action và destroy request
```

Request là hot potato — không `drop`, không `store`. Nếu sống sót qua tx, VM abort.

## Loại Request

| Loại | Mục đích | Khởi tạo bởi |
|------|----------|--------------|
| `Request<SendFunds<T>>` | Transfer giữa Accounts | Account owner |
| `Request<UnlockFunds<T>>` | Rút khỏi hệ thống | Account owner |
| `Request<ClawbackFunds<T>>` | Issuer claw-back | Issuer (PolicyCap holder) |

## Quy tắc match approval

Approvals match bằng so sánh tập chính xác trên `TypeName`:

| Required | Provided | Kết quả |
|----------|----------|---------|
| `{TransferApproval}` | `{TransferApproval}` | ✅ resolve |
| `{TransferApproval}` | `{TransferApproval, ExtraApproval}` | ❌ count lệch |
| `{TransferApproval}` | `{WrongApproval}` | ❌ type lệch |
| `{TransferApproval}` | `{}` | ❌ rỗng |

> Phiên bản hiện tại chỉ hỗ trợ 1 approval witness mỗi action. Multi-approval (nhiều contract độc lập) đang được lên kế hoạch.

## Cấu trúc object

```
Namespace (shared singleton)
├── Account (@0xAlice)             ← derive từ (namespace_id, AccountKey(alice))
├── Account (@0xBob)               ← derive từ (namespace_id, AccountKey(bob))
├── Policy<Balance<MY_COIN>>       ← derive từ (namespace_id, PolicyKey<Balance<MY_COIN>>)
│   └── PolicyCap<Balance<MY_COIN>> ← derive từ (policy_id, PolicyCapKey)
└── Templates                      ← derive từ (namespace_id, TemplateKey)
```

Tất cả address là deterministic — có thể tính off-chain:

```typescript
const accountAddr = namespace.account_address(aliceAddr)
const policyAddr = namespace.policy_address<Balance<MY_COIN>>()
```

## Luồng balance

Balance KHÔNG lưu dưới field của Account. Sử dụng [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances):

```
Deposit (permissionless):
  balance::send_funds(balance, account_obj_address)

Withdrawal (gated):
  Account.withdraw_funds_from_object(amount)
  → chỉ module PAS gọi được
  → chỉ qua Request đã resolve
```

Nghĩa là **bất kỳ ai cũng có thể deposit** vào Account của bất kỳ ai, nhưng chỉ owner Account (có Auth) mới có thể khởi tạo withdrawal.

## Mô hình bảo mật

PAS đảm bảo:

- **Closed loop** — asset không thể rời hệ thống mà không có request đã resolve
- **Type-safe approvals** — match `TypeName` chống giả mạo cross-package
- **Atomic resolution** — hot-potato buộc resolve trong cùng tx
- **Deterministic addressing** — không có hidden state, mọi address là derived

PAS KHÔNG enforce:

- Ai được transfer (contract của bạn quyết qua approval witness)
- Compliance rules (contract của bạn impl trước khi stamp)
- Gate tạo Account (bất kỳ ai cũng tạo được Account bất kỳ)

## Trust boundaries

| Capability | Holder | Quyền lực |
|------------|--------|-----------|
| `PolicyCap<T>` | Policy admin | Đổi yêu cầu approval cho `T` |
| `TreasuryCap<C>` | Currency issuer | Tạo policy (1 lần) |
| `Auth` | Account owner | Khởi `send_funds` / `unlock_funds` |
| (không) | Bất kỳ ai | Tạo Account, deposit, sync versioning |

## TypeScript SDK

```typescript
import { /* PAS exports */ } from '@mysten/pas'

// 1. Lấy account address cho owner
const accountAddr = await pas.getAccountAddress(namespaceId, ownerAddr)

// 2. Build transfer tx (frontend issuer stamp approvals)
const tx = new Transaction()
const request = pas.createSendRequest(tx, { account, balance, recipient })
yourPackage.approve(tx, { request, kycCert })
pas.confirmSend(tx, { request, policy })

await client.signAndExecute({ transaction: tx, signer })
```

## Hạn chế so với CLT

| Tính năng | CLT | PAS |
|-----------|-----|-----|
| Phạm vi asset | 1 loại token | Bất kỳ type qua Namespace |
| Lưu trữ | Sở hữu trực tiếp | Account-mediated |
| Mô hình duyệt | `Rule` per-action | Witness-based trên Request |
| Multi-asset | 1 policy/token | 1 Namespace, nhiều Policies |
| Mạng live | Mainnet | Chỉ Testnet |

## Liên quan

- [Closed-Loop Token](./closed-loop-token.vi.md) — phiên bản single-token
- [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances)
- [GitHub: MystenLabs/pas](https://github.com/MystenLabs/pas)
- [npm: @mysten/pas](https://www.npmjs.com/package/@mysten/pas)


---

## Tài liệu tham khảo

### Sui official docs

- [PAS Overview](https://docs.sui.io/onchain-finance/pas/)
- [Architecture](https://docs.sui.io/onchain-finance/pas/pas-architecture)
- [Workflows / Actions](https://docs.sui.io/onchain-finance/pas/pas-workflows)
- [Integration](https://docs.sui.io/onchain-finance/pas/integrating-pas)
- [Querying Assets](https://docs.sui.io/onchain-finance/pas/querying-assets)
- [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances)

### Source & SDK

- [GitHub: MystenLabs/pas](https://github.com/MystenLabs/pas)
- [npm: @mysten/pas](https://www.npmjs.com/package/@mysten/pas)
