# Walrus Bug Log — Issues & Fixes

Ghi nhận tất cả lỗi gặp phải khi tích hợp Walrus và cách fix.

---

## 1. CORS — Publisher blocked trên browser

**Error:** `Failed to fetch` khi PUT tới publisher
**Cause:** Mainnet không có public publisher. Publisher HTTP API không set CORS.
**Fix:** Dùng testnet publisher (có CORS) hoặc upload relay cho mainnet.
**Commit:** `52dc886`

---

## 2. Package object does not exist (hardcoded package ID)

**Error:** `Package object does not exist with ID 0x...`
**Cause:** Hardcode package ID cho `wal_exchange` module. Testnet redeploy → package ID thay đổi.
**Fix 1:** Query exchange object type on-chain → extract package ID dynamically.
```ts
const exObj = await fetch(rpc, { method: 'POST', body: JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'sui_getObject',
  params: [exchangeId, { showType: true }],
})}).then(r => r.json())
const exPkg = exObj.result.data.type.split('::')[0]
```
**Fix 2:** Không pass `packageConfig` cho Walrus SDK — để SDK tự resolve từ `client.network`.
**Commits:** `86e96dd`, `5b2df92`, `97786b2`, `2482534`

---

## 3. Package object does not exist (stale SDK config)

**Error:** `Package object does not exist with ID 0x82593828...`
**Cause:** `TESTNET_WALRUS_PACKAGE_CONFIG` trong SDK chứa `exchangeIds` pointing to old package. Khi pass `packageConfig`, SDK dùng các IDs đó.
**Fix:** Không pass `packageConfig` → SDK auto-detect từ `SuiGrpcClient({ network })`.
```ts
// BAD — stale config:
walrus({ packageConfig: TESTNET_WALRUS_PACKAGE_CONFIG })

// GOOD — auto-detect:
walrus({ wasmUrl, uploadRelay })
```
**Commit:** `2482534`

---

## 4. No module found with function name exchange

**Error:** `No function was found with function name exchange`
**Cause:** Function tên `exchange_for_wal`, không phải `exchange`.
**Fix:** Query `sui_getNormalizedMoveModule` để lấy đúng function name.
**Commit:** `33d0909`

---

## 5. Incorrect number of arguments

**Error:** `Incorrect number of arguments for exchange_for_wal`
**Cause:** Function cần 3 args: `&mut Exchange`, `&mut Coin<SUI>`, `u64`. Thiếu `u64` amount.
**Fix:** Thêm `tx.pure.u64(neededMist)` vào arguments.
**Commit:** `77fd06d`

---

## 6. UnusedValueWithoutDrop

**Error:** `Transaction resolution failed: UnusedValueWithoutDrop { result_idx: 0, secondary_idx: 0 }`
**Cause 1:** `exchange_for_wal` trả về `Coin<WAL>` — phải transfer.
**Cause 2:** `splitCoins` result passed as `&mut` — không bị consumed, phải transfer leftover.
**Fix:** `tx.transferObjects([walCoin, suiCoin], walletAddr)`
**Commits:** `ab2bbdc`, `55b7a84`, `62fa3da`

---

## 7. moveCall result destructuring

**Error:** `UnusedValueWithoutDrop` vẫn xảy ra
**Cause:** `tx.moveCall()` trả về array. Cần destructure `const [walCoin] = tx.moveCall(...)`.
**Fix:** Destructure first element.
**Commit:** `55b7a84`

---

## 8. Upload relay 404

**Error:** `404` khi PUT `/v1/blobs` tới upload relay
**Cause:** Upload relay không phải publisher. Relay chỉ dùng nội bộ bởi SDK.
**Fix:** Dùng publisher HTTP API cho testnet, SDK `writeBlobFlow` cho direct mode.
**Commit:** `52dc886`

---

## 9. Either resume.blobObjectId or upload digest must be provided

**Error:** `Either resume.blobObjectId or upload digest must be provided`
**Cause:** `flow.upload()` cần `digest` từ register transaction.
**Fix:** `await flow.upload({ digest: regResult.digest })`
**Commit:** `6d08938`

---

## 10. Quilt vs Raw blob — images show as binary

**Error:** Viewer shows "Binary file (application/octet-stream)" cho hình
**Cause 1:** `writeFilesFlow` wraps files in quilt container. Aggregator trả quilt bytes, không phải raw image.
**Cause 2:** Aggregator không trả `content-type` header → viewer dùng header thay vì magic bytes.
**Fix 1:** Dùng `writeBlobFlow` (raw) thay vì `writeFilesFlow` (quilt) cho Direct mode.
**Fix 2:** Detect content type từ magic bytes trước, chỉ fallback header nếu detection trả octet-stream.
```ts
const detected = detectContentType(bytes)
const header = res.headers.get('content-type') ?? ''
const contentType = detected !== 'application/octet-stream' ? detected : (header || detected)
```
**Commits:** `c2b9ce8`, `da4dae0`

---

## 11. Wallet not connected — cannot sign transaction

**Error:** `Wallet not connected — cannot sign transaction`
**Cause:** WASM dashboard dùng `suiHostAPI` nhưng `signAndExecuteCallback` chưa được register (chỉ `SuiDashboard.tsx` register, không phải WASM dashboard).
**Fix:** Wallet Profile plugin gọi `sharedHost.registerSigner(...)` khi wallet connect.
**Commit:** `54b42c1`

---

## 12. Wallet Profile không load

**Error:** Plugin không render, blank
**Cause:** WASM dashboard render plugin trong Shadow DOM. `DAppKitProvider` và wallet detection cần full DOM access.
**Fix:** Thêm `noShadow: true` flag → render trực tiếp không qua ShadowContainer.
**Commit:** `df23610`

---

## 13. Plugins không nhận wallet connection

**Error:** Plugins báo "not connected" dù wallet đã connect
**Cause:** Plugins dùng `getSuiContext()` — nhưng `SuiContext` không được update trong WASM dashboard (không có `updateSuiContext` call).
**Fix:** Tất cả plugins đọc wallet từ `sharedData.walletProfile` thay vì `getSuiContext()`.
```ts
const [walletAddr, setWalletAddr] = useState<string | null>(() => {
  if (!sharedHost) return null
  return (sharedHost.getSharedData('walletProfile') as any)?.address ?? null
})
useEffect(() => {
  if (!sharedHost) return
  return sharedHost.onSharedDataChange('walletProfile', (v) => {
    setWalletAddr((v as any)?.address ?? null)
  })
}, [])
```
**Commit:** `cadd192`

---

## 14. Network mismatch — testnet wallet + mainnet config

**Error:** `Package object does not exist` hoặc wrong coin types
**Cause:** Plugin hardcode mainnet config nhưng wallet connect testnet.
**Fix:** Đọc network từ `sharedData.walletProfile.network` và dùng config tương ứng.
**Commit:** `79e331f`

---

## 15. Blob objects not found in My Blobs

**Error:** "No blob objects found" dù wallet có blobs
**Cause 1:** Hardcode blob type package ID — package upgrade → type mismatch.
**Cause 2:** Blob uploaded via publisher → publisher owns blob object, not user.
**Fix 1:** Query all owned objects, filter by `::blob::Blob` in type string.
**Fix 2:** Share upload history via `sharedData.walrusUploads` giữa upload và viewer plugins.
**Commits:** `3478511`, `47803f6`

---

## 16. Blob ID format — numeric vs base64url

**Error:** `Aggregator: 400` khi dùng object ID thay vì blob ID
**Cause:** Blob objects lưu `blob_id` dạng u256 integer. Aggregator cần base64url.
**Fix:** Dùng `blobIdFromInt()` từ `@mysten/walrus` SDK.
```ts
import { blobIdFromInt } from '@mysten/walrus'
const b64BlobId = blobIdFromInt(BigInt(rawBlobId))
```
**Commit:** `fe120f7`
