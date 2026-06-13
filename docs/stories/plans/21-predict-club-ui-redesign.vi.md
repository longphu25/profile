# Redesign Giao Diện Predict Club

## Mục Tiêu

Redesign cockpit Predict Club ở mức UX và visual mà KHÔNG dựng lại data layer.
Màn hình hiện tại chạy được nhưng quá tải: bảy vùng dày đặc tranh nhau sự chú ý,
hai primary action cạnh tranh nhau, phase round chỉ là text thô, và mobile chỉ
là stack ngây thơ. Plan này làm lại information architecture, action path và bề
mặt visual, trong khi giữ nguyên `PredictClubContext`, domain logic và toàn bộ
data contract.

## Quan Hệ Với Story 19

- Story 19 (`19-predict-club-ui-roadmap.vi.md`) dựng cockpit theo từng bước
  (Phase 1-8 đã triển khai). Story này là **redesign**, không phải tiếp nối —
  nó làm lại những gì 19 đã tạo.
- **Phase 9** của story 19 (Round Lifecycle Visualization, Variant A) đang *đã
  lên kế hoạch nhưng chưa build*. KHÔNG build riêng. Nó được **gộp vào Phase R3**
  ở đây để lifecycle strip được thiết kế như một phần của IA mới thay vì gắn
  thêm. Sau khi story này xong, đánh dấu story 19 Phase 9 là đã bị thay thế.

## Chiến Lược Build Song Song

UX cũ vẫn chạy nguyên vẹn, không bị đụng. UX mới được dựng trong **file song song**
ở route riêng, cả hai dùng chung một data layer. Cách này lặp lại tiền lệ
`predict-club-lifecycle-prototype.html` đã có, và cho phép so sánh side-by-side
cho tới khi redesign được chấp nhận.

| Mối quan tâm | Cũ (giữ, không đụng) | Mới (story này) |
| --- | --- | --- |
| HTML skeleton | `predict-club.html` | `predict-club-next.html` |
| Orchestrator | `src/predict-club/main.tsx` | `src/predict-club-next/main.tsx` |
| Panel components | `presentation/*.tsx` | `presentation/next/*.tsx` |
| Component registry | `plugin.tsx` (`PredictClub.*`) | cùng file, tên mới `PredictClub.Next.*` |
| Build entry | khai báo trong `vite.config.ts` | thêm `predict-club-next` vào CẢ `optimizeDeps.entries` lẫn `build.rollupOptions.input` |

**Dùng chung, không bao giờ fork:** `PredictClubContext`, `domain/`,
`application/`, `data/`, `suiHostAPI`. Cả hai UI đọc một nguồn sự thật — không
nhân đôi logic, không lệch. Việc redesign chỉ ở tầng presentation.

Orchestrator mới copy phần wiring wallet/action từ `src/predict-club/main.tsx`
(context sync, `registerActions`, vòng mount panel) nhưng trỏ `PANEL_MAP` của nó
sang tên slot mới và component mới. Đăng ký component mới trong `plugin.tsx` dưới
tên `PredictClub.Next.*` để cũ và mới cùng tồn tại trong một plugin bundle.

Cutover (cuối story): khi đã chấp nhận, trỏ `predict-club.html` → nội dung
`predict-club-next`, hoặc đổi route, và gỡ file cũ trong một commit riêng. Tới
lúc đó không gì trong path cũ thay đổi.

## Tài Liệu Chuẩn

- `docs/product/predict-club.md`
- `docs/product/predict-club-ui-requirements.vi.md`
- `docs/deepbook/predict-club-data-contract.vi.md`
- `plugins/predict-club/DESIGN.md` (design tokens — Terminal-First)
- `docs/stories/plans/19-predict-club-ui-roadmap.vi.md`

## Audit UI Hiện Tại

Render path live: `predict-club.html` cung cấp skeleton tĩnh với các slot
`[data-pc-panel]`; `src/predict-club/main.tsx` mount panel React vào các slot đó,
đọc từ `PredictClubContext`. `PredictClubRoot.tsx` chỉ là backward-compat —
KHÔNG sửa.

Các vùng và panel hiện có:

| Vùng | Panel | File |
| --- | --- | --- |
| Top nav | (tĩnh trong html + `PredictClubPage.tsx`) | `src/predict-club/PredictClubPage.tsx` |
| Decision strip | `DecisionStripPanel` | `presentation/DecisionStripPanel.tsx` |
| Cột trái | `ClubPanel` | `presentation/ClubPanel.tsx` |
| Trung tâm | `PredictionRoomPanel` | `presentation/PredictionRoomPanel.tsx` |
| Cột phải | `RiskPanel` | `presentation/RiskPanel.tsx` |
| Dock dưới | `FundingRouterPanel`, `EscrowOffersPanel`, `RoundHistoryPanel` | `presentation/*.tsx` |
| Overlay | `ModalLayer`, `QuickPredictPanel` | `presentation/*.tsx` |

Vấn đề UX cần sửa:

1. **Quá tải mật độ.** Bảy vùng hiện cùng lúc; member mới không tìm được bước
   tiếp theo. DESIGN.md nhắm "trader chuyên nghiệp, mật độ cao" nhưng story 19
   liên tục phục vụ "member mới" — căng thẳng đó chưa được giải quyết.
2. **Primary action cạnh tranh.** `Accept Signal` (decision strip) và
   `Execute Trade` (right panel) đều đọc như CTA chính. Story 19 Phase 7 tuyên
   bố "không bao giờ có hai primary action cạnh tranh" nhưng layout vẫn hiện hai.
3. **Phase là text thô.** `Phase: FUNDING` / `Phase: {round.status}` không cho
   cảm giác về tiến độ, thời gian tới settle, hay sẵn sàng claim.
4. **Mobile chỉ là stack.** Layout 3 cột dày reflow thành đống dọc cộng bottom
   nav; action path mất trên màn hình nhỏ.
5. **Rò mock data.** Balance hardcode trong `PredictClubPage.tsx` và member list
   tĩnh trong `predict-club.html` ship như thật.

## Hướng Thiết Kế

**Quyết định (khuyên dùng): giữ identity Terminal-First, thêm lớp guided.**

- Giữ palette tối mint/amber/red, Inter + JetBrains Mono, panel grid gutter 1px,
  và token `DESIGN.md`. Identity mạnh và đã đầu tư.
- Thêm **progressive disclosure**: cách đọc mặc định "guided" nơi action kế tiếp
  duy nhất và lifecycle round chiếm ưu thế, còn panel pro-density chỉ cách một
  thao tác. Density là thuộc tính của layout, không phải theme riêng.
- Đưa vào **một primary-action rail duy nhất** để luôn chỉ có một CTA là primary,
  derive từ phase round + trạng thái wallet/funding/quote (mở rộng 19 Phase 7).

Nếu sau này user thích default sạch hơn, mật độ thấp hơn cho người mới, đó là
thay đổi token + layout gói gọn trong Phase R1-R2; phần còn lại của plan giữ
nguyên.

## Không Thuộc Phạm Vi

- Không đổi shape state của `PredictClubContext`, domain logic, hay data contract
  (đó là domain của story 19). Redesign tiêu thụ dữ liệu sẵn có.
- Không thêm flow on-chain hay funding route mới.
- `PredictClubRoot.tsx` không bị đụng (shell backward-compat).
- Việc nối mock data còn lại vào read thật được ghi chú nơi redesign lộ ra
  khoảng trống, nhưng wiring data thật vẫn là follow-up của story 19 trừ khi nhỏ.

## Phase R1: Hướng Thiết Kế & Nền Layout

Mục tiêu: chốt hướng redesign và dựng các layout primitive dùng chung mà mọi
phase sau tái sử dụng.

Việc cần làm:

1. Xác nhận hướng Terminal-First + lớp guided; ghi vào `DESIGN.md` (thêm section
   "Density & Disclosure").
2. Scaffold bề mặt song song mới: `predict-club-next.html` (skeleton + slot mới),
   `src/predict-club-next/main.tsx` (orchestrator copy từ
   `src/predict-club/main.tsx`, `PANEL_MAP` mới), và build entry
   `predict-club-next` trong CẢ `optimizeDeps.entries` lẫn
   `build.rollupOptions.input`. KHÔNG đụng `predict-club.html` /
   `src/predict-club/main.tsx` cũ.
3. Dựng layout shell responsive trong `presentation/next/`: component `PanelShell`
   (header + border 1px + body) và một region grid điều khiển cả desktop 3 cột
   lẫn reflow mobile từ một nguồn.
4. Định nghĩa motion token (duration, easing, reduced-motion) trong
   `presentation/next/` để animation nhất quán và tập trung, không GSAP inline
   rải rác trong HTML mới.

Acceptance:

- `predict-club-next.html` render shell mới rỗng, build và mount được.
- Một layout primitive sở hữu phần chrome của panel; panel mới không tự vẽ border.
- Hướng được ghi trong `DESIGN.md`.

Validation: `bun run build` (cả hai entry build); route mới load được shell;
`predict-club.html` cũ render không đổi.

Trạng thái: done (checkpoint `a3da8fb`, bump `0.54.0`).

## Phase R2: Information Architecture & Primary Action Rail

Mục tiêu: tái cấu trúc màn hình để có một action path rõ ràng và phân cấp visual
rõ.

Việc cần làm:

1. Xếp lại các vùng theo độ chú ý trong layout slot mới: lifecycle + primary
   action trước, context hỗ trợ sau, bảng tham chiếu cuối.
2. Dựng một **Primary Action Rail** duy nhất dưới dạng component mới
   (`presentation/next/ActionRail.tsx`): render đúng một CTA cho phase hiện tại
   (Connect / Create Manager / Fund / Review / Sign & Execute / Claim), kèm lý do
   disabled. UX mới không bao giờ trùng một CTA cạnh tranh; đây là primary action
   duy nhất.
3. Derive `Accept Signal` vs `Execute Trade` thành một action rail duy nhất.
4. Định nghĩa affordance collapse/expand cho panel pro-density (guided default).

Acceptance:

- Đúng một element được style như primary action ở mọi phase.
- Member mới đi theo được Connect → Create Manager → Fund → Review → Execute
  bằng mắt mà không cần đọc docs.

Validation: `bun run build`; unit test theo state cho action selector; Playwright
check primary action lúc disconnected vs connected.

Trạng thái: done (checkpoint `c95c49e`, bump `0.55.0`).

## Phase R3: Decision Strip & Round Lifecycle (gộp Story 19 Phase 9)

Mục tiêu: biến band trên cùng thành nguồn round context duy nhất, gồm cả
visualization lifecycle trung thực.

Việc cần làm:

1. Dựng `DecisionStripNext` mới (`presentation/next/`) theo phân cấp mới (Asset,
   Forward, Direction, Strike, Expiry, Pledged, Ticks, Oracles).
2. Dựng `RoundLifecycleStrip` trong `presentation/next/` (chính là thiết kế story
   19 Phase 9, Variant A): map 8 `RoundStatus` → 5 bước
   (setup/fund/live/settle/claim); `cancelled` = banner đỏ. Tạo
   `domain/roundPhase.ts` DÙNG CHUNG (`mapStatusToPhase`, `secondsToSettlement`,
   `settlementProgress`, `formatTimer`), có unit test. Helper domain này dùng
   chung (không nằm trong `next/`) để UX cũ có thể adopt sau nếu muốn.
3. **Countdown chỉ khi trung thực**: `MM:SS` thật chỉ khi `status === 'executed'`
   dùng `oracleState.expiry - now`; tuyệt đối không bịa timer cho phase do user
   điều khiển. (Mang nguyên quy tắc countdown của story 19 Phase 9.)
4. `PredictionRoomNext` (R4) không mang text thô `Phase: {round.status}`; context
   lifecycle chỉ nằm trong `RoundLifecycleStrip`. `PredictionRoomPanel` cũ giữ
   nguyên.

Acceptance:

- Stepper 5 bước render; `executed` hiện countdown theo giây; phase khác không
  có timer giả; `cancelled` hiện banner đỏ, không stepper.
- Không layout shift khi đổi phase.

Validation: `bun run build`; `tests/unit/roundPhase.test.ts`; Playwright
screenshot ≥2 phase (live + claim) desktop + 375px.

Trạng thái: done (checkpoint `35114d5`, bump `0.56.0`).

## Phase R4: Prediction Room

Mục tiêu: làm cột trung tâm dễ scan — thesis, signal evidence, chart.

Việc cần làm:

1. Dựng `PredictionRoomNext` (`presentation/next/`): band lifecycle (R3) dưới
   header, rồi Leader Thesis, indicator bento, chart.
2. Chuẩn hóa các tile indicator bento (consensus từ `indicatorConsensus`) với
   màu state nhất quán.
3. Tái dùng `OrderFlowChart` (dùng chung) trong khung chart mới; đảm bảo đường
   strike/giá hiện tại và nhãn đọc rõ.

Acceptance: cột trung tâm đọc trên-xuống là context → evidence → chart, không
nhãn chồng nhau.

Validation: `bun run build`; Playwright screenshot cột trung tâm.

Trạng thái: done (checkpoint `4199d51`, bump `0.57.0`).

## Phase R5: Risk & Execution

Mục tiêu: làm cột phải rõ cho người mới và chính xác cho pro, không CTA cạnh
tranh.

Việc cần làm:

1. Dựng `RiskPanelNext` (`presentation/next/`): một block readiness `Risk Checks`,
   `Your Exposure` (cost / win prob / gross / profit / risk-reward) với format
   chặt từ `display.ts`.
2. Đưa execution vào Primary Action Rail (R2); right panel chỉ hiện risk +
   exposure, không phải một primary button thứ hai.
3. Giữ lý do `Preview unavailable` gọn; giữ mapping Move-abort.

Acceptance: không số thô quá lớn; `Win Probability` không bao giờ hiện `0.0%`
sai; không CTA primary thứ hai ở cột phải.

Validation: `bun run build`; unit test cho formatting + quote-error mapping;
Playwright trạng thái preview-unavailable.

Trạng thái: done (checkpoint `69bcadb`, bump `0.58.0`).

## Phase R6: Funding Router, Offers & History (dock dưới)

Mục tiêu: redesign dock dưới để trạng thái funding và bảng tham chiếu dễ đọc mà
không cướp focus khỏi action path.

Việc cần làm:

1. Dựng `FundingRouterNext` (`presentation/next/`) node flow (Direct ready;
   swap/borrow/escrow ghi nhãn theo state thật) với lý do disabled ngắn.
2. Dựng bảng `EscrowOffersNext` và `RoundHistoryNext` theo spec bảng mới
   (không border dọc, PnL màu, header sticky).
3. Làm dock collapse được để user guided-mode ẩn đi.

Acceptance: route preview-only không bị nhầm là đã execute; bảng đọc được ở mật
độ cao mà không overflow.

Validation: `bun run build`; Playwright funding-modal + render bảng.

Trạng thái: done (checkpoint `46ed27a`, bump `0.59.0`).

## Phase R7: Responsive & Mobile

Mục tiêu: trải nghiệm mobile thật, không phải stack desktop.

Việc cần làm:

1. Điều khiển mobile từ region grid R1: lifecycle + primary action ghim cứng;
   panel hỗ trợ thành tab/accordion; bảng tham chiếu đẩy ra sau một sheet.
2. Redesign bottom nav mobile khớp IA mới (action-first).
3. Đảm bảo touch target, safe-area inset, và layout `375px` ổn.

Acceptance: ở 375px action kế tiếp và lifecycle hiện mà không cần scroll; không
overflow ngang.

Validation: `bun run build`; Playwright ở 375px + breakpoint tablet.

Trạng thái: done (checkpoint `4068f7c`, bump `0.60.0`).

## Phase R8: States, Motion, A11y & Test Hardening

Mục tiêu: hoàn thiện bề mặt — state empty/loading/error, motion, a11y, test.

Việc cần làm:

1. Định nghĩa state empty / loading / error / disconnected cho mọi panel đã
   redesign (không panel trống, không demo data hiện như thật).
2. Tập trung motion qua token R1; tôn trọng `prefers-reduced-motion`; giữ toàn
   bộ motion trong bề mặt mới (không GSAP inline rải rác trong
   `predict-club-next.html`).
3. Pass a11y: focus order, đóng overlay bằng keyboard, ARIA cho stepper và action
   rail, contrast theo token.
4. Mở rộng Playwright (page render, wallet popup, Active Oracles, funding modal,
   các phase lifecycle) và chạy unit test; refresh docs + index.

Acceptance: mọi panel có state non-happy đã định nghĩa; reduced-motion được tôn
trọng; build + focused tests pass trước commit.

Validation: `bun run build`; `bun run test:unit`;
`bun run test:e2e -- tests/e2e/predict-club.spec.ts`; `qmd update -c profile-docs`.

Trạng thái: done (checkpoint `3ea4158`, bump `0.61.0`).

## File Đụng Tới (dự kiến)

Mới (redesign nằm ở đây):

- Thêm: `predict-club-next.html` (skeleton mới + slot `[data-pc-panel]` mới)
- Thêm: `src/predict-club-next/main.tsx` (orchestrator, `PANEL_MAP` mới)
- Thêm: `plugins/predict-club/presentation/next/*` (PanelShell, region grid,
  motion token, `ActionRail`, `DecisionStripNext`, `RoundLifecycleStrip`,
  `PredictionRoomNext`, `RiskPanelNext`, `FundingRouterNext`, `EscrowOffersNext`,
  `RoundHistoryNext`)
- Thêm: `plugins/predict-club/domain/roundPhase.ts` + `tests/unit/roundPhase.test.ts`

Sửa (chỉ thêm vào, đường cũ vẫn chạy):

- Sửa: `vite.config.ts` (thêm `predict-club-next` vào `optimizeDeps.entries` và
  `build.rollupOptions.input`)
- Sửa: `plugins/predict-club/plugin.tsx` (đăng ký component mới `PredictClub.Next.*`
  song song với `PredictClub.*` hiện có)
- Sửa: `plugins/predict-club/DESIGN.md` (section density & motion)
- Sửa: `package.json` (bump minor mỗi phase)

Không đụng: `predict-club.html`, `src/predict-club/main.tsx`,
`src/predict-club/PredictClubPage.tsx`, các panel `presentation/*` hiện có,
`PredictClubRoot.tsx`, `PredictClubContext`, `domain/` (trừ `roundPhase.ts` mới
dùng chung), `application/`, `data/`.

Cutover (commit riêng, cuối story): repoint route / swap `predict-club.html`
sang nội dung mới và retire file cũ chỉ sau khi redesign được chấp nhận.

## Chiến Lược Commit

Commit nhỏ, mỗi commit một mối quan tâm, bump `package.json` minor mỗi phase:

1. R1 nền (layout primitive + DESIGN.md)
2. R2 IA + action rail
3. R3 decision strip + lifecycle (+ roundPhase tests)
4. R4 prediction room
5. R5 risk & execution
6. R6 dock dưới
7. R7 responsive
8. R8 states + a11y + tests + refresh docs/index
