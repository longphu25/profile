# Dựng Lại Cockpit Predict Club (Chart-King, Pro-First)

## Mục Tiêu

Dựng lại bề mặt pro của Predict Club từ đầu thành một cockpit giao dịch dày đặc,
một điểm tập trung duy nhất, nơi biểu đồ giá là vua và một thanh hành động gắn
cố định (docked action rail) nắm toàn bộ luồng hành động. Chỉ tái sử dụng lớp dữ
liệu dùng chung; bỏ phần code panel R1-R8 trong `next/` và các biến thể A/B/C
(chỉ dùng làm tham khảo, không phải nền móng).

Kế hoạch này thay thế cách tiếp cận bố cục R1-R8 của story 21. Story 21 đã dựng
một cockpit nhiều vùng nhưng hụt ở bốn trục (dày đặc nhưng không có điểm tập
trung, phân cấp phẳng, cảm giác chưa trau chuốt, luồng hành động không rõ). Thay
vì vá nó, ta dựng lại lớp trình bày trên một xương sống: một vùng trội duy nhất,
mọi thứ còn lại xếp hạng bên dưới nó.

## Các Quyết Định Đã Chốt (phiên grill-me, 2026-06-13)

Mười một quyết định này là hợp đồng. Không tranh luận lại giữa chừng; nếu một
quyết định tỏ ra sai, dừng lại và quyết định lại một cách tường minh cùng người
dùng.

1. **Người dùng chính: Pro-first.** Cockpit Terminal dày đặc LÀ sản phẩm. One-tap
   bình dân là "lite mode" tương lai, không phải nhân vật chính.
2. **Bản sắc thị giác: giữ Terminal-First, trau chuốt nó.** Các quy tắc font chữ
   hiển thị đậm / thẩm mỹ kịch tính của skill `frontend-design` bị ghi đè một cách
   tường minh cho bề mặt này - đây là một data terminal, không phải landing page.
   Ngân sách dồn vào phân cấp, khoảng cách, chuyển động, và trau chuốt trạng thái
   trên hệ token sẵn có.
3. **Nền móng: dựng lại từ đầu.** Tái sử dụng lớp dữ liệu dùng chung
   (`PredictClubContext`, `domain/`, `application/`, `data/`, `suiHostAPI`) và
   `domain/roundPhase.ts` đã có test. Mọi thứ trong `presentation/next/` và các
   biến thể chỉ là tham khảo.
4. **Ưu tiên khi dựng lại (những gì cockpit cũ hụt):** thiết lập điểm tập trung,
   dựng phân cấp thật, nâng độ trau chuốt, làm luồng hành động rõ ràng. Đây là
   lăng kính nghiệm thu cho mọi giai đoạn.
5. **Điểm tập trung: biểu đồ là vua.** Biểu đồ giá (đường strike, đường giá hiện
   tại, lớp phủ đếm ngược) là vùng trội. Hướng, rủi ro, vòng đời, và hành động trở
   thành các thanh phụ trợ xếp quanh nó. Mô hình tư duy TradingView/Bloomberg.
6. **Hành động chính: thanh gắn bên cạnh.** Một thanh cố định bên cạnh biểu đồ vua
   chứa CTA theo từng pha cùng các ô nhập hướng/khối lượng. Cùng một vị trí ở mọi
   pha. Biểu đồ vẫn trội. Không bao giờ có hai CTA chính cạnh tranh nhau.
7. **Mobile: biểu đồ hero + action sheet.** Biểu đồ giữ vị trí hero rộng hết chiều
   ngang ở trên; thanh bên thu lại thành một thanh CTA gọn luôn hiển thị, vuốt lên
   để hiện hướng/khối lượng/rủi ro; các panel phụ trợ thành tab/accordion bên dưới.
   Một primitive bố cục dẫn cả thanh-bên desktop lẫn sheet mobile.
8. **Cách dựng biểu đồ vua: SVG tự viết.** Một biểu đồ vùng/đường Terminal-First
   nhỏ, nhanh, tùy biến màu hoàn toàn, lấy từ chuỗi giá oracle. Không gánh nặng
   thư viện nến/crosshair; không giữ canvas `OrderFlowChart` 346 dòng cho vùng vua.
9. **Nơi ở: thay thế `next/` tại chỗ.** Lịch sử git + các commit checkpoint theo
   từng pha là đường revert. Không có bề mặt thứ ba phải bảo trì.
10. **Phạm vi bình dân: pro trước, chừa móc cho lite sau.** Thanh hành động có một
    đường nối sạch để lite mode tương lai tái dùng logic theo pha. Không có bề mặt
    thứ hai ra mắt trong kế hoạch này.
11. **Chuyển động: tiết chế / kiểu định chế.** Phần lớn là tĩnh, như terminal
    Bloomberg. Chuyển động dành riêng cho thay đổi trạng thái thật (chuyển pha, xác
    nhận thực thi, sẵn sàng claim). Số không nảy hay lấp lánh theo nhịp oracle.
    `prefers-reduced-motion` được tôn trọng ở mọi nơi (bắt buộc bởi cả
    `ui-ux-pro-max` lẫn `design-taste-frontend`).

## Ràng Buộc Cứng

- **Em-dash (`—`) bị cấm hoàn toàn** trong mọi chuỗi hiển thị (tiêu đề, nhãn,
  pill, nút, chú thích, copy trạng thái rỗng/lỗi, alt text). Dùng dấu gạch nối
  hoặc viết lại câu. Đây là tell anti-slop số 1. (`design-taste-frontend` 9.G.)
- **Va chạm token Tailwind:** dự án định nghĩa `md` là token KHOẢNG CÁCH
  (`--spacing-md` = 12px), nên `max-w-md` ra 12px CHỨ KHÔNG phải 448px. Luôn dùng
  `max-w-[28rem]` và tương tự. Lỗi này từng cắn VariantA một lần.
- **Không hiển thị dữ liệu giả như thật.** Chặn `Your Exposure` và mọi số dư sau
  ví đã kết nối; hiện trạng thái rỗng/đang tải đã định nghĩa thay vì số demo.
- **Không fork logic dữ liệu.** Mọi suy dẫn (primaryAction, cổng rủi ro,
  consensus, ánh xạ pha) đến từ context/domain sẵn có. Chỉ trình bày.
- **Khả năng tiếp cận (ui-ux-pro-max P1):** tương phản WCAG AA (4.5:1 body, 3:1
  chữ lớn), vòng focus thấy được, thứ tự tab khớp thứ tự thị giác, màu không bao
  giờ là tín hiệu duy nhất (ghép UP/DOWN với icon + chữ), vùng chạm 44x44 trên
  mobile.

## Lớp Dữ Liệu (dùng chung, đã xác nhận - không fork lại)

Từ `usePredictClub()`:

- `oracleSnapshot: ClubOracleSnapshot` - `.oracles[]`, `.selectedOracleId`,
  `.oracleState?.latest_price?.{spot,forward}`, `.prices[]` (chuỗi mà biểu đồ vua
  vẽ).
- `pricingSnapshot: PredictPricingSnapshot` - `.quote` (estimatedCost,
  grossIfWin), `.fairValue` (probability, degraded, reason).
- `primaryAction: { label, action }` - hành động kế tiếp duy nhất đã suy dẫn sẵn.
- `riskEvaluation: RiskEvaluation` - `.canExecute`, `.blockingReasons[]`,
  `.warningReasons[]`.
- `consensus: ConsensusResult` - nguồn cho bento chỉ báo.
- `club.activeRound: PredictionRound` - `.status` (RoundStatus), `.direction`,
  `.strike`, `.btcSpot`, `.confirmedAt`, `.thesis`, `.indicators[]`, v.v.
- `context.isConnected`, `balances`, `predictManagerId`, `actions`.

Từ `domain/roundPhase.ts` (đã test, dùng chung):

- `mapStatusToPhase(status)` → `{ phase, stepIndex, cancelled, terminal }`
- `secondsToSettlement({ status, oracleExpiryMs, nowMs })` → đếm ngược trung thực,
  `null` trừ khi `executed` với expiry trong tương lai.
- `settlementProgress(...)`, `formatTimer(seconds)`, `PHASE_ORDER`, `PHASE_LABEL`,
  `PHASE_HINT`.

Thực thi theo hướng one-tap đã nối sẵn:
`actions.executeRound(directionOverride?: Direction)` tính strike từ spot trực
tiếp và lưu hướng+strike khi thành công để settlement. Thanh gắn tái dùng cái này.

## Token Thiết Kế (Terminal-First, giữ nguyên)

- Surface: `#0c1512`; container-lowest `#07100d`; on-surface `#dbe5df`.
- Mint chính: `--primary-fixed-dim #00e0b3` (UP / tăng / sẵn sàng / sức khỏe).
- Lỗi: `#ffb4ab`; đỏ tùy chỉnh DOWN/giảm `#ff5d73` trên chữ `#2a0008`.
- Font: Inter (UI), JetBrains Mono (`--font-data`, mọi số, tabular-nums).
- Gutter panel 1px (`gap-px` trên `bg-outline-variant`), panel không viền.
- Bo góc mặc định 4px; chip trạng thái có thể dùng 8px.

## Kiến Trúc

```
src/predict-club-next/main.tsx        (orchestrator - giữ, trỏ lại PANEL_MAP)
predict-club-next.html                (khung - giữ, đơn giản hóa slot về một root)
plugins/predict-club/presentation/next/
  CockpitShell.tsx     MỚI  một nguồn → desktop chart-king+side-rail / mobile hero+sheet
  PriceChart.tsx       MỚI  biểu đồ vua SVG tự viết (strike, hiện tại, lớp phủ đếm ngược)
  ActionDock.tsx       MỚI  thanh gắn bên: CTA theo pha + hướng/khối lượng + cổng rủi ro
  LifecycleRail.tsx    MỚI  stepper 5 bước (tái dùng roundPhase)
  ContextRail.tsx      MỚI  asset / fwd / strike / expiry / oracles (ngữ cảnh quyết định)
  ExposureRail.tsx     MỚI  risk checks + Your Exposure (chặn sau ví)
  DockTabs.tsx         MỚI  funding / offers / history (dưới đáy, thu gọn được)
  motion.ts            MỚI  token thời lượng/easing tiết chế + bảo vệ reduced-motion
```

Loại bỏ sau cutover (commit cuối): các panel `presentation/next/*` cũ
(`NextShell`, `ActionRail`, `RoundLifecycleStrip`, `DecisionStripNext`,
`PredictionRoomNext`, `RiskPanelNext`, `BottomDockNext`, `PanelShell`,
`VariantA/B/C`, `PrototypeSwitcher`). Giữ chúng sống cho đến khi bản dựng lại được
chấp nhận để route không bao giờ tối.

## Các Giai Đoạn (mỗi giai đoạn kết thúc bằng commit checkpoint + bump minor package.json)

### C0 - Nền móng bố cục & token chuyển động
Mục tiêu: một primitive bố cục dẫn cả desktop (chart-king + thanh gắn bên) lẫn
mobile (chart hero + action sheet), cộng chuyển động tiết chế tập trung hóa.

Công việc:
1. `motion.ts`: hằng số thời lượng/easing (kiểu định chế: ~120-200ms, ease-out),
   một bảo vệ `useReducedMotion`, và quy tắc chuyển động chỉ kích hoạt khi đổi
   trạng thái.
2. `CockpitShell.tsx`: cockpit CSS-grid. Desktop `lg:` =
   `[minmax(0,1fr)_22rem]` (vùng biểu đồ | thanh gắn), với lifecycle/context là các
   dải mỏng trên biểu đồ và một dock thu gọn được bên dưới. Mobile = một cột, biểu
   đồ hero trên cùng, một thanh CTA cố định đáy, các thanh phụ trợ thành tab.
3. Trỏ lại PANEL_MAP / mount của `src/predict-club-next/main.tsx` để render
   `CockpitShell` (giữ các component cũ vẫn import được cho đến cutover).

Nghiệm thu: shell mới build và mount tại route; desktop hiện một grid biểu-đồ-trội
rõ ràng với một cột thanh gắn; mobile hiện chart hero + một thanh CTA ghim; không
tràn ngang ở 375px.

Kiểm chứng: `bun run build`; Playwright ở 1440px và 375px (chiều rộng root bị
chặn, thanh hiện trên desktop / thanh CTA hiện trên mobile).

Trạng thái: chờ.

### C1 - Biểu đồ vua (SVG tự viết)
Mục tiêu: dựng vùng trội.

Công việc:
1. `PriceChart.tsx`: SVG vùng/đường tùy biến màu từ `oracleSnapshot.prices`
   (`.spot`). Đường strike (gạch đứt) + đường giá hiện tại + nhãn; tăng = mint,
   giảm = đỏ. `vectorEffect="non-scaling-stroke"`, nhãn tabular.
2. Lớp phủ đếm ngược: chỉ khi `secondsToSettlement` khác null (status `executed`,
   expiry tương lai); không bao giờ bịa timer. `formatTimer` MM:SS.
3. Trạng thái rỗng/đang thu thập (<2 điểm) và xử lý quote suy giảm, không em-dash.

Nghiệm thu: biểu đồ lấp đầy vùng vua, đọc rõ, strike so với hiện tại dễ thấy; đếm
ngược chỉ hiện khi trung thực; render với zero lỗi console.

Kiểm chứng: `bun run build`; ảnh Playwright vùng vua desktop + 375px; xác nhận đếm
ngược vắng mặt khi không `executed`.

Trạng thái: chờ.

### C2 - Thanh hành động gắn
Mục tiêu: luồng hành động duy nhất, gắn bên cạnh biểu đồ.

Công việc:
1. `ActionDock.tsx`: CTA theo pha từ `primaryAction` (tái dùng suy dẫn sẵn có -
   KHÔNG fork lại), chặn rủi ro theo `riskEvaluation.canExecute` cho pha thực thi,
   liệt kê lý do chặn/cảnh báo bên dưới. Đúng một CTA chính.
2. Hướng (UP/DOWN, hai màu, icon + chữ) + ô nhập khối lượng đưa vào
   `executeRound(direction)`; spinner khi submit; trạng thái disabled rõ ràng.
3. Đường nối sạch (hook `useActionModel()`) để lite mode tương lai tái dùng logic
   theo pha.

Nghiệm thu: một và chỉ một CTA chính ở mọi pha; UP/DOWN phân biệt bằng màu VÀ icon
VÀ nhãn; thực thi bị chặn hiện lý do; chưa kết nối hiện Connect.

Kiểm chứng: `bun run build`; unit test cho bộ chọn action-model qua các status;
Playwright trạng thái chưa kết nối (Connect, không nút submit) so với trạng thái bị
chặn.

Trạng thái: chờ.

### C3 - Thanh vòng đời + ngữ cảnh
Mục tiêu: các dải phụ trợ mỏng trên biểu đồ.

Công việc:
1. `LifecycleRail.tsx`: stepper 5 bước qua `mapStatusToPhase`; `cancelled` = banner
   đỏ, không stepper; không layout shift qua các pha; ARIA bước hiện tại.
2. `ContextRail.tsx`: asset / forward / hướng / strike / expiry / pledged /
   oracles - dày, tabular, một hàng. Không còn chữ thô `Phase: {status}` ở đâu cả.

Nghiệm thu: stepper trung thực; banner cancelled đúng; hàng ngữ cảnh dày và thẳng
hàng; không layout shift khi đổi pha.

Kiểm chứng: `bun run build`; tái dùng `tests/unit/roundPhase.test.ts`; Playwright
hai pha (live + claim).

Trạng thái: chờ.

### C4 - Thanh exposure & rủi ro
Mục tiêu: sẵn sàng rủi ro + exposure mà không có nút chính thứ hai.

Công việc:
1. `ExposureRail.tsx`: khối sẵn sàng `Risk Checks` + `Your Exposure` (cost / xác
   suất thắng / gross / lợi nhuận / risk-reward) với định dạng `display.ts` nghiêm
   ngặt.
2. Chặn `Your Exposure` sau ví (không số demo như thật); `Win Probability` không
   bao giờ hiện `0.0%` sai; lý do `Preview unavailable` gọn.

Nghiệm thu: không CTA chính thứ hai; không số khổng lồ thô; exposure ẩn cho đến khi
kết nối.

Kiểm chứng: `bun run build`; unit test cho định dạng + ánh xạ lỗi quote; Playwright
trạng thái preview-unavailable.

Trạng thái: chờ.

### C5 - Dock đáy (funding / offers / history)
Mục tiêu: các bề mặt tham khảo không cướp tập trung khỏi biểu đồ.

Công việc:
1. `DockTabs.tsx`: dock dạng tab thu gọn được - Funding (luồng node, nhãn theo
   trạng thái thật, lý do disabled ngắn), Offers, History (không viền dọc, PnL mã
   màu, header dính).
2. Thu gọn mặc định trong chế độ đọc có hướng dẫn; mở rộng lưu theo session.

Nghiệm thu: các route funding chỉ-preview không thể bị nhầm với đã thực thi; bảng
đọc được ở độ dày; dock thu gọn mà không reflow biểu đồ.

Kiểm chứng: `bun run build`; Playwright modal funding + render bảng.

Trạng thái: chờ.

### C6 - Biến đổi mobile (chart hero + action sheet)
Mục tiêu: một cockpit mobile thật, không phải một chồng.

Công việc:
1. Từ grid C0: chart hero ghim trên; các thanh phụ trợ thành tab/accordion; dock
   đáy sau một sheet.
2. Action sheet: thanh CTA gọn luôn hiển thị (CTA theo pha + UP/DOWN); vuốt/chạm
   lên hiện hướng/khối lượng/rủi ro. Safe-area insets; vùng chạm 44x44;
   `touch-action: manipulation`.

Nghiệm thu: ở 375px biểu đồ + hành động kế tiếp thấy được không cần cuộn; không
tràn ngang; sheet mở/đóng; reduced-motion thu hoạt ảnh sheet về tức thì.

Kiểm chứng: `bun run build`; Playwright 375px + tablet; xác nhận thanh CTA thấy
được không cần cuộn.

Trạng thái: chờ.

### C7 - Trạng thái, trau chuốt chuyển động, a11y, test, cutover
Mục tiêu: hoàn thiện bề mặt và loại bỏ code cũ.

Công việc:
1. Trạng thái rỗng / đang tải / lỗi / chưa kết nối cho mọi thanh (không panel
   trống, không dữ liệu demo như thật).
2. Chuyển động tiết chế chỉ khi đổi trạng thái thật (tiến pha, xác nhận thực thi,
   sẵn sàng claim); reduced-motion đã kiểm.
3. Lượt a11y: thứ tự focus, đóng sheet/dock bằng bàn phím, ARIA trên stepper +
   action dock, kiểm tương phản so với token.
4. Commit cutover: xóa các panel `next/*` loại bỏ + biến thể khi đã chấp nhận.
5. Làm mới spec Playwright theo cấu trúc mới; chạy unit test; cập nhật docs.

Nghiệm thu: mọi thanh có trạng thái không-vui-vẻ đã định nghĩa; chuyển động có lý
do và an toàn reduced-motion; code cũ đã gỡ; build + test xanh.

Kiểm chứng: `bun run build`; `bun run test:unit`;
`bun run test:e2e -- tests/e2e/predict-club.spec.ts`; spec biến thể đã cập nhật.

Trạng thái: chờ.

## Tập Tin Chạm Tới (mang tính chỉ dẫn)

Mới: `presentation/next/{CockpitShell,PriceChart,ActionDock,LifecycleRail,ContextRail,ExposureRail,DockTabs,motion}.tsx`.

Sửa (chỉ thêm cho đến cutover): `src/predict-club-next/main.tsx` (PANEL_MAP),
`predict-club-next.html` (đơn giản hóa về một slot root), `package.json` (minor
mỗi pha), `DESIGN.md` (phần điểm-tập-trung chart-king + chuyển động).

Xóa (chỉ ở cutover C7): các panel `next/*` loại bỏ, `VariantA/B/C`,
`PrototypeSwitcher`.

Không chạm: `predict-club.html`, `src/predict-club/*`, các panel
`presentation/*` (không phải next) sẵn có, `PredictClubRoot.tsx`,
`PredictClubContext`, `domain/` (trừ việc tiêu thụ `roundPhase.ts`),
`application/`, `data/`.

## Chiến Lược Commit

Commit nhỏ, mỗi pha một commit, bump minor `package.json` mỗi pha, phần thân
message ghi chú checkpoint để có thể revert. C0 → C7 theo thứ tự.

## Rủi Ro Mở

- Biểu đồ SVG tự viết phải đọc như "pro", không phải đồ chơi - nếu nó hụt ở C1,
  đó là thời điểm cân nhắc lại `lightweight-charts` cho vùng vua (điểm xem lại
  quyết định 8), trước khi C2 dựng trên nó.
- Chuỗi giá (`oracleSnapshot.prices`) chỉ đầy cho oracle đang chọn; xác nhận độ
  dày/tần suất làm mới đủ cho một biểu đồ thuyết phục trước khi cam kết C1.
