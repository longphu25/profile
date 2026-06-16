# Nghiên cứu: có gì mới và đáng dùng trong các SDK @mysten/* bản mới nhất

> Báo cáo deep-research (2026-06-16). 23 nguồn sơ cấp, 25 claim kiểm chứng đối kháng
> (3 phiếu), tất cả xác nhận 3-0; nhiều claim đối chiếu trực tiếp với mã nguồn
> `node_modules` đã cài. Độ tin cậy đồng đều cao. Phạm vi: thị trường dự đoán
> binary-options trên SUI testnet (`predict-club`), terminal giao dịch React 19.
> Đọc phần Lưu ý trước khi code dựa trên đường dẫn endpoint hay tên method SDK cụ thể.

## Tóm tắt nhanh

Các pin Mysten của dự án về cơ bản đã mới nhất, nên đây không phải chuyện "nâng cấp".
Đây là chuyện "primitive nào đã cài sẵn cho phép xóa bớt code viết tay". Có hai thay đổi
đáng làm; phần còn lại của bề mặt SDK không áp dụng được, và lý do được ghi lại dưới đây
để khỏi đào lại.

| Thay đổi | API (đã cài sẵn) | Ở đâu | Vì sao |
| --- | --- | --- | --- |
| Bỏ float-math khi quy đổi tiền | `parseToUnits` / `parseToMist` (sui 2.16.0) | `suiPredictGateway.ts:217,324`, `walletBalanceService.ts:35,37` | đúng/sai: tiền không được đi qua float JS |
| Bỏ chọn coin tay | intent `coinWithBalance` (sui 2.18.0) | `suiPredictGateway.ts:118-140,219-225` | bỏ ~25 dòng merge/split + một lời gọi `suix_getCoins` thô |

## Phiên bản đã cài (theo lockfile, 2026-06-16)

| Package | Range | Resolved | Ghi chú |
| --- | --- | --- | --- |
| `@mysten/sui` | ^2.18.0 | 2.18.0 | baseline peer mà cả stack đang pin |
| `@mysten/deepbook-v3` | ^1.5.0 | 1.5.0 | bản stable mới nhất (phát hành 2026-06-15) |
| `@mysten/dapp-kit-react` | ^2.1.1 | 2.1.1 | chạy trên dapp-kit-core 1.5.0 |
| `@mysten/bcs` | ^2.1.0 | 2.1.0 | |
| `@mysten/seal` | ^1.2.0 | 1.2.0 | |
| `@mysten/zksend` | ^1.2.0 | 1.2.0 | |
| `@mysten/slush-wallet` | ^1.1.0 | 1.1.0 | |
| `@mysten/walrus` | ^1.2.0 | 1.2.0 | |
| `@mysten/payment-kit` | ^0.1.11 | 0.1.11 | |
| `@mysten/codegen` | ^0.10.6 | 0.10.6 | |

Baseline 2.18 là điểm neo: `deepbook-v3`, `seal`, `walrus`, `zksend`, `slush-wallet`
đều khai báo `@mysten/sui ^2.18.0` làm peer, nên chúng dịch chuyển đồng bộ.

---

## Dùng được ngay

### 1. Quy đổi tiền: ngừng dùng float JS

Ba chỗ scale số thập phân sang base unit (và ngược lại) bằng float-math:

- `suiPredictGateway.ts:217` và `:324`: `Math.floor(amountDusdc * 10 ** DUSDC_DECIMALS)`
- `walletBalanceService.ts:35,37`: `raw / 10 ** DECIMALS`

`@mysten/sui` 2.16.0 thêm `parseToUnits(amount, decimals)` và `parseToMist(amount)`, dùng
số học bigint thuần. Đây là sửa correctness thật, không phải cosmetic: một giá trị như
`0.07 * 1e6` có thể rơi vào `69999.99...` dưới IEEE-754, và `Math.floor` khi đó rớt mất
một đơn vị. Chiều hiển thị (`raw / 10 ** decimals`) ít rủi ro hơn nhưng cùng họ; nên dùng
một hàm format hiểu bigint cho đối xứng.

### 2. Chọn coin: dùng intent `coinWithBalance`

PTB mint đang chọn coin nạp bằng tay: `fetchDusdcCoins` gọi `suix_getCoins` thô, rồi
`mergeDusdcAndSplit` (`suiPredictGateway.ts:118-140`) merge coin sở hữu và split đúng số.
`@mysten/sui` 2.18.0 cung cấp `coinWithBalance({ type, balance })` như một transaction
intent dựng sẵn làm đúng việc này (gom coin sở hữu, merge, split) tại lúc build. Thay nó
vào sẽ bỏ được lời gọi RPC thô và ca biên mảng rỗng, còn PTB ký vẫn tương đương.
`tx.balance()` / `tx.coin()` là các helper auto-draw cùng họ trong bản phát hành đó.

Cả hai thay đổi đều chạm PTB mint (đường tiền), nên kiểm chứng bằng pre-flight devInspect
`simulateMintBinary` đã có sẵn: PTB mô phỏng vẫn phải pass và tương đương về hình dạng với
cái ví ký.

---

## Có sẵn nhưng không dùng (kèm lý do)

### Đường simulate của @mysten/sui (gRPC)

Đường dry-run hiện đại là `SuiGrpcClient.simulateTransaction` với tham số `include`;
trường `commandResults` chỉ có ở simulate và lỗi là discriminated union kiểm qua
`result.$kind === 'FailedTransaction'`. Pre-flight của dự án đang dùng
`client.devInspectTransactionBlock` trên `SuiClient` legacy — vẫn chạy tốt. Đáng biết nếu
data layer chuyển hẳn sang client gRPC, nhưng không có lý do để xáo trộn đường devInspect
đang chạy. Liên quan: 2.16.3 tự chèn một `ValidDuring` chỉ-cho-simulate nên các PTB
không-thanh-toán / chỉ-shared-object không còn bị từ chối khi simulate gas-budget; đây
đúng kiểu PTB mà claim pre-flight dựng, nên là một điểm cộng độ bền âm thầm đã có sẵn
trong bản pin.

### Helper order-book và swap của DeepBook v3

`deepbook-v3` 1.3.0-1.5.0 thêm primitive thực sự hữu ích cho UI order-book spot:
`cancelLiveOrder` / `cancelLiveOrders` (bỏ qua order id cũ thay vì abort), `getLevel2Range`
(độ sâu order-book), và các builder swap dựng sẵn (`swapExactBaseForQuote`,
`swapExactQuantity`, `*WithManager`). Không cái nào áp dụng ở đây: bề mặt này giao dịch một
**hợp đồng Move binary-options** (`predict::mint` / `predict::claim`, định giá qua một lời
gọi devInspect `get_trade_amounts`), không phải order book spot DeepBook. Data layer đọc
dynamic field của `PredictManager` trực tiếp; nó không mở order DeepBook. Các viability
helper read-only của 1.4.0 (`canPlaceLimitOrder`, `canPlaceMarketOrder`) còn bị giới hạn
trong ngữ cảnh margin-manager `deepbook_margin`, không phải spot. Không áp dụng.

### Reconnect + override per-call của dapp-kit-core 1.5.0 / 1.6.0

Core 1.5.0 cho phép `signTransaction` / `signAndExecuteTransaction` nhận override account
và network theo từng lời gọi; core 1.6.0 thêm auto-connect nhận biết khôi phục phiên
(`isReconnecting`, `autoConnectTimeout` cấu hình được, mặc định 5000ms). Dự án đang ở
react ^2.1.1 nằm trên core 1.5.0, nên tính năng 1.6.0 cần bump core, và **chưa xác nhận**
react layer có expose chúng qua hook không. Giá trị thấp cho app này (chỉ là UX reconnect),
nên hoãn.

### seal / zksend / walrus / payment-kit

Không có capability nào dùng được (hoặc kiểm chứng được) cho các package này trong range
đã pin, và `predict-club` cũng không import chúng. Không có việc gì để làm.

---

## Lưu ý

- Nhạy thời gian: `deepbook-v3` 1.5.0 phát hành một ngày trước nghiên cứu này và
  `dapp-kit-core` mới nhất đã là 1.6.0. Kiểm lại npm trước khi bump.
- Bản sửa `ValidDuring` của 2.16.3 được mô tả với simulate gas-budget bên trong
  `setGasBudget`, nên gọi nó là "devInspect" hơi lỏng nhưng về cơ bản đúng.
- Các helper read-only của DeepBook 1.4.0 là builder `margin_manager`, không phải helper
  balance-manager spot tổng quát, dù chúng ship trong `@mysten/deepbook-v3`.
- Việc react ^2.1.1 có expose override per-call của core 1.5.0 và cờ reconnect của 1.6.0
  hay không thì chưa xác nhận trực tiếp; kiểm type đã cài trước khi dựa vào.
- Một vài URL `docs.sui.io` / `sdk.mystenlabs.com` trả 404 khi kiểm chứng nhưng được
  backstop bằng mã nguồn package đã cài.

## Câu hỏi mở

1. React ^2.1.1 có thực sự expose override ký của core 1.5.0/1.6.0 và trạng thái reconnect
   qua hook không, hay cần bump core kèm wiring tay?
2. Override `ValidDuring` chỉ-cho-simulate của 2.16.3 có phủ hết claim pre-flight devInspect
   của dự án, hay vẫn có ca cần đặt expiration tường minh?

## Nguồn

- [CHANGELOG @mysten/sui](https://github.com/MystenLabs/ts-sdks/blob/main/packages/sui/CHANGELOG.md), [CHANGELOG typescript](https://github.com/MystenLabs/ts-sdks/blob/main/packages/typescript/CHANGELOG.md)
- [Transaction basics](https://sdk.mystenlabs.com/sui/transactions/basics), [signing & execution](https://sdk.mystenlabs.com/sui/transactions/signing-and-execution), [gRPC](https://sdk.mystenlabs.com/sui/grpc)
- [CHANGELOG deepbook-v3](https://github.com/MystenLabs/ts-sdks/blob/main/packages/deepbook-v3/CHANGELOG.md), [DeepBook v3 SDK](https://docs.sui.io/standards/deepbookv3-sdk), [swaps](https://docs.sui.io/standards/deepbookv3-sdk/dbv3-swaps), [npm versions](https://www.npmjs.com/package/@mysten/deepbook-v3?activeTab=versions)
- [dapp-kit overview](https://sdk.mystenlabs.com/dapp-kit), [React getting started](https://sdk.mystenlabs.com/dapp-kit/getting-started/react), [CHANGELOG dapp-kit-react](https://github.com/MystenLabs/ts-sdks/blob/main/packages/dapp-kit/packages/dapp-kit-react/CHANGELOG.md), [CHANGELOG dapp-kit-core](https://github.com/MystenLabs/ts-sdks/blob/main/packages/dapp-kit/packages/dapp-kit-core/CHANGELOG.md)
