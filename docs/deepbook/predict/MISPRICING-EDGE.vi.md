# Mispricing Edge: "bên nào đang bị định giá sai"

Surface Studio nói gì khi gắn cờ một bên là "đang có value", phát biểu chính xác để
UI không bao giờ thổi phồng. Đây là tín hiệu edge trung thực duy nhất trong sản
phẩm: nó KHÔNG dự đoán BTC sẽ lên hay xuống (giá đó là ngoại sinh, không thể biết
trước), nó chỉ nói hợp đồng đang thu nhiều hơn hay ít hơn so với giá trị mà một mô
hình biến động (volatility) cho là đúng, ngay tại thời điểm này.

## Ý tưởng trong một dòng

Edge = (cái hợp đồng đang thu) trừ đi (cái mô hình nói nó đáng giá).
Hai ước lượng độc lập của cùng một xác suất thắng. Khi chúng lệch nhau, khoảng lệch
đó chính là mispricing, và bên nào "rẻ hơn so với giá trị thật" là bên có value.

## Hai xác suất

Cả hai con số đều là xác suất thắng cho bên UP của một strike binary, trong [0, 1].
Hợp đồng binary trả 1 DUSDC mỗi contract khi thắng, nên một xác suất thắng và một
giá fair cho mỗi contract là cùng một con số.

### 1. Xác suất fair theo mô hình (miễn phí, tính cục bộ bằng SVI)

Tính cục bộ từ mặt cong biến động SVI của oracle, không gọi mạng. Với strike K so
với forward F:

```
k  = ln(K / F)                        log-moneyness
w  = SVI total variance tại k         a + b*(rho*(k-m) + sqrt((k-m)^2 + sigma^2))
d2 = -((k + w/2) / sqrt(w))
pUp = N(d2)                           N = hàm phân phối chuẩn tích lũy (CDF)
```

`pUp` là xác suất theo mô hình rằng BTC settle cao hơn K. DOWN là `1 - pUp`. Đây
đúng là `computeFairValue` mà payout preview dùng, nên IV trên heatmap, smile, và
edge đều đọc cùng một mặt cong nhất quán.

Nguồn: `plugins/predict-club/domain/payoutPreview.ts` (`computeFairValue`,
`totalVarianceAtLogMoneyness`).

### 2. Xác suất hợp đồng ngụ ý (một lần devInspect quote)

Hỏi hợp đồng, read-only, rằng nó sẽ thu bao nhiêu để mint bên UP tại strike đó. Chi
phí mint cho mỗi contract CHÍNH LÀ xác suất thắng ngụ ý (mỗi contract trả 1 DUSDC
khi thắng, nên cost-per-contract cũng nằm trong [0, 1]):

```
quote = devInspect predict::get_trade_amounts(oracle, marketKey(K, isUp), 10 contracts)
impliedProbability = mintCostDusdc / 10
```

Đây là giá của thị trường, đã nướng sẵn đường cong AMM và house edge vào trong. Đây
là phần duy nhất của edge tốn một vòng gọi mạng, nên nó chỉ được quote cho ATM band
của cột đang chọn, cache theo (oracle, strike) trong 20s, và giới hạn tối đa 3 quote
chạy đồng thời.

Nguồn: `plugins/predict-club/infrastructure/deepbookPredictPricingService.ts`
(`quoteBinaryStrike`), điều phối bởi
`plugins/predict-club/application/mispricing.ts` (`getMispriceCell`).

## Đọc edge thế nào

```
edge = contractProbability - fairProbability
```

| dấu của edge | nghĩa | value nằm ở đâu |
|--------------|-------|-----------------|
| `edge > 0` | hợp đồng định giá UP đắt hơn mô hình | UP đang đắt, value lệch về DOWN (edge bán UP) |
| `edge < 0` | hợp đồng định giá UP rẻ hơn mô hình | UP đang bị định giá thấp, value lệch về UP (edge mua UP) |
| `edge ~ 0` | hợp đồng và mô hình đồng ý | không có edge, đừng hành động theo nhiễu |

Ví dụ cụ thể: mô hình nói UP đáng giá 0.45 (45% settle cao hơn K), hợp đồng thu 0.52
cho mỗi contract UP. `edge = 0.52 - 0.45 = +0.07`. Hợp đồng đang bán UP với giá 52
xu trong khi mô hình định giá 45 xu, nên UP đắt 7 điểm, bên tương đối rẻ là DOWN.

Studio thể hiện cái này bằng một caret chỉ về bên có value cộng với edge tính theo
điểm, mờ khi edge yếu và có chip nền khi edge mạnh, và không hiện gì khi dưới ngưỡng
nhiễu. Caret là tín hiệu chính an toàn cho người mù màu; con số là lớp mã hóa thứ
hai.

## Overround và net-of-vig edge

Edge thô ở trên có một điểm mù: xác suất hợp đồng ngụ ý đã chứa biên nhà cái, nên một
edge dương nhỏ có thể toàn bộ là biên đó chứ không phải value thật. Muốn thấy biên đó
phải quote CẢ HAI bên:

```
pUp   = xác suất hợp đồng ngụ ý cho UP   (một lần devInspect quote)
pDown = xác suất hợp đồng ngụ ý cho DOWN (một lần devInspect quote nữa)
overround = pUp + pDown - 1
```

Một thị trường hai kết cục công bằng sẽ định giá hai bên cộng đúng thành 1. Phần vượt
quá 1 là overround, là vig, là biên nhà cái nướng vào cả hai giá. Trên một quote
testnet thật con số này dương: hợp đồng bán cả hai bên hơi đắt để cái book có lợi thế
trước trader.

Net-of-vig edge bỏ biên đó đi trước khi so với mô hình:

```
devigUp = pUp / (pUp + pDown)        chuẩn hoá để hai bên cộng thành 1
netEdge = devigUp - fairProbability  phần mispricing KHÔNG phải biên nhà cái
```

`netEdge` là phần lệch giá thật sự đáng đánh. Edge thô vẫn là tiêu đề (và vẫn lái
caret heatmap như cũ), nhưng Studio hiện overround cùng một cột `Net` bên cạnh để
trader phân biệt mispricing thật với vig. Quy tắc nhanh: một edge nhỏ hơn overround
thì phần lớn là biên nhà cái, không phải value. Cả `overround` và `netEdge` đều null
khi thiếu một bên quote, nên tín hiệu suy giảm chứ không bịa ra biên.

## Cái này KHÔNG phải là gì (ranh giới trung thực)

- **Không phải dự đoán hướng BTC.** Không con số nào nói BTC sẽ tăng. Cả hai đều là
  xác suất rút ra từ mặt cong biến động hiện tại và quote hiện tại. Giá settlement do
  thị trường quyết, không do tín hiệu này.
- **Không phải thắng chắc.** Edge dương nghĩa là giá trông đắt so với một mô hình; mô
  hình có thể sai, mặt cong có thể cũ (stale), và một vòng đơn lẻ vẫn là tung đồng xu.
  Edge là kỳ vọng qua nhiều lần đặt, không phải lời hứa cho một lần.
- **Không thoát khỏi house edge.** Xác suất hợp đồng ngụ ý đã bao gồm biên AMM/nhà
  cái rồi, nên một edge tí hon không vượt qua được biên đó thì không phải value thật.
  Chỉ hành động khi khoảng lệch rõ ràng cao hơn ngưỡng nhiễu.
- **Suy biến chứ không bịa.** Nếu cột không có SVI, bên fair là null và không hiện
  edge. Nếu devInspect quote lỗi (strike ngoài biên hợp đồng, oracle cũ), bên hợp
  đồng là null và ô hiện lý do, không đoán một con số. `edge` là null bất cứ khi nào
  một trong hai đầu vào là null.

## Nằm ở đâu

| Hạng mục | File |
|----------|------|
| Xác suất fair (SVI) | `plugins/predict-club/domain/payoutPreview.ts` |
| Xác suất hợp đồng ngụ ý | `plugins/predict-club/infrastructure/deepbookPredictPricingService.ts` (`quoteBinaryStrike`) |
| Lắp ráp edge + cache + giới hạn đồng thời | `plugins/predict-club/application/mispricing.ts` |
| Hình dạng ô (`fairProbability`, `contractProbability`, `contractProbabilityDown`, `overround`, `netEdge`, `edge`, `reason`) | `plugins/predict-club/domain/volSurface.ts` (`MispriceCell`) |
| Trình bày (caret, edge điểm, ATM band) | `plugins/predict-club/presentation/studio/` (`VolHeatmap`, `EdgePanel`, `SmileSlice`) |

Xem thêm `SURFACE-STUDIO-TRADE.vi.md` (edge đi vào trade ticket thế nào) và
`COMPETITORS.md` (CRASH by Suize, cùng cơ chế UP/DOWN mà tín hiệu này áp dụng).
