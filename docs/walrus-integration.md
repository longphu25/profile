# Walrus Integration Notes

Ghi nhận các vấn đề và lưu ý khi tích hợp Walrus vào plugin system.

---

## Mainnet Configuration

```yaml
system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
WAL_package: 0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59
walrus_package: 0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77
WAL_type: 0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL
epoch_duration: 14 days
max_epochs_ahead: 53
```

---

## Known Issues

### 1. CORS — Public Publisher blocked trên browser

**Vấn đề:** `Failed to fetch` khi gọi `PUT` tới Walrus publisher từ browser.

**Nguyên nhân:** Mainnet không có public publisher cho browser requests. Publisher HTTP API không set CORS headers → browser block cross-origin requests.

**Giải pháp:**
- Dùng **upload relay** thay vì publisher trực tiếp
- Upload relay mainnet: `https://upload-relay.mainnet.walrus.space`
- Upload relay testnet: `https://upload-relay.testnet.walrus.space`
- Relay có tip config (phí nhỏ cho mỗi upload)

**Code pattern:**
```ts
import { walrus } from '@mysten/walrus'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC_URL })
  .$extend(walrus({
    wasmUrl: walrusWasmUrl,
    uploadRelay: {
      host: 'https://upload-relay.mainnet.walrus.space',
      sendTip: { max: 5000 }, // auto-detect tip from relay
    },
  }))
```

### 2. Aggregator — Reads work fine

**Aggregator** cho phép CORS → đọc blob từ browser OK.

```
Mainnet: https://aggregator.walrus-mainnet.walrus.space
Testnet: https://aggregator.walrus-testnet.walrus.space
```

**Read pattern:**
```ts
// Direct fetch (no SDK needed for reads)
const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`)
const bytes = new Uint8Array(await res.arrayBuffer())
```

### 3. WASM — Required for encoding/decoding

**Vấn đề:** `@mysten/walrus` SDK cần WASM bindings (`@mysten/walrus-wasm`) cho RedStuff encoding.

**Giải pháp cho Vite:**
```ts
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'

// Pass URL to walrus client
walrus({ wasmUrl: walrusWasmUrl })
```

**Lưu ý:**
- Phải import với `?url` suffix trong Vite
- WASM file ~2MB, load lần đầu có thể chậm
- Chỉ cần cho write operations (read qua aggregator không cần WASM)

### 4. Upload cần Wallet Signing

**Vấn đề:** `writeFiles` / `writeBlob` cần `signer` để ký transaction (register blob + certify).

**Hiện tại:** Plugin chưa wire wallet signing cho upload. Cần:
1. Wallet Profile plugin connected
2. `SuiHostAPI.signAndExecuteTransaction` cho từng step
3. Hoặc dùng `writeFilesFlow` API cho browser (tách register/certify thành 2 user interactions)

**Browser flow (recommended):**
```ts
const flow = client.walrus.writeFilesFlow({ files })
await flow.encode()

// Step 1: User clicks "Register" → wallet popup
const registerTx = flow.register({ epochs, owner: address, deletable })
const regResult = await signAndExecuteTransaction(registerTx)

// Step 2: Upload data to storage nodes
await flow.upload({ digest: regResult.digest })

// Step 3: User clicks "Certify" → wallet popup
const certifyTx = flow.certify()
const certResult = await signAndExecuteTransaction(certifyTx)
```

### 5. Tip Config

Upload relay yêu cầu tip (phí) cho mỗi upload:

**Mainnet:** Linear tip
```json
{
  "address": "0x765a...",
  "kind": { "linear": { "base": 0, "encoded_size_mul_per_kib": 40 } }
}
```

**Testnet:** Constant tip
```json
{
  "address": "0x4b6a...",
  "kind": { "const": 105 }
}
```

SDK tự handle tip khi dùng `sendTip: { max: N }`.

---

## API Reference

### Aggregator (reads — no auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/blobs/{blobId}` | GET | Download blob content |
| `/v1/api` | GET | OpenAPI spec |

### Publisher (writes — needs auth, no CORS)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/blobs?epochs=N` | PUT | Upload blob (body = raw bytes) |
| `/v1/blobs?epochs=N&deletable=true` | PUT | Upload deletable blob |

### Upload Relay (writes — browser compatible)

Used via `@mysten/walrus` SDK with `uploadRelay` config.
Relay handles the multi-step upload process internally.

### Staking

| Contract | Function | Description |
|----------|----------|-------------|
| `walrus::staking::stake_with_pool` | Move call | Stake WAL with a storage node |

---

## Dependencies

```json
{
  "@mysten/walrus": "^1.1.0",
  "@mysten/walrus-wasm": "(bundled with @mysten/walrus)",
  "@mysten/sui": "^2.14.1"
}
```

---

## Public Endpoints

### Mainnet

| Service | URL | CORS |
|---------|-----|------|
| Aggregator | `https://aggregator.walrus-mainnet.walrus.space` | ✅ Yes |
| Upload Relay | `https://upload-relay.mainnet.walrus.space` | ✅ Yes |
| Publisher | (none public on mainnet) | ❌ N/A |
| Staking App | `https://stake-wal.wal.app` | N/A |
| Explorer | `https://walruscan.com` | N/A |

### Testnet

| Service | URL | CORS |
|---------|-----|------|
| Aggregator | `https://aggregator.walrus-testnet.walrus.space` | ✅ Yes |
| Upload Relay | `https://upload-relay.testnet.walrus.space` | ✅ Yes |
| Publisher | `https://publisher.walrus-testnet.walrus.space` | ⚠️ Limited |

---

## Operator List

Full list of aggregators/publishers: `https://docs.wal.app/operators.json`

Mainnet có ~20 aggregators (nhiều có cache), 0 public publishers.
