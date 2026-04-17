---
tags: [seal, encryption, technical, architecture]
aliases: [Seal Technical, Seal Architecture]
---

# Seal Plugins — Technical Reference

Tài liệu kỹ thuật cho 8 Seal plugins trong Sui Dashboard.

> See also: [[seal/PLAN|Roadmap]] · [[seal/VOTING|Voting Deep-dive]] · [[defi/navi/TECHNICAL|NAVI Integration]]

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ SuiWasmDashboard (sui-plugin-wasm.html)             │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ SuiHostAPI                                   │    │
│  │  • getSuiContext()                           │    │
│  │  • signAndExecuteTransaction(tx)             │    │
│  │  • signPersonalMessage(msg) ← added for Seal│    │
│  │  • getSharedData() / setSharedData()         │    │
│  └──────────────┬──────────────────────────────┘    │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐    │
│  │ Seal Plugins (Shadow DOM isolated)           │    │
│  │                                              │    │
│  │  sui-seal-shared/config.ts ← shared config   │    │
│  │       │                                      │    │
│  │  ┌────┴────┬────────┬─────────┬──────────┐  │    │
│  │  │private  │timelock│allowlist│voting    │  │    │
│  │  │encrypt  │decrypt │vault    │walrus    │  │    │
│  │  └─────────┴────────┴─────────┴──────────┘  │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Host API Extensions

Seal plugins cần 2 host API methods mà base HostAPI không có:

```ts
// src/sui-dashboard/sui-types.ts
interface SuiHostAPI extends HostAPI {
  signAndExecuteTransaction(tx: Transaction): Promise<TransactionResult>
  signPersonalMessage(message: Uint8Array): Promise<PersonalMessageResult>  // ← new
}
```

`signPersonalMessage` được thêm để hỗ trợ Seal SessionKey creation. Wallet ký personal message → SDK dùng signature để authenticate với key servers.

**Files changed:**
- `src/sui-dashboard/sui-types.ts` — thêm `PersonalMessageResult` type + method
- `src/sui-dashboard/sui-host.ts` — thêm callback registration + implementation
- `src/sui-dashboard/SuiDashboard.tsx` — wire `dAppKitInstance.signPersonalMessage`

---

## Shared Config

`plugins/sui-seal-shared/config.ts` — single source of truth cho tất cả Seal plugins:

| Export | Value | Note |
|--------|-------|------|
| `SEAL_PACKAGE_ID` | `0x2b5472a…` | Bootcamp demo package (testnet) |
| `TESTNET_KEY_SERVERS` | Decentralized (aggregator) | 3-of-5 committee, threshold=1 |
| `TESTNET_KEY_SERVERS_INDEPENDENT` | 2 Mysten servers | Fallback, threshold=2 |
| `DEFAULT_THRESHOLD` | `1` | For decentralized server |
| `SUI_CLOCK` | `0x6` | Sui Clock object ID |
| `RPC_URLS` | testnet/mainnet | JSON-RPC endpoints |

### Key Server Choice

Decentralized server (aggregator-backed) được chọn vì:
- Threshold=1 → chỉ cần 1 round-trip
- 3-of-5 committee → distributed trust
- Aggregator handles fan-out → client đơn giản hơn

---

## Plugin Details

### 1. sui-seal-encrypt (Generic)

**Purpose:** Encrypt arbitrary data với custom package ID + identity.

**SDK calls:**
```ts
SealClient.encrypt({ threshold, packageId, id, data })
```

**Output:** Hex-encoded encrypted bytes + backup symmetric key.

**No wallet signing needed** — encryption is purely local (uses key server public keys only).

---

### 2. sui-seal-decrypt (Generic)

**Purpose:** Decrypt Seal-encrypted data với wallet approval.

**SDK calls:**
```ts
SessionKey.create({ address, packageId, ttlMin, suiClient })
sessionKey.getPersonalMessage() → signPersonalMessage → setPersonalMessageSignature
SealClient.decrypt({ data, sessionKey, txBytes })
```

**Flow:** Create SessionKey → wallet signs personal message → build seal_approve PTB → decrypt.

**Key insight:** `txBytes` phải build với `onlyTransactionKind: true` — key servers dry-run transaction kind, không phải full transaction.

---

### 3. sui-seal-vault (Secret Manager)

**Purpose:** Encrypted key-value secrets, stored in localStorage.

**Storage:** `localStorage['seal-vault:{walletAddress}']` → JSON array of `{ label, encryptedHex, createdAt }`.

**Per-wallet isolation:** Mỗi wallet address có vault riêng.

**Encrypt identity:** `toHex(TextEncoder.encode('{address}:{label}'))` — unique per wallet + label.

---

### 4. sui-seal-walrus (Encrypted File Storage)

**Purpose:** Encrypt file → upload to Walrus → fetch → decrypt.

**Upload flow:**
```
File → SealClient.encrypt() → encrypted bytes
     → PUT /v1/blobs (Walrus publisher) → blob ID
```

**Download flow:**
```
GET /v1/blobs/{blobId} (Walrus aggregator) → encrypted bytes
     → EncryptedObject.parse() → extract id
     → SessionKey + seal_approve PTB → SealClient.decrypt()
```

**Publisher:** `https://publisher.walrus-testnet.walrus.space`
**Aggregator:** `https://aggregator.walrus-testnet.walrus.space`

---

### 5. sui-seal-private (Private Data Pattern)

**Move module:** `private_seal` (bootcamp package)

**Identity:** `toHex(bcs.Address.serialize(walletAddress).toBytes())`

**seal_approve:** Checks `id == bcs::to_bytes(&ctx.sender())` — chỉ owner decrypt.

**Ciphertext format:** Base64 (consistent với bootcamp demo).

**SessionKey caching:** `useRef` — reuse nếu chưa expired, tránh sign lại.

---

### 6. sui-seal-timelock (Time-Lock Pattern)

**Move module:** `timelock_seal` (bootcamp package)

**Identity:** `toHex(bcs.u64().serialize(unlockTimestampMs).toBytes())`

**seal_approve:** Checks `clock.timestamp_ms() >= unlock_time` — dùng Sui Clock object (`0x6`).

**Countdown timer:** `setInterval` 1s, parse unlock time từ ciphertext identity:
```ts
const parsed = EncryptedObject.parse(fromBase64(ciphertext))
const idBytes = fromHex(parsed.id)
const unlockMs = Number(bcs.u64().parse(idBytes))
```

**UX:** Lock/unlock icon, countdown display, clear error message khi decrypt trước deadline.

---

### 7. sui-seal-allowlist (Allowlist Pattern)

**Move module:** `allowlist_seal` (bootcamp package)

**On-chain operations (cần gas):**
| Function | Purpose | Gas |
|----------|---------|-----|
| `create()` | Tạo Allowlist shared object + AdminCap | Yes |
| `add_member(allowlist, cap, addr)` | Thêm member | Yes |
| `remove_member(allowlist, cap, addr)` | Xóa member | Yes |

**Identity:** `toHex([...allowlistObjectIdBytes(32), ...randomNonce(5)])`

**Object discovery:** JSON-RPC `suix_getOwnedObjects` với filter `{ Package: SEAL_PACKAGE_ID }` → tìm AdminCap → extract `allowlist_id` field.

**seal_approve:** Checks `is_prefix(allowlist_id, id) && members.contains(sender)`.

---

### 8. sui-seal-voting (Sealed Voting)

**Move module:** `voting_seal` (cần deploy riêng — contract reference tại `plugins/sui-seal-voting/voting_seal.move`)

**Encryption mode:** `DemType.Hmac256Ctr` — bắt buộc cho on-chain decryption.

**Ballot encoding:** Single byte = option index (`0x00`, `0x01`, `0x02`…).

**Two tally modes:**

#### Client-side (faster)
```ts
SealClient.fetchKeys({ ids, txBytes, sessionKey, threshold })  // batch
SealClient.decrypt({ data, sessionKey, txBytes })               // per ballot
```

#### On-chain (verifiable) — via `bf_hmac_encryption`
```ts
// Per ballot:
SealClient.getDerivedKeys({ id, txBytes, sessionKey, threshold })
SealClient.getPublicKeys(serviceIds)

// Build PTB:
bf_hmac_encryption::new_public_key(objectId, pkBytes)
bls12381::g1_from_bytes(derivedKeyBytes)
bf_hmac_encryption::verify_derived_keys(g1Vec, packageId, id, pkVec)
bf_hmac_encryption::parse_encrypted_object(encBytes)
bf_hmac_encryption::decrypt(parsed, verified, pkVec) → Option<vector<u8>>

// Execute via devInspectTransactionBlock (no gas)
```

**Seal on-chain package:** `0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3` (testnet)

**Batching:** 5 ballots per PTB (PTB size limit).

**Return value parsing:** BCS `Option<vector<u8>>` → byte 0 = 0x01 (Some) → ULEB128 length → data.

---

## Common Patterns

### SealClient Initialization
```ts
const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
const sealClient = new SealClient({
  suiClient,
  serverConfigs: TESTNET_KEY_SERVERS,
  verifyKeyServers: false,  // skip verification for speed
})
```

Tất cả plugins cache `sealClient` trong `useRef` và invalidate khi network thay đổi.

### SessionKey Flow
```ts
// 1. Create
const sk = await SessionKey.create({ address, packageId, ttlMin: 10, suiClient })

// 2. Get message to sign
const message = sk.getPersonalMessage()

// 3. Wallet signs (via host API)
const { signature } = await sharedHost.signPersonalMessage(message)

// 4. Set signature
await sk.setPersonalMessageSignature(signature)

// 5. Use for decrypt / getDerivedKeys
```

Cache trong `useRef`, check `isExpired()` trước khi reuse.

### Wallet Context
```ts
const d = sharedHost.getSharedData('walletProfile') as { address: string; network: string } | null
// Subscribe to changes:
sharedHost.onSharedDataChange('walletProfile', (v) => { ... })
```

### JSON-RPC Fallback
`SuiGrpcClient` không có `getOwnedObjects` hay `devInspectTransactionBlock`. Dùng raw `fetch` với JSON-RPC:
```ts
fetch(RPC_URLS[network], {
  method: 'POST',
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_getOwnedObjects', params: [...] })
})
```

---

## Build & Registration

### vite.config.ts
Mỗi plugin là một entry point riêng:
```ts
'plugins/sui-seal-private': resolve(__dirname, 'plugins/sui-seal-private/plugin.tsx'),
```

### SuiWasmDashboard.tsx
Registered trong group `seal` với icon `🔐`:
```ts
{ id: 'seal', label: 'Seal Encryption', icon: '🔐', plugins: [...] }
```

### CSS
Mỗi plugin có `style.css` riêng, copy vào `dist/plugins/{name}/style.css` bởi `copyPluginAssets()` Vite plugin. Load qua Shadow DOM `<link>` tag.

**Naming convention:** `.sui-{2-letter-prefix}__element` (e.g. `.sui-sp__btn`, `.sui-st__countdown`).

---

## File Structure (Final)

```
plugins/
├── sui-seal-shared/
│   └── config.ts                    # Key servers, package ID, helpers
├── sui-seal-encrypt/
│   ├── plugin.tsx                   # Generic encrypt (text/file)
│   └── style.css
├── sui-seal-decrypt/
│   ├── plugin.tsx                   # Generic decrypt with SessionKey
│   └── style.css
├── sui-seal-vault/
│   ├── plugin.tsx                   # Encrypted secrets manager
│   └── style.css
├── sui-seal-walrus/
│   ├── plugin.tsx                   # Seal + Walrus (upload/download)
│   └── style.css
├── sui-seal-private/
│   ├── plugin.tsx                   # Private Data pattern
│   └── style.css
├── sui-seal-timelock/
│   ├── plugin.tsx                   # Time-Lock pattern + countdown
│   └── style.css
├── sui-seal-allowlist/
│   ├── plugin.tsx                   # Allowlist pattern + member mgmt
│   └── style.css
└── sui-seal-voting/
    ├── plugin.tsx                   # Sealed Voting (3 tabs)
    ├── voting-utils.ts              # Session fetch, helpers
    ├── voting_seal.move             # Move contract reference
    └── style.css
```

---

## Dependencies

| Package | Version | Used For |
|---------|---------|----------|
| `@mysten/seal` | ^1.1.1 | SealClient, SessionKey, EncryptedObject, DemType |
| `@mysten/sui` | ^2.8.0 | SuiGrpcClient, Transaction, bcs |
| `@mysten/bcs` | ^2.0.3 | fromHex, toHex |
| `@noble/curves` | ^2.0.1 | BLS12-381 (transitive via seal) |
| `@noble/hashes` | ^2.0.1 | SHA3, HMAC (transitive via seal) |

Tất cả crypto operations chạy trong browser via `@noble/*` (pure JS, WASM-grade performance). Không có actual WASM binary.
