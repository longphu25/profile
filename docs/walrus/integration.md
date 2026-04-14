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

### 4. Upload Step-by-Step Flow (popup per step)

**Upload plugin phải hiện popup step-by-step:**

```
Step 1: Check WAL Balance
  ├─ Đủ WAL → skip to Step 3
  └─ Thiếu WAL → Step 2

Step 2: Acquire WAL
  ├─ Testnet: exchange SUI→WAL (1:1) via exchangeIds
  └─ Mainnet: swap SUI→WAL via DeepBook WAL_SUI pool
  → Wallet popup: sign swap tx

Step 3: Encode file (WASM RedStuff)
  → Progress bar, no wallet needed

Step 4: Register blob on-chain
  → Wallet popup: sign register tx

Step 5: Upload slivers to storage nodes
  → Progress bar, no wallet needed

Step 6: Certify blob on-chain
  → Wallet popup: sign certify tx

Step 7: Done! Show blob ID + URL
```

**Browser flow code:**
```ts
// Step 1-2: Check & acquire WAL
const walBalance = await getWalBalance(address)
const storageCost = estimateStorageCost(fileSize, epochs)
if (walBalance < storageCost) {
  if (network === 'testnet') {
    await exchangeSuiToWal(needed, exchangeIds) // 1:1
  } else {
    await swapSuiToWal(needed) // DeepBook WAL_SUI
  }
}

// Step 3-6: Upload via writeFilesFlow
const flow = client.walrus.writeFilesFlow({ files })
await flow.encode()                              // Step 3
const registerTx = flow.register({ epochs, owner, deletable })
await signAndExecuteTransaction(registerTx)      // Step 4
await flow.upload({ digest })                    // Step 5
const certifyTx = flow.certify()
await signAndExecuteTransaction(certifyTx)       // Step 6
```

### 5. WAL Acquisition Strategy

| Network | Method | Rate | SDK |
|---------|--------|------|-----|
| Testnet | `exchangeIds` objects | 1:1 SUI→WAL | `@mysten/walrus` config |
| Mainnet | DeepBook `WAL_SUI` | Market price | `@mysten/deepbook-v3` |
| Mainnet | DeepBook `WAL_USDC` | Market price | `@mysten/deepbook-v3` |

**Testnet exchange IDs** (from `TESTNET_WALRUS_PACKAGE_CONFIG`):
```
0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073
0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862
0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5
0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1
```

**Mainnet:** Không có exchange objects. Phải swap qua DeepBook:
```ts
dbClient.deepBook.swapExactQuoteForBase({
  poolKey: 'WAL_SUI', amount: suiAmount,
  deepAmount: 0, minOut: minWalOut,
})(tx)
```

### 6. Tip Config

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
