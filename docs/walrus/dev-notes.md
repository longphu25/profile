# Walrus Development Notes

Quick reference cho Walrus plugin development.

---

## SDK Setup (Browser/Vite)

```ts
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { walrus } from '@mysten/walrus'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'

// KHÔNG pass packageConfig — để SDK tự resolve từ network
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: RPC_URL })
  .$extend(walrus({ wasmUrl: walrusWasmUrl }))
```

**`storageNodeUrlScheme` (1.1.7+):** `walrus({ ... })` nhận thêm option
`storageNodeUrlScheme?: 'http' | 'https'` (mặc định `'https'`). Đặt `'http'` cho
local dev khi storage node không terminate TLS — không cần nữa ở testnet/mainnet công khai.

```ts
.$extend(walrus({ wasmUrl: walrusWasmUrl, storageNodeUrlScheme: 'http' })) // local only
```

## Upload Modes

| Mode | Method | Blob Owner | Cost | Signing |
|------|--------|-----------|------|---------|
| Publisher HTTP | `PUT /v1/blobs` | Publisher | Free | None |
| Direct (writeBlobFlow) | SDK WASM | User wallet | WAL | 2 signatures |
| Direct (writeFilesFlow) | SDK WASM | User wallet | WAL | 2 signatures |

**⚠ writeBlobFlow vs writeFilesFlow:**
- `writeBlobFlow` → raw bytes → aggregator serves file directly → viewable
- `writeFilesFlow` → quilt container → aggregator serves quilt bytes → NOT viewable directly

## WAL Acquisition

| Network | Method | Code |
|---------|--------|------|
| Testnet | Exchange 1:1 | `wal_exchange::exchange_for_wal` on exchange object |
| Mainnet | DeepBook swap | `deepBook.swapExactQuoteForBase({ poolKey: 'WAL_SUI' })` |

**Exchange package resolution (testnet):**
```ts
// KHÔNG hardcode package ID — resolve dynamically
const exObj = await rpc('sui_getObject', [exchangeId, { showType: true }])
const exPkg = exObj.result.data.type.split('::')[0]
```

## Reading Blobs

| Method | Use Case |
|--------|----------|
| Aggregator HTTP | Simple reads, browser-compatible |
| SDK `readBlob` | Programmatic, handles retries |
| SDK `getFiles` | Read from quilts |
| SDK `getBlob().files()` | Read quilt contents |

**Aggregator URL:** `{aggregator}/v1/blobs/{blobId}`
- Returns raw bytes (no content-type header)
- Detect content type from magic bytes

## Content Type Detection

```ts
function detectContentType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return 'application/pdf'
  if (bytes[0] === 0x7B) return 'application/json'
  // ... try UTF-8 text detection
}
```

## Blob ID Conversion

```ts
import { blobIdFromInt, blobIdToInt } from '@mysten/walrus'

// On-chain u256 → base64url (for aggregator)
const b64 = blobIdFromInt(BigInt(numericBlobId))

// base64url → u256 (for on-chain queries)
const num = blobIdToInt(base64BlobId)
```

## Finding Blob Objects

```ts
// KHÔNG hardcode blob type package — nó thay đổi khi upgrade
const res = await rpc('suix_getOwnedObjects', [
  address,
  { options: { showType: true, showContent: true } },
  null, 50
])
const blobs = res.result.data.filter(
  obj => obj.data.type.includes('::blob::Blob')
)
```

## Type tags on generated Move structs (1.2.0+)

The generated `MoveStruct` / `MoveEnum` / `MoveTuple` classes (from the contract bindings
the SDK ships) gained two methods for building Move type-tag strings — useful when you
need a type argument for a `moveCall` or a normalized type to compare against on-chain data.

```ts
// Build the tag string (sync). typeArguments is the full positional list in Move
// declaration order; REQUIRED when the struct has unfilled `phantom` params.
const tag = SomeStruct.typeTag({ typeArguments: [WAL_TYPE] })
// May contain MVR names — valid in a tx's typeArguments, NOT for on-chain comparison.

// Resolve MVR names → normalized address-only form (async). Use this when you will
// compare the tag against on-chain data or pass it to a query.
const resolved = await SomeStruct.resolveTypeTag({ client, typeArguments: [WAL_TYPE] })
```

**When which:** `typeTag()` for building a transaction (MVR names are fine there);
`resolveTypeTag({ client, ... })` whenever the tag is compared against chain data or used
in a query — it routes MVR names through `client.core.mvr.resolveType` and returns the
address-only form. Arity of `typeArguments` is validated at runtime.

## Key Gotchas

1. **Không hardcode package IDs** — testnet redeploy thường xuyên
2. **Không pass `packageConfig`** cho SDK — để auto-detect
3. **Dùng `writeBlobFlow`** cho single files — `writeFilesFlow` tạo quilt
4. **Aggregator không trả content-type** — detect từ magic bytes
5. **Publisher owns blob object** — user chỉ có blob ID, không có object
6. **`flow.upload()` cần `digest`** từ register transaction
7. **Exchange function trả `Coin<WAL>`** — phải transfer + transfer leftover SUI
8. **Blob expired** = aggregator 404 — check `storage.end_epoch`
