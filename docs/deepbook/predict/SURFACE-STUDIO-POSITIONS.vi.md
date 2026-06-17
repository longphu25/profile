# Surface Studio Positions, Claim, Unwind, Multi-Manager - Tài liệu kỹ thuật

Tài liệu này mô tả drawer positions/history trong Predict Club Surface Studio (plan
23, phase S9) và phần multi-manager xây trên nó: cách một trader đã connect nhìn thấy
các vị thế thật mình đang giữ, claim một lệnh đã settle thắng, gỡ (unwind) một vị thế
còn live trước khi hết hạn, và đọc vị thế trên TẤT CẢ các PredictManager mà ví sở hữu
(không chỉ manager mới nhất).

Đây là phần hậu-giao-dịch bổ trợ cho `SURFACE-STUDIO-TRADE.md` (đường mint). Trade
ticket mint một vị thế từ ô heatmap, còn positions drawer là nơi các vị thế đó tồn
tại sau đó, với chain là nguồn sự thật.

Tài liệu liên quan:

- `docs/deepbook/predict/SURFACE-STUDIO-TRADE.md` - đường mint mà drawer này bổ trợ
  (cùng gateway, cùng kỷ luật pre-flight devInspect).
- `plugins/predict-club/DESIGN.md` - mục Surface Studio (ý đồ sản phẩm).

## Ý đồ thiết kế

Ba nguyên tắc định hình drawer, đều kế thừa từ trade ticket và áp vào phía đọc:

1. **Chain là nguồn sự thật, không phải localStorage.** Drawer liệt kê vị thế binary
   thật đọc từ PredictManager của trader trên chain. Hint `mintedKeys` trong
   localStorage (dùng tô màu heatmap) không bao giờ dùng ở đây; nó chỉ là marker cục
   bộ nhanh, không phải bản ghi sở hữu.
2. **Không bịa kết quả.** Drawer hiện stake, strike, side, expiry và một dòng ghi chú
   thắng/thua bằng ngôn ngữ đời thường. Nó không bịa con số lãi/lỗ hay đoán kết quả
   settle. Vị thế đã settle có claim được hay không là do hợp đồng quyết qua pre-flight
   chỉ-đọc, không bao giờ tự tính từ một settlement price mà UI không nắm chắc.
3. **Đọc thì miễn phí, ghi thì có cổng chặn.** Mọi claim/unwind đều đi trước bằng một
   pre-flight `devInspect` chỉ-đọc (0 gas, không hỏi ví). Nút ký chỉ hiện khi hợp đồng
   đồng ý. Chỗ duy nhất drawer rời khỏi chỉ-đọc là khi trader bấm Claim hoặc Unwind.

## Kiến trúc

```
StudioShell
  ├─ refreshPositions()
  │    └─ fetchAllManagersBinaryPositions(address)        ← đọc TẤT CẢ manager
  │         └─ fetchAllManagerIds → fetchManagerBinaryPositions (mỗi manager)
  │              └─ mỗi vị thế được gắn managerId sở hữu nó
  │
  └─ PositionsDrawer (presentational, ARIA dialog)
       ├─ classifyPosition → tách Live / Settled            (domain, thuần)
       ├─ positionOutcomeRule / positionLean → câu thắng/thua (domain, thuần)
       ├─ simulateClaim(position)  → pre-flight devInspect   (chỉ-đọc)
       ├─ onClaim(position)        → buildClaimTx → ký        (settled, tx thật)
       ├─ simulateRedeem(position) → pre-flight devInspect   (chỉ-đọc)
       └─ onRedeem(position)       → buildRedeemTx → ký       (live, tx thật)
```

| Lớp | File | Trách nhiệm |
| --- | --- | --- |
| Domain | `domain/studioPositions.ts` | `classifyPosition`, `positionSideLabel`, `positionStrikeUsd`, `positionMoneyness`, `positionKey`, `positionOutcomeRule`, `positionLean` - helper view thuần, có unit test |
| Infrastructure | `infrastructure/deepbookPredictPricingService.ts` | `fetchManagerBinaryPositions`, `fetchAllManagerIds`, `fetchAllManagersBinaryPositions`, `sanitizeClaimError`, `sanitizeRedeemError` |
| Infrastructure | `infrastructure/suiPredictGateway.ts` | `buildClaimTx`, `simulateClaim`, `buildRedeemTx`, `simulateRedeem` (chung `composeRedeemTx`) |
| Presentation | `presentation/studio/PositionsDrawer.tsx` | drawer trượt vào, vòng đời pre-flight + claim/unwind theo từng vị thế, liệt kê manager + toggle gộp |
| Presentation | `presentation/studio/StudioShell.tsx` | state positions, `refreshPositions`, bốn handler claim/unwind, đấu dây drawer |

Drawer là presentational và thân thiện unit test: nó tự giữ state vòng đời pre-flight
và claim/unwind theo từng vị thế, nhưng phần đọc chain và pipeline build/ký được tiêm
vào (`simulateClaim`, `onClaim`, `simulateRedeem`, `onRedeem`), nên nó không bao giờ
chạm trực tiếp wallet host hay RPC.

## Đọc vị thế

### Hình dạng vị thế

```ts
interface ManagerPosition {
  id: string                      // id object vị thế trên chain
  managerId: string               // PredictManager nào sở hữu vị thế này
  kind: 'binary' | 'range'
  oracleId: string
  expiry: number                  // ms, so với Date.now()
  quantity: number                // stake bằng DUSDC (đã descale từ raw)
  side?: 'ABOVE' | 'BELOW'        // chỉ binary
  strike?: number                 // USD, descale bằng PRICE_SCALE lúc đọc
  lowerStrike?: number            // chỉ range
  upperStrike?: number            // chỉ range
}
```

`managerId` là field thêm vào cho multi-manager. Không có nó, claim hay unwind không
thể nhắm đúng manager thực sự sở hữu vị thế (xem bên dưới).

### Một manager vs tất cả manager

```ts
// Một manager (mới nhất nếu managerId là null), chỉ nhánh binary.
fetchManagerBinaryPositions(walletAddress, managerId): Promise<ManagerPosition[]>

// Tất cả manager ví sở hữu, mới nhất trước.
fetchAllManagerIds(walletAddress): Promise<string[]>

// Vị thế binary trên TẤT CẢ manager, mỗi cái gắn managerId sở hữu.
fetchAllManagersBinaryPositions(walletAddress): Promise<ManagerPosition[]>
```

`fetchAllManagersBinaryPositions` đọc từng manager song song; một manager đọc lỗi chỉ
rơi về slice rỗng thay vì làm hỏng cả list. Drawer dùng read này cho cả view
per-manager lẫn view gộp, nên hai view không bao giờ bất đồng về thứ ví đang giữ.

`positionsSize` trên snapshot manager đếm số entry trong bảng vị thế cả đời của manager
(gồm cả slot quantity = 0 đã redeem), nên nó không phải số vị thế đang mở. Drawer lọc
`quantity <= 0n` lúc đọc, nên chỉ vị thế còn stake mới hiện.

### Vì sao multi-manager quan trọng

Một ví có thể giữ nhiều PredictManager: mỗi lần `create_manager` tạo một cái mới. Vị
thế rải khắp các manager. Read cũ chỉ dùng manager mới nhất (`fetchLatestManagerId` trả
`managers[0]` sắp theo checkpoint rồi tx_index), nên một ví có vị thế ở manager cũ chỉ
thấy một phần thứ mình giữ. Đọc trên tất cả manager mới làm history đầy đủ.

## Tách Live / Settled

```ts
classifyPosition(position, nowMs): 'live' | 'expired'
//   position.expiry > nowMs  → 'live'
//   ngược lại                 → 'expired' (settled)
```

`expiry` là expiry của oracle tính bằng mili giây, mang thẳng từ `oracle.expiry` và so
với `Date.now()` ở mọi nơi phía trên, nên việc tách dùng cùng một đồng hồ. Vị thế chỉ
settle (và có thể claim được) sau khi hết hạn, nên drawer cung cấp:

- **Unwind** ở nhóm Live (bán lại cho AMM trước khi hết hạn).
- **Claim** ở nhóm Settled (thu một lệnh thắng đã settle).

Một tick 1 giây làm đếm ngược live chạy; chỉ kích hoạt khi có ít nhất một vị thế live,
nên list chỉ-settled đứng yên.

## Quy tắc Thắng / Thua và Lean hiện tại

Drawer hiện một quy tắc payout bằng ngôn ngữ đời thường để trader đọc được lệnh phụ
thuộc vào gì mà không phải tự suy từ UP/DOWN cộng một strike:

```ts
positionOutcomeRule(position): { winsWhen, losesWhen } | null
//   UP   (ABOVE): thắng khi "settles above $X",  thua "at or below $X"
//   DOWN (BELOW): thắng khi "settles below $X",  thua "at or above $X"
```

Với vị thế live nó còn hiện forward hiện tại đang nghiêng về đâu, như một gợi ý thô
(không phải dự đoán; hợp đồng settle lúc hết hạn):

```ts
positionLean(position, forward): 'winning' | 'losing' | 'atStrike' | null
//   trong vòng 0.05% của strike đọc thành 'atStrike' thay vì thắng/thua gây nhầm
```

Đây là các hàm domain thuần, có unit test, không phụ thuộc DOM hay mạng.

## Claim và Unwind (đường ghi)

Cả hai dùng chung `composeRedeemTx` của gateway, build cùng một hình dạng PTB 7-tham-số
(Predict, PredictManager, OracleSVI, MarketKey, U64 quantity, Clock, TxContext, đã xác
nhận với package). Chỉ tên function khác nhau:

| Hành động | Function hợp đồng | Khi nào hợp lệ |
| --- | --- | --- |
| Claim (payout đã settle) | `predict::redeem_permissionless` | sau khi oracle settle; nút Claim ký cái này |
| Unwind (bán lại lúc còn live) | `predict::redeem` | chỉ khi còn live; abort `assert_quoteable_oracle` khi đã settle |

> Không có function `predict::claim`. Đường payout-đã-settle là
> `redeem_permissionless`. Giả định ban đầu rằng có entry `claim` đã bị bác bỏ khi đối
> chiếu với package live qua `getNormalizedMoveModule`; probe
> (`scripts/predict-club-probe.mjs`) xác nhận đúng function và hình dạng 7-tham-số.

### Kỷ luật pre-flight (chỉ-đọc)

```ts
simulateClaim(position)  → gateway.simulateClaim(...)  → devInspect(composeClaimTx)
simulateRedeem(position) → gateway.simulateRedeem(...) → devInspect(composeUnwindTx)
```

Pre-flight build PTB thật và chạy qua `devInspectTransactionBlock` (0 gas, không hỏi
ví). Hợp đồng là nguồn sự thật: nút Claim chỉ hiện khi pre-flight claim thành công; nút
Unwind chỉ hiện khi pre-flight unwind thành công. Vị thế thua, chưa settle, hoặc đã
claim hiện lý do chỉ-đọc của hợp đồng thay cho nút.

### Nhắm đúng manager sở hữu (cốt lõi)

Mỗi handler claim/unwind trong StudioShell phân giải manager như sau:

```ts
const managerId =
  position.managerId ?? predictManagerId ?? (await gateway.fetchManagerId(address))
```

`position.managerId` đứng trước. Đây là thứ làm claim/unwind multi-manager chính xác:
một vị thế ở manager cũ build PTB nhắm vào manager đó, không phải cái mới nhất. Các
fallback (`predictManagerId`, rồi `fetchManagerId` mới) chỉ áp cho vị thế không có tag
manager, vốn không nên xảy ra với vị thế đọc-từ-chain nhưng giữ cho đường đi toàn vẹn.

Quantity được luồn qua dưới dạng `u64` (đơn vị DUSDC raw qua `dusdcToUnits`, hàm nhận
con số DUSDC người-dùng; `1.0` thành `1000n` ở 6 decimals) giữa MarketKey và tham số
Clock. Chuyển đổi bigint chính xác, không bao giờ `Math.floor(x * 10 ** decimals)`.

### Ký

Đường ghi thật ký qua wallet host:

```ts
const txResult = await host.signAndExecuteTransaction(tx)
refreshPositions()   // đọc lại chain để dòng phản ánh trạng thái mới
return { ok: true, digest: txResult.digest ?? '' }
```

Việc người ký từ chối hay RPC lỗi được bắt và map sang câu thân thiện
(`sanitizeClaimError` / `sanitizeRedeemError`); không bao giờ throw ra khỏi handler.

## Giao diện drawer

`PositionsDrawer.tsx` là một sheet trượt vào từ phải (`data-pc-studio-positions`), một
ARIA dialog: trap Tab, Escape ở cấp document đóng nó (nên người dùng chuột mở từ status
band vẫn đóng được bằng Escape), và một backdrop trong suốt đóng khi click ra ngoài.
Khớp pattern dialog của trade ticket.

### Trạng thái

| Trạng thái | Hiển thị |
| --- | --- |
| Chưa connect | empty state, `data-pc-studio-positions-connect` "Connect Wallet" |
| Đã connect, không vị thế | empty state "No positions yet" |
| Đã connect, có vị thế | roll-up + điều khiển manager (nếu nhiều) + nhóm Live/Settled |

### Roll-up

Một dải tóm tắt hoàn toàn từ verdict của hợp đồng, không bao giờ từ settlement price:

| Stat | Ý nghĩa |
| --- | --- |
| Live | số vị thế còn đang chạy |
| Win | vị thế settled mà pre-flight claim thành công (claim được) |
| Claimed | claim đã xác nhận trong phiên này |
| No payout | vị thế settled mà pre-flight abort |
| Checking | pre-flight còn đang chạy |

"No payout" gộp một cách trung thực vị thế thua và vị thế đã claim ở phiên trước: hợp
đồng abort `redeem_permissionless` giống hệt nhau cho cả hai, nên UI không thể tách
đáng tin và không giả vờ tách được. Roll-up luôn tính trên tất cả manager, nên tổng
nhìn-thoáng không đổi khi trader chuyển giữa view gộp và view per-manager.

### Liệt kê manager và toggle gộp

Đây là UX multi-manager. Mặc định là **liệt kê manager riêng**, không bao giờ âm thầm
gộp:

- Khi ví giữ **một** manager: một view Live/Settled gộp duy nhất (không có gì để tách).
- Khi ví giữ **nhiều hơn một** manager: mỗi manager là một nhóm có nhãn riêng
  (`ManagerHeader`: "Manager N", id rút gọn `0x1234...abcd`, và tag "newest" ở index
  0). Một dải điều khiển hiện số manager và một toggle
  (`data-pc-studio-positions-combine`) đọc **Combine all** / **List separately**.

```ts
const showCombined = combineManagers || !multiManager
```

Gộp là lựa chọn rõ ràng của trader, mặc định tắt. Đây đúng là hành vi chủ sản phẩm yêu
cầu: phơi mọi manager ra, rồi để người dùng quyết có gập chúng vào một view không, thay
vì drawer tự gộp.

`positionKey` bao gồm `managerId` để hai lệnh giống hệt nhau (cùng oracle, expiry,
side, strike) ở hai manager khác nhau không bao giờ đụng key React hay state pre-flight
theo từng vị thế:

```ts
positionKey(position) =
  `${managerId}|${oracleId}|${expiry}|${side ?? 'NONE'}|${strike ?? 0}`
```

## Nhịp refresh

`refreshPositions` đọc lại tất cả manager:

- khi đổi ví/manager,
- sau một mint đã xác nhận (vị thế mới giờ sống trên chain),
- sau một claim hoặc unwind đã xác nhận (trạng thái vị thế đã đổi),
- trên timer chậm `POSITIONS_REFRESH_MS = 30_000` khi đang connect.

Không refetch theo từng tick oracle; đọc vị thế là vài lệnh RPC mỗi manager (dynamic
fields cộng một lần đọc object mỗi vị thế), nên nhịp cố ý chậm và theo sự kiện.

## Pill ví trên header (liên quan)

Cạnh drawer, pill nav HTML tĩnh hiện số dư SUI và DUSDC của ví đang connect
(`data-wallet-sui`, `data-wallet-dusdc`). Pill nằm ngoài cây React của plugin, nên
orchestrator Surface Studio điều khiển trực tiếp: "loading..." khi đang fetch, con số
khi xong, "-" khi ngắt kết nối, poll cùng nhịp 30s. Một lần poll refresh không làm giá
trị tốt cuối cùng nháy về lại "loading...".

`KNOWN_DECIMALS` của popup wallet-profile đã sửa để gồm DUSDC và PLP ở 6 decimals (cả
hai trước đó mặc định 9, làm PLP hiện lớn gấp 1000 lần), và popup hiện "Loading..." cho
các field manager khi snapshot đang phân giải thay vì "0" gây nhầm.

## Hằng số (đã xác minh trong code)

| Hằng số | Giá trị | Nguồn |
| --- | --- | --- |
| Function claim | `predict::redeem_permissionless` | gateway `composeClaimTx` |
| Function unwind | `predict::redeem` | gateway `composeUnwindTx` |
| Tham số PTB redeem | Predict, Manager, Oracle, MarketKey, u64 qty, Clock | `composeRedeemTx` |
| DUSDC decimals | `6` | gateway |
| Price scale (descale strike) | `1_000_000_000` | pricing service |
| Refresh positions | `30_000` ms | StudioShell |
| Dải tại-strike (lean) | `0.05%` | `positionLean` |
| Explorer tx base | `https://suiscan.xyz/testnet/tx` | drawer |

## Kiểm chứng

- **Unit** (`tests/unit/predict-club-studio-positions.test.ts`, bun:test):
  `classifyPosition` (live/expired quanh now), `positionSideLabel`,
  `positionStrikeUsd`, `positionMoneyness`, `positionOutcomeRule` (câu thắng/thua
  UP/DOWN), `positionLean` (winning/losing/atStrike), `positionKey` ổn định và phân
  biệt theo manager để lệnh xuyên-manager không đụng nhau, và các map
  `sanitizeClaimError`. 148 unit test pass toàn bộ suite.
- **Smoke** (`scripts/predict-club-studio-smoke.mjs`, headless): nút positions mở
  drawer, drawer lúc chưa connect hiện Connect, Escape đóng nó, không tràn ngang
  desktop + mobile, không lỗi console nghiêm trọng. 20 check pass.
- **Probe** (`scripts/predict-club-probe.mjs`): đọc vị thế thật cho một ví và chạy
  pre-flight claim/unwind với package live; đây là thứ xác nhận `redeem_permissionless`
  và hình dạng 7-tham-số, và là thứ phơi ra bug thiếu-quantity và sai-function trong
  đường claim ban đầu.

Chạy chúng:

```bash
bun run build
bun run test:unit
bun scripts/predict-club-studio-smoke.mjs   # với server dev/preview đang chạy
```

## Map lỗi

| Triệu chứng cấp thấp | Lý do hiện cho người dùng |
| --- | --- |
| `redeem_permissionless` abort, chưa settle | "Not settled yet - this position is still live." |
| abort đã claim | "Already claimed." |
| abort payout = 0 | "This position lost - nothing to claim." |
| `redeem` abort khi đã settle (`assert_quoteable_oracle`) | "Cannot unwind right now." |
| người ký từ chối | "You rejected the transaction in your wallet." |
| MoveAbort khó hiểu | "This position lost or has already been claimed." (không dump raw) |

Hợp đồng abort giống nhau cho vị thế thua và vị thế đã claim, nên câu lỗi claim và stat
roll-up "No payout" đều giữ trung thực về sự mập mờ đó thay vì bịa ra phân tách
thua-vs-đã-claim sạch sẽ.
