# ZK Login Plugin — Technical Reference

> Zero-Knowledge Proof authentication trên SUI. OAuth (Google) → ZK Proof → Wallet address, không cần private key truyền thống.
>
> Source: `plugins/sui-zk-login/` · Based on: [K2 Bootcamp](../../../sui-move-bootcamp/K2/)

---

## Flow tổng quan

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. Keypair  │───▶│  2. OAuth    │───▶│  3. ZK Proof │───▶│  4. Wallet   │
│  Ed25519     │    │  Google JWT  │    │  Mysten Labs │    │  Send SUI    │
│  + nonce     │    │  id_token    │    │  prover      │    │  zkLogin sig │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Step 1: Ephemeral Keypair

```typescript
const keypair = Ed25519Keypair.generate()
const randomness = generateRandomness()          // 128-bit random
const nonce = generateNonce(publicKey, maxEpoch, randomness)
// maxEpoch = currentEpoch + EPOCH_DURATION (2)
```

- Keypair tạm thời, chỉ valid trong `maxEpoch` epochs
- `nonce` = hash(publicKey, maxEpoch, randomness) — gắn vào OAuth request
- Fetch current epoch qua gRPC: `ledgerService.getEpoch({})` → `response.response.epoch?.epoch`

### Step 2: OAuth Login

```
Google OAuth URL:
  https://accounts.google.com/o/oauth2/v2/auth
  ?response_type=id_token
  &client_id=xxx.apps.googleusercontent.com
  &redirect_uri={window.location.origin}
  &scope=openid email profile
  &nonce={nonce_from_step1}
```

- Mở popup 500×600, listen `location.hash` cho `id_token=`
- Decode JWT: `iss`, `sub`, `aud`, `nonce` — verify nonce matches step 1
- Hỗ trợ paste JWT trực tiếp (cho testing không cần OAuth Client ID)

### Step 3: ZK Proof Generation

```typescript
const payload = {
  jwt: jwtToken,
  extendedEphemeralPublicKey: publicKey.toBase64(),
  maxEpoch: maxEpoch,
  jwtRandomness: randomnessToBase64(randomness),
  salt: saltToBase64(salt),
  keyClaimName: 'sub',
}
const proof = await fetch('https://prover-dev.mystenlabs.com/v1', {
  method: 'POST',
  body: JSON.stringify(payload),
})
```

**Prover trả về:**
```json
{
  "proofPoints": { "a": [...], "b": [...], "c": [...] },
  "issBase64Details": { "value": "...", "indexMod4": 0 },
  "headerBase64": "..."
}
```

**Derive wallet address:**
```typescript
const address = jwtToAddress(jwt, BigInt(salt), false)  // false = non-legacy
const addressSeed = genAddressSeed(BigInt(salt), 'sub', jwt.sub, jwt.aud)
```

### Step 4: Transaction with zkLogin Signature

```typescript
// 1. Build transaction
const tx = new Transaction()
tx.setSender(zkAddress)
const [coin] = tx.splitCoins(tx.gas, [amountMist])
tx.transferObjects([coin], recipient)
const txBytes = await tx.build({ client })

// 2. Sign with ephemeral keypair
const { signature: userSignature } = await ephemeralKeypair.signTransaction(txBytes)

// 3. Create zkLogin composite signature
const zkSig = getZkLoginSignature({
  inputs: {
    proofPoints: proof.proofPoints,
    issBase64Details: proof.issBase64Details,
    headerBase64: proof.headerBase64,
    addressSeed: addressSeed,
  },
  maxEpoch: maxEpoch.toString(),
  userSignature,
})

// 4. Execute — zkSig replaces normal wallet signature
await client.core.executeTransaction({
  transaction: txBytes,
  signatures: [zkSig],
})
```

---

## SDK Dependencies

| Package | Import | Purpose |
|---------|--------|---------|
| `@mysten/sui/keypairs/ed25519` | `Ed25519Keypair` | Ephemeral keypair generation |
| `@mysten/sui/zklogin` | `generateNonce`, `generateRandomness`, `jwtToAddress`, `genAddressSeed`, `getZkLoginSignature` | ZK proof flow |
| `@mysten/sui/transactions` | `Transaction` | PTB construction |
| `@mysten/sui/grpc` | `SuiGrpcClient` | Epoch fetch, balance, tx execution |
| `jwt-decode` | `jwtDecode` | Decode OAuth JWT token |

---

## Sui SDK v2 Gotchas

| Issue | Detail |
|-------|--------|
| gRPC response wrapper | `ledgerService.getEpoch({})` returns `{ response: { epoch: { epoch } } }` — double `.response` |
| `jwtToAddress` 3 args | SDK v2 requires `legacyAddress` param: `jwtToAddress(jwt, salt, false)` |
| `getBalance` param | Uses `owner` not `address`: `core.getBalance({ owner: addr })` |
| Balance field | `bal.balance?.balance` (string), not `totalBalance` |
| `signTransaction` | Returns `{ signature }` (string), used directly in `getZkLoginSignature` |
| `executeTransaction` | `core.executeTransaction({ transaction: bytes, signatures: [zkSig] })` — zkSig is string |

---

## ZK Proof Encoding Helpers

```typescript
// Salt: BigInt → 16 bytes → base64
function saltToBase64(salt: string): string {
  const hex = BigInt(salt).toString(16).padStart(32, '0')  // 32 hex = 16 bytes
  return hexToBase64(hex)
}

// Randomness: same encoding as salt
function randomnessToBase64(r: string): string {
  const hex = BigInt(r).toString(16).padStart(32, '0')
  return hexToBase64(hex)
}
```

---

## Configuration

| Param | Value | Note |
|-------|-------|------|
| Network | `devnet` | Prover chỉ hỗ trợ devnet |
| gRPC URL | `https://fullnode.devnet.sui.io:443` | |
| Prover | `https://prover-dev.mystenlabs.com/v1` | Mysten Labs hosted |
| Salt | `248191903847969014646285995941615069143` | Default — production cần unique per-user |
| Epoch duration | `2` | Ephemeral key valid 2 epochs (~2 hours) |

---

## Security Notes

- **Ephemeral keypair** chỉ valid trong `maxEpoch` — tự hết hạn
- **Salt** phải unique per-user trong production — nếu dùng chung salt, ai có JWT cùng `sub` sẽ derive cùng address
- **ZK Proof** chứng minh bạn sở hữu OAuth identity mà không reveal JWT content
- **Prover service** là trusted third-party — production nên self-host hoặc dùng Shinami
- **JWT token** không được lưu persistent — chỉ dùng trong session

---

## Plugin Features

- Progress indicator (4 dots: xanh = done, tím = active)
- Google OAuth popup hoặc paste JWT trực tiếp
- Copy address click
- "Share to Dashboard" — push wallet vào shared data cho các plugin khác
- Send SUI với zkLogin signature
- Error handling cho prover failures, network issues

---

## File Structure

```
plugins/sui-zk-login/
├── plugin.tsx    ← Full 4-step flow, ~280 LOC
└── style.css     ← Purple theme, progress dots, step cards
```

Không có file phụ — toàn bộ logic trong 1 file vì flow là sequential (step 1 → 2 → 3 → 4), không cần tách module.
