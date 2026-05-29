# Seal Policy Contracts — Move Reference

> 4 access policy modules cho Seal threshold encryption. Deploy on-chain, dùng Package ID + Policy Object ID trong plugin.
>
> Source: `contracts/seal-policy/sources/`

---

## Tổng quan

Seal encrypt cần 2 tham số:
- **Package ID** — address của deployed Move package
- **Identity ID** — xác định ai được decrypt (format tùy policy)

Khi decrypt, Seal key server dry-run `seal_approve()` — nếu không abort → cấp decryption key.

```
Encrypt: SealClient.encrypt({ packageId, id: identityId, data })
Decrypt: Key server dry-run → package::module::seal_approve(id, ...) → pass/abort
```

---

## 4 Policy Modules

### 1. `allowlist` — Group Access

```move
module seal_policy::allowlist;

// Objects
struct Allowlist has key { id, admin, name, members: vector<address> }
struct AdminCap has key, store { id, allowlist_id }

// Admin
fun create(name, ctx)                          → Allowlist (shared) + AdminCap
fun add_member(allowlist, cap, member)         → thêm member
fun add_members(allowlist, cap, members)       → batch thêm
fun remove_member(allowlist, cap, member)      → xóa member

// Seal
entry fun seal_approve(id, allowlist, ctx)     → abort nếu sender không trong list
// id format: allowlist_object_id_bytes (32) ++ optional_nonce
```

**Plugin usage:**
```typescript
// Encrypt
sealClient.encrypt({
  packageId: '0x...',
  id: allowlistObjectId,        // hoặc allowlistObjectId + nonce
  data: fileBytes,
})

// Decrypt — key server calls:
// seal_policy::allowlist::seal_approve(id, &allowlist, ctx)
```

### 2. `timelock` — Time-Lock

```move
module seal_policy::timelock;

entry fun seal_approve(id, clock)
// id format: bcs::to_bytes(&unlock_timestamp_ms)  (8 bytes LE)
// Abort nếu Clock.timestamp_ms() < unlock_time
```

**Plugin usage:**
```typescript
import { bcs } from '@mysten/sui/bcs'
const unlockTime = Date.now() + 3600_000 // 1 hour from now
const id = bcs.u64().serialize(unlockTime).toBytes()
sealClient.encrypt({ packageId, id: Buffer.from(id).toString('hex'), data })
```

### 3. `private` — Owner Only

```move
module seal_policy::private;

entry fun seal_approve(id, ctx)
// id format: bcs::to_bytes(&owner_address)  (32 bytes)
// Abort nếu sender != address trong id
```

**Plugin usage:**
```typescript
import { bcs } from '@mysten/sui/bcs'
const id = bcs.Address.serialize(walletAddress).toBytes()
sealClient.encrypt({ packageId, id: Buffer.from(id).toString('hex'), data })
```

### 4. `token_gate` — Token/NFT Holders

```move
module seal_policy::token_gate;

struct Gate<phantom T> has key { id, admin, name, min_balance }

fun create<T>(name, min_balance, ctx)          → Gate<T> (shared)
fun set_min_balance<T>(gate, new_min, ctx)     → update (admin only)

entry fun seal_approve<T>(id, gate, coin)
// id format: gate_object_id_bytes (32) ++ optional_nonce
// Abort nếu coin.value() < min_balance
```

**Plugin usage:**
```typescript
// Create gate for NAVX token, min 100 NAVX
// sui client call --function create --type-args 0xa99b...::navx::NAVX --args "NAVX Holders" 100000000000

sealClient.encrypt({ packageId, id: gateObjectId, data })
// Decrypt: user must pass a Coin<NAVX> with >= 100 NAVX in the seal_approve PTB
```

---

## Deploy

```bash
cd contracts/seal-policy
sui move build
sui client publish --gas-budget 100000000

# Output: Package ID = 0x...
# Save this for plugin config
```

### Testnet (đã deploy sẵn)

Bootcamp demo package: `0x2b5472a9002d97045c8448cda76284aa0de81df3ab902fdfc785feaa2c0b4cc0`

Modules: `private_seal`, `timelock_seal`, `allowlist_seal` (tên hơi khác nhưng cùng pattern).

---

## Identity Format Summary

| Policy | `id` format | Bytes | Ví dụ |
|--------|-------------|-------|-------|
| allowlist | `allowlist_obj_id ++ nonce` | 32+ | `0xabc...def` + `0001` |
| timelock | `bcs(u64 timestamp_ms)` | 8 | `bcs(1713456000000)` |
| private | `bcs(address)` | 32 | `bcs(0xde03f5...)` |
| token_gate | `gate_obj_id ++ nonce` | 32+ | `0x789...012` + `0001` |

**Nonce:** Cho phép encrypt nhiều blob với cùng policy. Mỗi blob có identity khác nhau (obj_id + unique nonce) nhưng cùng access rule.

---

## Security

- `seal_approve` chạy qua **dry-run** bởi key server — không tốn gas, không thay đổi state
- Key server chỉ trả decryption key nếu dry-run **không abort**
- Admin actions (add/remove member, set_min_balance) là on-chain transactions — có gas cost
- `AdminCap` là owned object — chỉ admin giữ, không share
- `Allowlist` và `Gate<T>` là shared objects — ai cũng đọc được, nhưng chỉ `seal_approve` logic quyết định access
