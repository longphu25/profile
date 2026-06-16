# Sui TypeScript SDK — Tham khảo kỹ thuật (`@mysten/sui` 2.18.0)

> Tài liệu triển khai cho SDK lõi Sui như đang dùng trong dự án. Mọi chữ ký API bên dưới
> đều được xác minh trực tiếp với source `node_modules/@mysten/sui@2.18.0` đã cài, không
> phải nhớ từ đầu. Đọc [Lưu ý](#luu-y) trước khi dựa vào đường dẫn chính xác.
>
> Ghi chú deep-research đi kèm: [[research/mysten-sdk-update-2026-06]].
> Chi tiết pricing/devInspect: [[deepbook/predict-club-devinspect-pricing]].

Đây là nền tảng mọi tích hợp SUI trong repo dựa vào: chọn client, build PTB, scale đơn vị,
chạy pre-flight read-only, rồi ký. Gateway predict-club
(`plugins/predict-club/infrastructure/suiPredictGateway.ts`) là bản tham chiếu.

---

## Subpath exports

SDK xuất theo subpath — import từ đường dẫn cụ thể, không bao giờ từ gốc package.

```ts
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'   // client JSON-RPC
import { SuiGrpcClient }    from '@mysten/sui/grpc'      // client gRPC (transport mới)
import { Transaction, coinWithBalance } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import {
  parseToUnits, parseToMist, MIST_PER_SUI, SUI_DECIMALS,
  SUI_CLOCK_OBJECT_ID, normalizeSuiObjectId, isValidSuiAddress,
} from '@mysten/sui/utils'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
```

Các export có sẵn: `bcs`, `client`, `cryptography`, `faucet`, `graphql`, `grpc`,
`jsonRpc`, `keypairs/{ed25519,secp256k1,secp256r1,passkey}`, `multisig`, `transactions`,
`utils`, `verify`, `zklogin`.

---

## Chọn client

Có hai client production. **Đây là điểm quyết định thường gặp nhất.**

| Client | Import | Khi nào |
|---|---|---|
| `SuiJsonRpcClient` | `@mysten/sui/jsonRpc` | Fullnode JSON-RPC ổn định. Có `devInspectTransactionBlock`, `getDynamicFields`, `getObject`, `getCoins`, `getBalance`. Gateway predict + pricing service dùng cái này. |
| `SuiGrpcClient` | `@mysten/sui/grpc` | Transport gRPC mới hơn. Có `simulateTransaction` (dry-run hiện đại với `commandResults` điều khiển bằng `include`). Funding gateway dùng cái này. |

> **Đặt tên:** `SuiClient` monolithic cũ từ `@mysten/sui/client` vẫn còn để back-compat
> nhưng dự án dùng tên rõ ràng `SuiJsonRpcClient` / `SuiGrpcClient`. Đừng lùi về
> `SuiClient` trần.

```ts
// JSON-RPC (gateway predict-club của dự án)
const client = new SuiJsonRpcClient({ url: TESTNET_RPC_URL, network: 'testnet' })

// gRPC (funding gateway của dự án)
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: RPC_URL })
```

`getJsonRpcFullnodeUrl('testnet')` (từ `@mysten/sui/client`) trả URL fullnode public nếu
bạn không tự pin.

---

## Build transaction (PTB)

`Transaction` là một programmable transaction block: chuỗi lệnh trong đó kết quả của mỗi
lệnh có thể làm input cho lệnh kế tiếp.

```ts
const tx = new Transaction()
tx.setSender(walletAddress)        // bắt buộc cho devInspect / lấy nguồn coin

const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountRaw)])
tx.moveCall({
  target: `${PKG}::module::function`,
  typeArguments: [COIN_TYPE],
  arguments: [tx.object(objectId), coin, tx.pure.u64(value), tx.object.clock()],
})
```

### Helper cho argument

| Helper | Dùng |
|---|---|
| `tx.pure.u64(n)`, `tx.pure.id(addr)`, `tx.pure.address(a)`, `tx.pure.bool(b)` | Giá trị pure (mã hóa BCS) |
| `tx.object(id)` | Tham chiếu object on-chain theo ID |
| `tx.object.clock()` | Clock shared `0x6` — viết tắt của `tx.object(SUI_CLOCK_OBJECT_ID)` |
| `tx.gas` | Coin gas (để split SUI native) |
| `tx.moveCall({ target, typeArguments, arguments })` | Gọi hàm Move entry/public |
| `tx.splitCoins(coin, [amounts])` | Tách một coin thành nhiều coin mới |
| `tx.mergeCoins(primary, [coins])` | Gộp coin về một |

### Intent `coinWithBalance` — bỏ chọn coin tay

**Chữ ký đã xác minh (2.18.0):**

```ts
declare function coinWithBalance({
  type,           // string? — coin type; bỏ trống cho SUI native
  balance,        // bigint | number — số lượng theo base unit
  useGasCoin,     // boolean? — cho phép rút từ coin gas
}): (tx: Transaction) => TransactionResult
```

Cái này thay cho điệu nhảy "fetch coins → merge → split" làm tay. Intent resolve lúc build:
lấy từ balance của address khi có, fallback về owned coin, tự merge và split khi cần.

```ts
import { coinWithBalance } from '@mysten/sui/transactions'

// Thay vì fetchDusdcCoins() + mergeCoins() + splitCoins():
const depositCoin = tx.add(coinWithBalance({ type: DUSDC_TYPE, balance: amountRaw }))
tx.moveCall({
  target: `${PKG}::predict_manager::deposit`,
  typeArguments: [DUSDC_TYPE],
  arguments: [tx.object(managerId), depositCoin],
})
```

`tx.coin({ type, balance, useGasCoin })` và `tx.balance({ type, balance, useGasCoin })` là
dạng method trên instance `Transaction` (cùng hình chữ ký) — `coin` trả `Coin<T>`,
`balance` trả `Balance<T>`.

> **Trong repo này:** `suiPredictGateway.ts` vẫn dùng `fetchDusdcCoins` +
> `mergeDusdcAndSplit` làm tay (dòng ~118-140, ~219-225, ~327-333). Cái đó có trước intent
> và là ứng viên để thay — cùng PTB kết quả, ít bề mặt lỗi `coins[0]` mảng rỗng hơn.

---

## Scale đơn vị — đừng bao giờ dùng float math

Số tiền on-chain là integer base-unit (`u64`). Quy đổi số người-đọc phải dùng **số học
bigint**, không phải float JS. `0.07 * 1e6` có thể ra `69999.99…`; truncate cái đó là âm
thầm trả thiếu.

**Chữ ký đã xác minh (2.16.0+, có trong 2.18.0):**

```ts
declare function parseToUnits(amount: string, decimals: number): bigint
declare function parseToMist(amount: string): bigint   // decimals = 9 (SUI)
```

```ts
import { parseToUnits, parseToMist } from '@mysten/sui/utils'

const dusdcRaw = parseToUnits('0.07', 6)   // → 70000n, chính xác
const suiRaw   = parseToMist('1.5')        // → 1500000000n
```

> **Trong repo này:** `suiPredictGateway.ts:217,324` và `walletBalanceService.ts:35,37`
> vẫn scale bằng `Math.floor(amount * 10 ** decimals)` / `raw / 10 ** decimals`. Đây là
> rủi ro đúng/sai thật trên đường tiền và nên chuyển sang `parseToUnits`. Lưu ý
> `parseToUnits` nhận **string** — truyền chuỗi input thô, đừng chuyển sang `number`
> trước (làm vậy là tái tạo lại đúng lỗi float bạn đang muốn tránh).

Hằng hữu ích từ `@mysten/sui/utils`: `MIST_PER_SUI`, `SUI_DECIMALS` (9),
`SUI_CLOCK_OBJECT_ID` (`0x6`), `SUI_TYPE_ARG`, `SUI_FRAMEWORK_ADDRESS`.

---

## Pre-flight read-only (devInspect / simulate)

Pattern giá trị nhất cho UI giao dịch: **chạy PTB thật ở chế độ read-only trước khi yêu
cầu user ký.** Zero gas, không hỏi ví, và hợp đồng trip đúng các guard mà một lần execute
thật sẽ trip.

### JSON-RPC: `devInspectTransactionBlock`

Đây là cái gateway predict dùng cho cả pre-flight mint và claim.

```ts
const inspected = await client.devInspectTransactionBlock({
  sender: walletAddress,
  transactionBlock: tx,
})
if (inspected.error) {
  // hợp đồng abort — map sang lý do thân thiện, KHÔNG ký
  return { ok: false, reason: sanitizeError(inspected.error) }
}
return { ok: true }
```

**Thuộc tính tin cậy:** build PTB qua một hàm `compose*Tx` duy nhất mà cả đường thật
(`build*Tx` → ký) lẫn pre-flight (`simulate*` → devInspect) đều gọi. Khi đó transaction
mô phỏng giống byte-for-byte cái ví ký — chỉ khác devInspect-vs-execute. Xem
`composeClaimTx` / `composeBinaryMintTx` trong `suiPredictGateway.ts` cho hình mẫu.

### gRPC: `simulateTransaction` (đường hiện đại)

Với `SuiGrpcClient`, dry-run là `simulateTransaction` kèm tham số `include`:

```ts
const result = await client.simulateTransaction({
  transaction: tx,
  include: { effects: true, balanceChanges: true, commandResults: true },
})
if (result.$kind === 'FailedTransaction') { /* đã abort */ }
// commandResults (returnValues + mutatedReferences dạng BCS bytes) chỉ có ở simulation —
// KHÔNG tồn tại trên executeTransaction. Decode returnValues bằng bcs để đọc output của
// một hàm Move (ví dụ một quote) mà không tốn gas.
```

`commandResults` là độc nhất của simulation. Dùng nó để đọc giá trị trả về của hàm Move
kiểu `view` (decode BCS bytes) — đây là cách đọc quote do hợp đồng định giá mà không cần
ghi on-chain.

### Fix `ValidDuring` chỉ-cho-simulate ở 2.16.3

PTB mà input chỉ gồm shared object hoặc pure arg (thường gặp ở đây — một lần đọc quote chỉ
chạm shared oracle/registry) từng fail simulation tính gas-budget với lỗi *"Transactions
must either have address-owned inputs, or a ValidDuring expiration"*. Từ 2.16.3 resolver tự
inject một `ValidDuring` expiration chỉ-cho-simulate khi nó tính gas budget và chưa set cái
nào — phạm vi chỉ ở request simulate, tx ký cuối cùng không đổi. Bạn không còn cần set
expiration giả để dry-run một PTB read-only.

---

## Ký & thực thi

Trong dApp (browser) dự án **không** giữ khóa — nó build `tx` rồi đưa cho ví qua host
bridge (`host.signAndExecuteTransaction(tx)`), đi qua dApp Kit. Xem
[[deepbook/predict-club-data-contract]] và phần dapp-kit của
[[research/mysten-sdk-update-2026-06]].

Cho ký server/script bằng keypair cục bộ:

```ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
const keypair = Ed25519Keypair.fromSecretKey(secret)
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true, showObjectChanges: true },
})
```

---

## Đọc state on-chain

```ts
// Một object
const obj = await client.getObject({ id, options: { showContent: true } })

// Dynamic fields (cách enumerate vị thế PredictManager — xem pricing service)
const { data, nextCursor, hasNextPage } =
  await client.getDynamicFields({ parentId, cursor })

// Coin của một type mà address sở hữu
const { data } = await client.getCoins({ owner, coinType: DUSDC_TYPE })

// Balance tổng
const bal = await client.getBalance({ owner, coinType: PLP_TYPE })
```

Phân trang dynamic fields bằng vòng `cursor` / `hasNextPage` — một manager nhiều vị thế
trải qua nhiều trang. Pricing service predict
(`deepbookPredictPricingService.ts`) gói cái này trong `fetchManagerSnapshot`.

---

## BCS encode/decode

`@mysten/sui/bcs` decode giá trị Move trả về (từ `devInspect` / `simulateTransaction`) và
encode pure argument phức tạp.

```ts
import { bcs } from '@mysten/sui/bcs'

// Decode một u64 do hàm view trả về trong kết quả devInspect
const [bytes] = inspected.results![0].returnValues![0]
const value = bcs.u64().parse(Uint8Array.from(bytes))
```

---

## Lưu ý

- **Pin phiên bản.** Chữ ký xác minh với `@mysten/sui@2.18.0` như đã cài. SDK đi nhanh;
  re-check type trong `node_modules` trước khi phụ thuộc vào một hình chính xác.
- **`commandResults` chỉ có ở gRPC.** Nó nằm trên `SuiGrpcClient.simulateTransaction`,
  không phải `SuiJsonRpcClient.devInspectTransactionBlock` (cái này trả `results` /
  `returnValues` theo hình JSON-RPC). Pattern decode khác nhau giữa hai client.
- **`parseToUnits` nhận string.** Truyền một `number` đã chia trước là tái tạo lỗi float.
  Luồn chuỗi input gốc qua thẳng.
- **Pre-flight không phải đảm bảo.** devInspect chạy với state chain hiện tại; state có thể
  đổi giữa pre-flight và ký. Nó bắt các ca tx-chết phổ biến (strike sai, claim chưa settle,
  vị thế thua), không bắt được race ở ranh giới.

## Câu hỏi mở

1. Đường devInspect `SuiJsonRpcClient` của dự án có nên chuyển sang
   `SuiGrpcClient.simulateTransaction` cho lần đọc quote, để dùng `commandResults` trực
   tiếp thay vì hình `returnValues` của JSON-RPC không?
2. Có ca nào trong pre-flight claim/mint mà override `ValidDuring` chỉ-cho-simulate của
   2.16.3 **không** bao được một PTB không-thanh-toán và vẫn cần set expiration tường minh?

## Nguồn

- Type declaration `node_modules/@mysten/sui@2.18.0` đã cài (subpath `transactions`,
  `utils`, `jsonRpc`, `grpc`, `bcs`) — sơ cấp, xác minh trong repo.
- [Sui SDK — Transaction basics](https://sdk.mystenlabs.com/sui/transactions/basics)
- [Sui SDK — Signing & execution](https://sdk.mystenlabs.com/sui/transactions/signing-and-execution)
- [Sui SDK — gRPC](https://sdk.mystenlabs.com/sui/grpc)
- [ts-sdks CHANGELOG (`packages/typescript`)](https://github.com/MystenLabs/ts-sdks/blob/main/packages/typescript/CHANGELOG.md)
