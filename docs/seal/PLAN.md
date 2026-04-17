---
tags: [seal, encryption, plan, roadmap]
aliases: [Seal Plan, Seal Roadmap]
---

# Seal Plugin Plan

Kế hoạch xây dựng các plugin Seal cho Sui Dashboard, dựa trên:
- Bootcamp K5 seal-demo (3 Move patterns: private, timelock, allowlist)
- Seal SDK docs (5 access patterns + on-chain decryption)
- Existing plugin architecture (SuiHostAPI + Shadow DOM)

## Move Package Reference

Bootcamp demo đã deploy trên testnet:
```
PACKAGE_ID = 0x2b5472a9002d97045c8448cda76284aa0de81df3ab902fdfc785feaa2c0b4cc0
```

Key server (decentralized, aggregator-backed):
```
OBJECT_ID = 0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
AGGREGATOR = https://seal-aggregator-testnet.mystenlabs.com
```

3 Move modules có sẵn:
| Module | Pattern | seal_approve params |
|--------|---------|-------------------|
| `private_seal` | Owner-only | `(id, ctx)` — id = BCS(address) |
| `timelock_seal` | Time-lock | `(id, Clock)` — id = BCS(u64 timestamp_ms) |
| `allowlist_seal` | Allowlist | `(id, Allowlist, ctx)` — id = allowlist_obj_id ++ nonce |

---

## Plugin Inventory

### Đã build (8 plugins)

| # | Plugin | Mô tả | Status |
|---|--------|-------|--------|
| 1 | `sui-seal-encrypt` | Encrypt text/file với package ID + identity tùy ý | ✅ Done |
| 2 | `sui-seal-decrypt` | Decrypt với SessionKey + wallet signing | ✅ Done |
| 3 | `sui-seal-vault` | Encrypted secrets vault (localStorage) | ✅ Done |
| 4 | `sui-seal-walrus` | Encrypt → upload Walrus, fetch → decrypt | ✅ Done |
| 5 | `sui-seal-private` | Private Data — chỉ owner decrypt, identity = BCS(address) | ✅ Done |
| 6 | `sui-seal-timelock` | Time-Lock — countdown timer, unlock sau deadline | ✅ Done |
| 7 | `sui-seal-allowlist` | Allowlist — tạo on-chain, add/remove members, group decrypt | ✅ Done |
| 8 | `sui-seal-voting` | Sealed Voting — encrypted ballots, on-chain + client-side tally | ✅ Done |

### Cần build (2 plugins — Phase 2)

| # | Plugin | Pattern | Mô tả |
|---|--------|---------|-------|
| 9 | `sui-seal-subscription` | Subscription | Tạo service với price + duration. User mua subscription → decrypt content trong thời hạn. |
| 10 | `sui-seal-gated-content` | Allowlist + Walrus | NFT/token-gated content: encrypt file → Walrus, chỉ holder decrypt. Kết hợp allowlist + walrus. |

---

## Plugin #5: sui-seal-private

**Pattern:** Private Data — chỉ owner decrypt được.

**Identity construction:**
```ts
const id = toHex(bcs.Address.serialize(account.address).toBytes())
```

**seal_approve call:**
```ts
tx.moveCall({
  target: `${PACKAGE_ID}::private_seal::seal_approve`,
  arguments: [tx.pure.vector('u8', fromHex(id))],
})
```

**UI Flow:**
1. Connect wallet
2. Tab Encrypt: nhập text → encrypt → output base64 ciphertext
3. Tab Decrypt: paste ciphertext → sign session key → decrypt → hiển thị plaintext
4. Chỉ cùng wallet address mới decrypt được

**Complexity:** Low — không cần shared object, không cần on-chain tx ngoài dry-run.

---

## Plugin #6: sui-seal-timelock

**Pattern:** Time-Lock — data unlock sau timestamp.

**Identity construction:**
```ts
const unlockMs = Date.now() + delaySeconds * 1000
const id = toHex(bcs.u64().serialize(unlockMs).toBytes())
```

**seal_approve call:**
```ts
tx.moveCall({
  target: `${PACKAGE_ID}::timelock_seal::seal_approve`,
  arguments: [
    tx.pure.vector('u8', fromHex(id)),
    tx.object('0x6'), // Sui Clock object
  ],
})
```

**UI Flow:**
1. Tab Encrypt: nhập text + delay (seconds) → encrypt → hiển thị unlock time + ciphertext
2. Tab Decrypt: paste ciphertext → parse unlock time từ identity → hiển thị countdown
3. Nếu chưa tới giờ: decrypt fail với message rõ ràng
4. Sau deadline: decrypt thành công

**UI đặc biệt:** Countdown timer component, visual indicator (locked/unlocked icon).

**Complexity:** Low-Medium — cần parse BCS u64 từ identity, hiển thị countdown.

---

## Plugin #7: sui-seal-allowlist

**Pattern:** Allowlist — group access control.

**On-chain operations (cần gas):**
- `allowlist_seal::create()` → tạo Allowlist shared object + AdminCap
- `allowlist_seal::add_member(allowlist, cap, address)` → thêm member
- `allowlist_seal::remove_member(allowlist, cap, address)` → xóa member

**Identity construction:**
```ts
const nonce = crypto.getRandomValues(new Uint8Array(5))
const alBytes = fromHex(allowlistId)
const id = toHex(new Uint8Array([...alBytes, ...nonce]))
```

**seal_approve call:**
```ts
tx.moveCall({
  target: `${PACKAGE_ID}::allowlist_seal::seal_approve`,
  arguments: [
    tx.pure.vector('u8', fromHex(id)),
    tx.object(allowlistId),
  ],
})
```

**UI Flow:**
1. Tab Setup: Create Allowlist → hiển thị allowlist ID + admin cap
2. Tab Members: Add/remove addresses, hiển thị member list
3. Tab Encrypt: nhập text → encrypt cho allowlist
4. Tab Decrypt: paste ciphertext → chỉ members decrypt được

**Complexity:** Medium — cần on-chain tx (create, add_member), quản lý object IDs.

---

## Plugin #8: sui-seal-subscription (Future)

**Pattern:** Subscription — time-limited paid access.

**Cần Move contract mới** (chưa có trong bootcamp demo):
```move
struct Service has key {
    id: UID,
    price: u64,
    duration_ms: u64,
}

struct SubscriptionPass has key {
    id: UID,
    service_id: ID,
    subscriber: address,
    expires_at: u64,
}

entry fun seal_approve(id: vector<u8>, pass: &SubscriptionPass, c: &Clock, ctx: &TxContext) {
    assert!(pass.subscriber == ctx.sender(), ENoAccess);
    assert!(c.timestamp_ms() < pass.expires_at, EExpired);
}
```

**UI Flow:**
1. Creator: tạo Service (price, duration)
2. User: subscribe (pay SUI) → nhận SubscriptionPass
3. User: decrypt content nếu pass chưa hết hạn

**Complexity:** High — cần deploy Move contract mới, handle payment flow.

**Priority:** Phase 2

---

## Plugin #9: sui-seal-voting (Future)

**Pattern:** Secure Voting — encrypted ballots + on-chain tally.

**Cần:**
- Move contract cho voting (eligible voters, ballot submission)
- On-chain decryption via `bf_hmac_encryption` package
- HMAC-CTR encryption mode (thay vì AES-GCM)

**Seal package cho on-chain decryption:**
```
Testnet: 0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3
```

**Complexity:** Very High — on-chain decryption, custom Move, DemType.Hmac256Ctr.

**Priority:** Phase 3

---

## Plugin #10: sui-seal-gated-content (Future)

**Pattern:** Allowlist + Walrus — token-gated encrypted files.

**Flow:**
1. Creator: encrypt file → upload Walrus → lưu blob ID
2. Creator: tạo allowlist, add holders (hoặc check NFT ownership trong seal_approve)
3. Viewer: fetch blob → decrypt nếu có quyền

**Cần:** Kết hợp plugin #7 (allowlist) + plugin #4 (seal-walrus). Có thể là enhancement của seal-walrus thay vì plugin riêng.

**Complexity:** Medium — chủ yếu compose existing patterns.

**Priority:** Phase 2

---

## Implementation Phases

### Phase 1 — Bootcamp Patterns ✅ DONE
Dùng PACKAGE_ID có sẵn từ bootcamp, không cần deploy Move.

| Plugin | LOC | Status |
|--------|-----|--------|
| `sui-seal-private` | ~200 | ✅ |
| `sui-seal-timelock` | ~280 | ✅ |
| `sui-seal-allowlist` | ~400 | ✅ |

### Phase 2 — Extended Patterns (TODO)
Cần deploy Move contracts mới.

| Plugin | Est. LOC | Depends on |
|--------|---------|------------|
| `sui-seal-subscription` | ~500 | New Move contract, payment flow |
| `sui-seal-gated-content` | ~350 | Allowlist + Walrus compose |

### Phase 3 — Advanced ✅ DONE
On-chain decryption, HMAC-CTR.

| Plugin | LOC | Status |
|--------|-----|--------|
| `sui-seal-voting` | ~700 | ✅ (on-chain + client-side tally) |

---

## Key Technical Notes

### SessionKey Reuse
Bootcamp demo caches SessionKey và reuse nếu chưa expired. Plugins nên làm tương tự:
```ts
if (!sessionKeyRef.current || sessionKeyRef.current.isExpired()) {
  // create new + sign
}
```

### Decentralized Key Server (Recommended)
Bootcamp dùng aggregator-backed server (threshold=1, 3-of-5 committee). Đây là setup tốt nhất cho testnet:
```ts
serverConfigs: [{
  objectId: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
  weight: 1,
  aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
}]
```

### Identity Encoding
Mỗi pattern encode identity khác nhau:
- Private: `toHex(bcs.Address.serialize(addr))` 
- Timelock: `toHex(bcs.u64().serialize(timestamp))`
- Allowlist: `toHex([...allowlistIdBytes, ...nonce])`

### Ciphertext Format
Bootcamp demo dùng base64 cho UI copy/paste. Plugins hiện tại dùng hex. Nên thống nhất sang **base64** cho consistency với bootcamp.

### signPersonalMessage Integration
Đã thêm vào SuiHostAPI. Bootcamp demo dùng `useSignPersonalMessage` hook từ dapp-kit — tương đương với `sharedHost.signPersonalMessage()` trong plugin system.

---

## File Structure
```
plugins/
├── sui-seal-shared/        # Shared config (✅)
│   └── config.ts
├── sui-seal-encrypt/       # Generic encrypt (✅)
├── sui-seal-decrypt/       # Generic decrypt (✅)
├── sui-seal-vault/         # Secret vault (✅)
├── sui-seal-walrus/        # Seal + Walrus (✅)
├── sui-seal-private/       # Private data pattern (✅)
├── sui-seal-timelock/      # Time-lock pattern (✅)
├── sui-seal-allowlist/     # Allowlist pattern (✅)
├── sui-seal-voting/        # Sealed voting + on-chain decrypt (✅)
├── sui-seal-subscription/  # Subscription pattern (Phase 2)
└── sui-seal-gated-content/ # Token-gated Walrus (Phase 2)

docs/seal/
├── PLAN.md                 # This file — roadmap & plugin specs
├── TECHNICAL.md            # Architecture, patterns, API reference
└── VOTING.md               # Voting plugin deep-dive + on-chain decrypt
```
