# Surface Studio Trade Ticket - Tham chiếu kỹ thuật

Tài liệu này mô tả đường submit trực tiếp được thêm vào Surface Studio của Predict
Club (plan 23, phase S7): trader đã connect ví click một ô trên heatmap biến động,
chọn hướng, nhập size, và mint một vị thế binary cá nhân ngay từ chính mặt surface
họ đang đọc. Đây là phần execute bổ sung cho các panel decision-support của studio
(heatmap, smile, edge, arb-free, time-travel).

Tài liệu liên quan:

- `docs/deepbook/predict-club-devinspect-pricing.md` - đường quote devInspect và công
  thức fair-value SVI mà tính năng này tái dùng.
- `docs/deepbook/predict-club-data-contract.md` - hình dạng dữ liệu oracle/SVI/price
  và bảng map lỗi quote.
- `docs/deepbook/mint-position-guide.md` - luồng mint PTB thô và quy tắc scale.
- `plugins/predict-club/DESIGN.md` - mục Surface Studio (ý đồ sản phẩm).

## Ý đồ thiết kế

Studio là phân-tích-trước. Mỗi panel phải tự xứng đáng vị trí của nó như một công cụ
hỗ trợ ra quyết định, và hành động duy nhất nó cung cấp - một trade ticket trên ô
heatmap - được tiếp cận *từ* phân tích đó, không bao giờ ngược lại. Ba nguyên tắc
định hình phần triển khai:

1. **Edge là gợi ý, không phải lời khuyên.** Ticket hiện xác suất thắng fair theo
   model (từ SVI) và xác suất contract-implied khi có quote, và làm nổi bên model
   thấy có value. Người dùng luôn tự chọn UP hay DOWN.
2. **Không bịa payout.** Chỉ hiện stake và xác suất model. Cost, gross-if-win, và lợi
   nhuận không được bịa; contract là nguồn sự thật tại thời điểm mint.
3. **Không bao giờ để một strike chắc chắn revert chạm tới ví.** Một pre-flight
   read-only bắt strike contract không định giá được *trước khi* yêu cầu người dùng ký.

## Kiến trúc

Tính năng được tách sao cho phần orchestration thuần và unit-test được, UI thuần
trình bày, và các cạnh có side-effect duy nhất là gateway và wallet host.

```
VolHeatmap (click ô)
   └─ onCellSelect(column, cell, anchorRect)
        └─ StudioShell: setTicket({ cell, column, anchorRect })
             └─ TradeTicket (popover, thuần trình bày)
                  └─ onSubmit(direction, amount)
                       └─ StudioShell.handleSubmit
                            └─ submitStudioTrade(params, deps)   ← orchestration thuần
                                 ├─ evaluateRiskGate(riskInput)  (domain)
                                 ├─ preflightQuote()             (devInspect, read-only)
                                 ├─ gateway.buildMintTx(...)     (infrastructure)
                                 └─ signAndExecute(tx)           (wallet host)
```

| Tầng | File | Trách nhiệm |
| --- | --- | --- |
| Domain | `domain/riskGate.ts` | `evaluateRiskGate` - cổng an toàn (tái dùng, không đổi) |
| Domain | `domain/payoutPreview.ts` | fair value SVI `computeFairValue` (tái dùng) |
| Application | `application/submitStudioTrade.ts` | `recommendDirection`, `buildStudioRiskInput`, `submitStudioTrade` |
| Infrastructure | `infrastructure/suiPredictGateway.ts` | `buildMintTx` (dùng chung với cockpit `joinQuickRound`) |
| Infrastructure | `infrastructure/deepbookPredictPricingService.ts` | `quoteBinaryStrike` (devInspect, tái dùng cho pre-flight) |
| Presentation | `presentation/studio/TradeTicket.tsx` | form popover + states + a11y |
| Presentation | `presentation/studio/VolHeatmap.tsx` | wiring click ô `onCellSelect` |
| Presentation | `presentation/studio/StudioShell.tsx` | state ticket + wiring deps `handleSubmit` |

Vì sao dùng helper riêng cho studio thay vì tái dùng `executeTradeplan`?
`executeTradeplan` mang theo bookkeeping của club/member và mutate một `ClubState` mà
Studio không sở hữu. Studio mint một vị thế cá nhân độc lập, nên nó dùng chung gateway
và risk gate nhưng bỏ hẳn tầng club. `PredictClubContext.tsx` không bị đụng tới, giữ
blast radius nhỏ.

## Pipeline Submit

`submitStudioTrade(params, deps)` chạy bốn stage và trả về một
`{ ok, digest?, error? }` phẳng để ticket render success hoặc đúng lý do bị chặn mà
không throw.

### Stage 1 - Risk gate

`evaluateRiskGate(deps.riskInput)` là cổng an toàn domain, tái dùng nguyên vẹn từ
cockpit. Studio dựng input qua `buildStudioRiskInput`:

```ts
buildStudioRiskInput({
  expiryMs, nowMs?, oracleStatus, oracleLastUpdateMs,
  hasSvi, hasForward, memberDusdc, amountDusdc,
  walletConnected, managerReady,
}): RiskGateInput
```

Ngữ nghĩa quan trọng:

- `indicators: []` là cố ý. `computeConsensus([])` cho ra `'neutral'` (không phải
  `'no-trade'`), nên check signal-bias **pass**. Gate khi đó rút về các điều kiện an
  toàn thật: oracle sống/active, có SVI + forward, expiry đủ an toàn
  (`MIN_SAFE_EXPIRY_MINUTES`), đủ DUSDC, ví connected, manager sẵn sàng.
- `signalBias: 'neutral'` khớp với consensus indicator rỗng.
- `quoteAvailable` / `vaultAvailable` để **undefined**. Chúng ở mức cảnh báo và nếu
  không sẽ chặn mọi ô ngoài dải ATM đã quote. Pre-flight contract (stage 2) mới là
  cổng strike thật.
- `expiryMinutes = Math.max(0, Math.floor((expiryMs - now) / 60_000))`.
- `oracleActive`: `'active' → true`, chuỗi khác `→ false`, `null → null`.

Nếu `!risk.canExecute`, hàm trả `{ ok: false, error }` với các lý do blocking +
warning gộp lại - không quote, không build, không ký.

> Lưu ý: check oracle-staleness của `evaluateRiskGate` đọc `Date.now()` thật bên trong
> (không có clock inject). Unit test neo các trường freshness vào `Date.now()` thay vì
> một timestamp cố định; xem helper `liveRiskParams()` trong file test.

### Stage 2 - Pre-flight contract (read-only)

Heatmap cho trader click bất kỳ ô nào trên cả mặt surface, nhưng contract chỉ định giá
các strike gần forward. Một strike ngoài biên đó sẽ abort on-chain:

```
MoveAbort in pricing_config::quote_spread_from_fair_price, abort code 1
```

Đây đúng là abort quan sát được khi test lúc mint một strike xa ATM. Để tránh yêu cầu
người dùng ký một giao dịch sẽ revert, pipeline chạy một quote `devInspect` read-only
trước - **chính đường đã được chứng minh** mà mispricing ladder dùng
(`quoteBinaryStrike` → `predict::get_trade_amounts`), vốn kích hoạt cùng hàm
`quote_spread_from_fair_price` với **0 gas và không popup ví**.

```ts
deps.preflightQuote?: () => Promise<{ ok: boolean; reason?: string }>
```

StudioShell cung cấp nó:

```ts
preflightQuote: async () => {
  const quote = await quoteBinaryStrike({
    oracleId: column.oracleId,
    expiry: expiryMs,
    strikeUsd: cell.strike,
    isUp: direction === 'UP',
    tickSize, minStrike,
    walletAddress: address,
  })
  // implied probability null = contract từ chối định giá strike này (ngoài biên)
  return quote.impliedProbability != null
    ? { ok: true }
    : { ok: false, reason: quote.reason }
}
```

`sanitizeContractQuoteReason` (trong pricing service) map abort thô
`quote_spread_from_fair_price` thành thông báo thân thiện (`PRICING_BOUNDS_REASON`:
chọn strike gần hơn / oracle active). Nếu pre-flight trả `ok: false`, pipeline trả
`{ ok: false, error: reason }` và ticket hiện nó. Dep pre-flight là optional để phần
lõi gate/build/sign vẫn unit-test được mà không cần node thật.

### Stage 3 - Dựng PTB mint

`deps.gateway.buildMintTx(...)` là **đúng hàm** đường cockpit đã chứng minh
(`joinQuickRound`) dùng, nên manager/deposit/market-key/mint giống hệt một mint
known-good. Nó dựng một PTB duy nhất:

1. Merge + split DUSDC cho lượng stake.
2. `predict_manager::deposit` vào manager.
3. `market_key::up` hoặc `market_key::down` (oracleId, expiry, strike đã snap).
4. `predict::mint` (PredictID, manager, oracle, marketKey, amountRaw, clock).

### Stage 4 - Ký

`deps.signAndExecute(tx)` là lời gọi wallet host. StudioShell nối qua DApp-Kit host:

```ts
signAndExecute: async (tx) => {
  const txResult = await host.signAndExecuteTransaction(tx)
  return { digest: (txResult as { digest?: string }).digest ?? '' }
}
```

Khi thành công: `{ ok: true, digest }`. Ví từ chối hoặc RPC lỗi được catch và trả về
`{ ok: false, error }` - không bao giờ throw ra khỏi pipeline.

## Chuỗi đơn vị Strike (quan trọng)

Strike của ô heatmap là giá trị **USD** (forward của heatmap là `price.forward / 1e9`,
và strike dựng từ forward đó). `buildMintTx` nhận strike dạng USD rồi tự áp scale:

```ts
const STRIKE_SCALE = 1e9
function snapStrike(usd, tickSize, minStrike) {
  const raw = Math.floor(usd * STRIKE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}
```

Nên studio truyền strike cho gateway **chưa scale (USD)** - không chia hay nhân ở tầng
studio. Điều này khác `joinQuickRound`, vốn chia strike nguồn cho `STRIKE_SCALE` vì
nguồn đó đã là raw (`round.config.strike`). Một unit test khẳng định trực tiếp:

```ts
expect(gateway.calls[0].strike).toBe(65_000) // 65,000 USD tới gateway nguyên vẹn
```

Cùng `tickSize` / `minStrike` được truyền cho cả quote pre-flight và mint để strike
sau khi snap khớp giữa lần đọc và lần ghi.

## Gợi ý hướng

```ts
recommendDirection(fairProbability, contractProbability): 'UP' | 'DOWN' | null
```

- Trả `'UP'` khi `fair > contract` (bên UP đang bị định giá thấp = value).
- Trả `'DOWN'` khi `fair < contract`.
- Trả `null` khi thiếu một bên, hoặc khi
  `Math.abs(fair - contract) < DIRECTION_EDGE_EPS` (0.005) - chênh lệch trong vùng
  nhiễu thì không gợi ý.

Điều này khớp dải edge "fair vs contract" của cockpit để hai surface đồng thuận về cái
gì tính là edge thật. Đây chỉ là gợi ý; ticket làm nổi bên được gợi ý nhưng người dùng
vẫn tự chọn.

## UI Trade Ticket

`TradeTicket.tsx` là popover thuần trình bày neo tại ô được click
(`data-pc-studio-ticket`). Nó sở hữu state form cục bộ (direction, amount, vòng đời
submit) nhưng inject gate → preflight → build → sign qua prop `onSubmit`, nên không
bao giờ chạm wallet host trực tiếp.

### Nội dung

- Header: `"<asset> above $<strike>?"` + `"settles in <expiry>"` (cách diễn đạt dễ cho
  người mới thay vì strike/expiry thô).
- Toggle UP / DOWN; bên được gợi ý có viền cùng nhãn nhỏ "model sees value".
- Fair % theo model (luôn có, từ SVI). Contract % khi ô nằm trong dải đã quote, ngược
  lại "not quoted".
- Input stake (DUSDC) + chip nhanh `[10, 25, 50]`, validate theo `balances.dusdc`.

### Các state

| State | Hành động / thông báo render |
| --- | --- |
| Chưa connect | `data-pc-studio-ticket-connect` "Connect Wallet" (gọi `onConnect`) |
| Đã connect, sẵn sàng | `data-pc-studio-ticket-submit` "Submit `<dir>` - stake `N` DUSDC" |
| Chưa có manager | chặn: "Create a PredictManager first" |
| Thiếu DUSDC | chặn: "Need `N` DUSDC, have `M`" |
| Đang submit | spinner (reduced-motion: không quay) |
| Thành công | `SuccessView`: digest rút gọn + link suiscan |
| Lỗi | chuỗi lỗi của pipeline (vd lý do ngoài biên, ví từ chối) |

`EXPLORER_TX = 'https://suiscan.xyz/testnet/tx'`.

### Accessibility

- `role="dialog"`, `aria-modal="true"`, focus dialog khi mount.
- Tab bị trap trong popover.
- Một listener Escape **cấp document** đóng ticket bất kể focus ở đâu, nên một mouse
  user vừa click ô (focus không nằm trong dialog) vẫn đóng được bằng Escape. Cái này
  thay cho `onKeyDown` chỉ-trong-dialog trước đó vốn chỉ fire khi focus nằm bên trong.
- Một backdrop click-outside trong suốt cũng đóng.

## Thay đổi Heatmap liên quan (S7)

Hai fix về độ-đọc của heatmap ship kèm ticket:

- **Nhãn strike đầy đủ USD.** `formatStrike` giờ render giá đầy đủ (`$63,951`) thay vì
  làm tròn về `64k`. Việc làm tròn gộp các strike liền nhau thành nhãn giống hệt nhau,
  khiến không thể ra quyết định thật. Cột row-header strike được nới rộng để vừa; smoke
  xác nhận không tràn ngang.
- **IV smile mượt.** Lát smile resample dày đường total-variance SVI
  (`CURVE_SAMPLES = 96`) thay vì nối hơn chục strike đã lấy mẫu bằng đoạn thẳng (vốn ra
  hình "V" gãy góc). Nó được vẽ trong không gian pixel thật qua một `ResizeObserver` -
  không kéo dãn `preserveAspectRatio="none"` - nên marker ATM tròn đúng và độ dốc giữ
  tỉ lệ thật. Edge panel giờ nằm trên smile ở cột phải.

## Hằng số (đã verify trong code)

| Hằng số | Giá trị | Nguồn |
| --- | --- | --- |
| Network | `testnet` | gateway / pricing service |
| Package ID | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` | gateway |
| Predict ID | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` | gateway |
| DUSDC type | `0xe95040…::dusdc::DUSDC` | gateway |
| Clock ID | `0x6` | pricing service |
| Predict server | `https://predict-server.testnet.mystenlabs.com` | gateway |
| Strike scale | `1e9` | `snapStrike` |
| DUSDC decimals | `6` | gateway |
| Contract unit | `10^6` quote base units = 1 contract | pricing service |
| Tick size mặc định | `1_000_000_000` ($1) | StudioShell fallback |
| Min strike mặc định | `50_000_000_000_000` ($50,000) | StudioShell fallback |
| Direction edge epsilon | `0.005` | `submitStudioTrade` |
| Curve samples (smile) | `96` | `SmileSlice` |
| Quote contracts (pre-flight) | `10` | pricing service |

## Kiểm chứng

Công việc S7 được kiểm chứng ở bốn cấp trước commit checkpoint:

- **Unit** (`tests/unit/predict-club-studio-trade.test.ts`, bun:test): gợi ý hướng
  (UP/DOWN/null), suy ra risk-input (phút expiry, neutral bias, quote/vault undefined),
  strike truyền dạng USD chưa scale, risk-gate chặn (expiry ngắn, balance thấp, oracle
  stale), **pre-flight chặn ngoài biên trước khi ký**, pre-flight pass cho qua, và
  signer-fail-thành-result (không throw).
- **e2e** (`tests/e2e/predict-club-studio.spec.ts`, Playwright): click một ô live mở
  ticket; disconnected hiện Connect và ẩn Submit; Escape đóng. Gated trên việc có mặt
  surface SVI live (`waitForGrid`).
- **Smoke** (`scripts/predict-club-studio-smoke.mjs`, headless): mount, ARIA grid,
  keyboard nav, ticket-gating, không tràn desktop + mobile, không lỗi console.
- **Mint thật**: một mint testnet thật từ ô heatmap trả về transaction digest, xác nhận
  đường ký end-to-end và pre-flight không chặn một strike hợp lệ trong biên.

Chạy chúng:

```bash
bun run build
bun run test:unit
bun run test:e2e
bun scripts/predict-club-studio-smoke.mjs   # với một dev/preview server đang chạy
```

## Map lỗi

Pipeline gom mọi lỗi vào một chuỗi hiển thị cho người dùng. Các map đáng chú ý:

| Triệu chứng tầng thấp | Lý do hiển thị cho người dùng |
| --- | --- |
| Abort `quote_spread_from_fair_price` (pre-flight) | Strike ngoài biên định giá contract - chọn strike gần hơn / oracle active |
| Risk gate chặn | Lý do blocking + warning gộp (expiry quá ngắn, thiếu DUSDC, oracle stale, v.v.) |
| Không có PredictManager | "No PredictManager found - create one first" |
| Ví từ chối / RPC lỗi | Thông báo lỗi được throw (vd "user rejected") |
| Dựng PTB lỗi | "PTB build failed" hoặc thông báo được throw |

Abort Move thô được giữ ngoài UI chính; pre-flight contract chuyển cái phổ biến nhất
thành thông báo rõ ràng, hành động được trước khi người dùng ký.
