# Predict Vol-Surface Studio (Terminal Hỗ Trợ Ra Quyết Định)

## Mục tiêu

Biến cockpit Predict Club hiện có thành một trading terminal hỗ trợ ra quyết định
bằng cách làm cho volatility surface của DeepBook Predict đọc được và hành động
được. Lợi thế cho hackathon là đúng thứ đối thủ thiếu về mặt cấu trúc: một vol
surface sống mà ta đọc được, kèm các con số cụ thể trader hành động theo (mispricing
so với contract, IV so với realized vol, độ lành mạnh của surface). Dựng một Surface
Studio riêng cho phần phân tích, và gắn một badge mispricing duy nhất vào action rail
của cockpit cho đúng khoảnh khắc ra quyết định.

Kế hoạch này xây trên story 22 (cockpit chart-king, đã xong). Nó KHÔNG dựng lại
cockpit. Nó thêm một surface mới và một hook nhỏ ở cockpit, tái dùng tầng dữ liệu
chung và toán SVI đã có sẵn trong `domain/payoutPreview.ts`.

## Vì sao chọn hướng này

Lời than cốt lõi của problem statement về prediction markets hiện nay là chúng "không
có khái niệm thực sự về volatility surface bên dưới". Toàn bộ pitch của Predict là
định giá theo vol-surface cho mọi strike và expiry. Ta đã nhận được SVI params
(`{a,b,rho,m,sigma}`) theo từng oracle và tính fair value cục bộ, nhưng chưa bao giờ
vẽ ra cái surface mà các params đó mô tả. Nước đi đòn bẩy cao nhất, rủi ro contract
thấp nhất là render surface đó cùng cái edge mà nó phơi ra.

Quét tham khảo (2026-06-14):

- **crash.suize.io** (Vite SPA, gamified): Enoki zkLogin + sponsored/gasless tx,
  Slush + dapp-kit. Gọi `create_manager / deposit / supply / redeem_lp /
  redeem_funds / claim / get_trade_amounts`. Dùng `/predicts/{id}/vault/summary`,
  `/oracles/{id}/prices/latest`, `/positions/minted?manager_id=`,
  `/positions/redeemed?manager_id=`, `/managers`. Góc gamified+PLP của họ là một
  làn khác với mình.
- **predict.magicdima.xyz** (Next.js + dapp-kit): một pro inspector với
  wallet-connect chuẩn, không sponsored tx. Gần tinh thần "làm Predict dễ đọc" nhất,
  đúng cái làn ta đang mài sắc bằng surface + edge.

Không bên nào render vol surface kèm overlay mispricing/edge sống. Đó là điểm khác
biệt của ta.

## Quyết định đã chốt (phiên grill-me, 2026-06-14)

Đây là hợp đồng. Không relitigate giữa chừng; nếu một cái sai, dừng lại và quyết lại
tường minh với user.

1. **Mũi nhọn submission: terminal hỗ trợ ra quyết định.** Dựa vào đường mint/claim
   thật đã ship cộng các con số quyết định giàu hơn. Không phải vault contract mới,
   không phải bot. Rủi ro contract thấp nhất, khớp "số tốt hơn cho quyết định tốt
   hơn".
2. **Tính năng đầu tàu: vol surface + edge.** Bản thân surface cộng các con số edge
   của trader là headline. Đây là góc "thứ mà UI pro chuẩn không phơi ra", được làm
   cho dễ đọc.
3. **Phạm vi surface: 3D đầy đủ (strike x expiry).** Trục dữ liệu là strike VÀ expiry.
   Smile theo strike miễn phí từ một bộ SVI; trục expiry cần fan-out SVI theo từng
   oracle.
4. **Render surface: heatmap matrix 2D + smile SVG. Không thêm dependency.** Render
   dữ liệu 3D (strike x expiry -> IV) dạng vol matrix heatmap kiểu Bloomberg cộng một
   lát smile SVG đúng brand. Không three.js / plotly. Đúng brand, đọc tức thì, rủi ro
   dependency bằng không.
5. **Surface sống trong Studio riêng; cockpit không đụng.** Một Vite entry mới
   (`predict-surface-studio.html`). Cockpit chart-king của story 22 giữ nguyên xi
   (quyết định 5/8 của plan 22: chart-is-king, king chart = custom SVG, vốn không
   chứa được surface 3D).
6. **Các con số edge (đủ cả bốn):** (a) **Contract quote so với fair value =
   mispricing** [CHÍNH], (b) IV so với realized vol, (c) arb-free checker
   (butterfly/calendar, sức khỏe surface), (d) so với venue ngoài [STRETCH, không
   được kéo scope core].
7. **Mispricing sống ở cả hai chỗ:** một badge mispricing gọn trong action rail của
   cockpit (rẻ; tái dùng `pricingSnapshot.quote` + `.fairValue` đã có sẵn trong
   context cho strike đang chọn) VÀ view ladder/surface đầy đủ trong Studio.
8. **Dữ liệu mispricing ladder: dải ATM + lazy + cache.** Lớp nền heatmap là IV trên
   toàn lưới strike x expiry (miễn phí, toán SVI thuần). Mispricing (contract
   `get_trade_amounts` qua devInspect, một round-trip mỗi strike) chỉ tính cho dải
   ATM mặc định; hover/click mới quote thêm ô một cách lười; cache khóa theo
   `(oracleId, strike)` với TTL ngắn. Giữ RPC testnet khỏi cháy.
9. **Deploy-ready nằm trong scope (sửa CORS).** Minimum requirement ghi "work end to
   end, we will test the entire flow". Hiện chưa set `VITE_TESTNET_RPC_URL`, nên bản
   build prod gọi thẳng `fullnode.testnet.sui.io` và chết vì CORS (trang trắng). Một
   phase prod-readiness sửa cấu hình RPC ở cả hai tầng và verify bản build deploy
   render được.
10. **Studio <-> cockpit: entry riêng + link hai chiều.** Studio là entry `.html`
    riêng; cockpit và studio link qua lại để demo chảy phân tích -> hành động liền
    mạch.
11. **Nội dung Studio v1 (theo thứ tự ưu tiên cắt):** heatmap + smile (core), overlay
    mispricing (core), arb-free checker, time-travel slider (cuối; là đường cắt nếu
    thiếu thời gian).

## Ràng buộc cứng

- **Em-dash (`—`) và en-dash-làm-dấu-phân-cách (`–`) bị cấm hoàn toàn** trong mọi
  chuỗi hiển thị (headline, label, pill, nút, caption, copy empty/error, alt text,
  tooltip). Dùng gạch nối `-` hoặc viết lại. (`design-taste-frontend` 9.G.) Áp dụng
  cho Studio y như cockpit.
- **Skill design dẫn dắt: `ui-ux-pro-max`** (surface sản phẩm dày dữ liệu). WCAG AA
  contrast (4.5:1 body, 3:1 large), focus ring nhìn thấy, tab order khớp thứ tự thị
  giác, màu không bao giờ là tín hiệu duy nhất (ghép mọi đỏ/xanh với dấu + label), số
  tabular cho mọi cột số, tôn trọng `prefers-reduced-motion`. Heatmap KHÔNG được dùng
  màu làm mã hóa duy nhất: ghép màu ô với một con số IV/mispricing in ra để vừa qua
  colorblind vừa qua AA contrast.
- **Va chạm token Tailwind:** `md` là token SPACING (`--spacing-md` = 12px), nên
  `max-w-md` ra 12px. Luôn dùng `max-w-[28rem]` và tương tự.
- **Không hiển thị mock như thật.** Mọi ô, badge, con số đều là giá trị sống hoặc một
  state empty/stale đã định nghĩa. Không số demo. Overlay arb-free và mispricing phải
  degrade nhìn thấy được (không bịa) khi thiếu SVI hoặc thiếu quote.
- **Không fork logic dữ liệu.** Tái dùng toán SVI `domain/payoutPreview.ts`, snapshot
  `deepbookOracleService`, và đường devInspect quote của `deepbookPredictPricingService`.
  Code mới là presentation + một tầng sampling surface mỏng, không phải một bản
  implementation định giá thứ hai.
- **Motion: tiết chế / institutional** (như plan 22). Surface re-render và scrub
  time-travel là state change; không shimmer mỗi tick. Reduced-motion thu transition
  về tức thì.

## Tầng dữ liệu (chung, đã xác nhận)

Từ `deepbookOracleService` / `usePredictClub()`:

- `oracleSnapshot.oracles[]` — mọi oracle sống với `{oracle_id, expiry,
  underlying_asset, status}`. Đây là nguồn **trục expiry**. Rolling sub-hour, nên chỉ
  một nhúm sống cùng lúc.
- `oracleSnapshot.oracleState?.latest_price?.{spot,forward}` — forward theo từng
  oracle là mỏ neo moneyness cho smile.
- `oracleSnapshot.oracleState?.latest_svi` — SVI params cho oracle đang chọn. Để có
  surface đầy đủ ta fan-out `GET /oracles/{id}/svi/latest` theo từng oracle.
- `oracleSnapshot.prices[]` — chuỗi giá gần đây (chart cockpit; không cần cho bản
  thân surface).

Từ `domain/payoutPreview.ts` (tái dùng, KHÔNG fork):

- `totalVarianceAtLogMoneyness(svi, k)` — cốt lõi. Cho `k = log(K/F)` với strike `K`
  bất kỳ để ra total variance `w`. **IV = sqrt(w / T)** với `T` là time-to-expiry
  theo năm. Cái này sinh ra toàn bộ smile từ một bộ SVI, miễn phí.
- `computeFairValue(svi, forward, expiry, strike, direction)` — xác suất fair-value
  theo từng strike (cockpit đã dùng).
- `normalizeSVIParams`, `normalCDF` — toán hỗ trợ, đã đúng (xử lý scale 1e9 bên
  trong).

Từ `deepbookPredictPricingService`:

- Đường devInspect `predict::get_trade_amounts` / `get_range_trade_amounts` trả về
  mint cost / payout **contract** theo từng strike. Đây là vế contract của mispricing
  = `contractImpliedProb - fairValueProb`. Một devInspect mỗi strike (lời gọi bị bound
  chi phí, do đó quyết định 8).

Từ `binanceRefService` (tái dùng cho realized vol):

- `fetchBinanceRefHistory()` trả 60 cây nến đóng BTC 1m (không CORS). Đủ cho một ước
  lượng **realized vol** cửa sổ ngắn (stddev của log returns, annualized) để đặt cạnh
  IV. Không cần nguồn dữ liệu mới.

## Kiến trúc

```
predict-surface-studio.html              MỚI  Vite entry (mirror head của predict-club-next.html)
src/predict-surface-studio/main.tsx      MỚI  orchestrator (mirror wallet wiring của predict-club-next/main.tsx)
plugins/predict-club/
  application/
    sampleVolSurface.ts                  MỚI  thuần: oracles + SVI -> lưới {strike x expiry -> IV}
    volSurfaceService.ts                  MỚI  fan-out SVI mỗi oracle; realized-vol; cache mispricing (dải ATM, lazy, TTL)
    arbFreeCheck.ts                       MỚI  thuần: kiểm tra no-arb butterfly + calendar trên lưới
  domain/
    volSurface.ts                         MỚI  types: SurfaceGrid, SurfaceCell, MispriceCell, ArbViolation, RealizedVol
  presentation/studio/
    StudioShell.tsx                       MỚI  layout: heatmap (king) + lát smile + panel edge + controls
    VolHeatmap.tsx                        MỚI  matrix SVG (hàng strike x cột expiry), ô màu+số, dải ATM
    SmileSlice.tsx                        MỚI  smile SVG cho cột expiry đang chọn (IV theo strike)
    EdgePanel.tsx                         MỚI  ladder mispricing + IV-vs-realized + trạng thái arb-free
    TimeTravel.tsx                        MỚI  (cuối) scrubber lịch sử SVI; degrade về "live only" nếu không có lịch sử
    studio.css hoặc reuse predict-club.css  token surface (Terminal-First, chung)
plugins/predict-club/presentation/next/
  ActionDock.tsx (hoặc ExposureRail.tsx)  SỬA  thêm badge mispricing gọn (tái dùng pricingSnapshot)
```

Studio tái dùng trọn tầng dữ liệu của plugin predict-club: load cùng plugin, cùng
`PredictClubProvider`, cùng wallet wiring như `predict-club-next`. Phần sampling
surface + toán arb là mới nhưng thuần và có test.

## Các phase (mỗi phase kết bằng commit checkpoint + bump minor package.json)

### S0 — Studio entry, shell, wallet wiring
Mục tiêu: một route mới mount được, kết nối ví, và chia sẻ tầng dữ liệu predict-club,
có link hai chiều với cockpit.

Việc:
1. `predict-surface-studio.html` mirror `predict-club-next.html` (cùng font, block
   reduced-motion, body class Terminal-First, một slot React root).
2. `src/predict-surface-studio/main.tsx` mirror `predict-club-next/main.tsx` (DAppKit
   provider, host wiring, load plugin predict-club, mount component mới
   `PredictClub.Surface.Studio`). Đăng ký component trong `plugin.tsx`.
3. Đăng ký entry trong `vite.config` (`optimizeDeps.entries` + `rollupOptions.input`).
4. Grid placeholder `StudioShell.tsx` + header. Thêm link "Studio" trong header
   cockpit và link "Cockpit" quay lại trong header studio.

Chấp nhận: route studio build + mount; ví kết nối; link header điều hướng cả hai
chiều; không lỗi console; không tràn ngang ở 1440px và 375px.

Kiểm chứng: `bun run build`; Playwright mount `[data-pc-studio]` và assert cross-link
trỏ đúng entry.

Trạng thái: done.

### S1 — Sampling surface + heatmap IV (core)
Mục tiêu: king zone của studio: một matrix IV strike x expiry sống từ SVI thật, không
gọi contract nào.

Việc:
1. Types `domain/volSurface.ts`. `application/sampleVolSurface.ts`: cho oracles sống
   + SVI + forward + expiry của chúng, dựng lưới IV theo (strike, expiry). Strikes =
   một dải đối xứng quanh mỗi forward (vd +/- N bước theo bps hoặc theo đơn vị
   1-sigma); IV = `sqrt(totalVarianceAtLogMoneyness(svi, log(K/F)) / T)`.
2. `volSurfaceService.ts`: fan-out `GET /oracles/{id}/svi/latest` qua các oracle sống
   (bound; chỉ active, expiry tương lai), ráp lưới, expose subscribe/snapshot như
   `deepbookOracleService`. Xử lý thiếu SVI theo từng oracle (cột đó degrade, không
   bịa).
3. `VolHeatmap.tsx`: matrix SVG, hàng strike x cột expiry. Mỗi ô hiện số IV VÀ một dải
   màu nền (màu không bao giờ là tín hiệu duy nhất). Hàng ATM highlight. Số tabular.
   State empty/stale.

Chấp nhận: heatmap lấp đầy king zone với giá trị IV thật chạy theo SVI update; cột map
đúng expiry thật; cột thiếu SVI hiện state empty đã định nghĩa; đọc ra "pro", không
toy; không lỗi console.

Kiểm chứng: `bun run build`; unit test cho `sampleVolSurface` (SVI biết -> IV biết
trong sai số) và ráp lưới; Playwright assert một lưới NxM ô có nội dung số ở 1440px.

Trạng thái: done.

### S2 — Lát smile + IV so với realized vol
Mục tiêu: smile theo từng expiry và con số edge đầu tiên.

Việc:
1. `SmileSlice.tsx`: smile SVG đúng brand (IV theo strike) cho cột expiry đang chọn;
   click một cột heatmap để chọn; marker ATM; marker forward.
2. Realized vol: trong `volSurfaceService` (hoặc helper nhỏ), tính realized vol
   annualized từ log returns của `fetchBinanceRefHistory()`. Hiện ATM IV so với
   realized vol dưới dạng spread có nhãn (dấu + label, không chỉ màu) trong
   `EdgePanel.tsx` (panel tạo ở đây, điền tiếp ở S3).

Chấp nhận: chọn một cột cập nhật smile; hình smile khớp cột heatmap; spread
IV-vs-realized hiện một con số thật có dấu và label, hoặc một state "realized
unavailable" đã định nghĩa nếu lịch sử Binance rỗng.

Kiểm chứng: `bun run build`; unit test cho toán realized-vol (chuỗi biết -> stddev
biết); Playwright chọn một cột và assert smile + spread cập nhật.

Trạng thái: done.

### S3 — Overlay mispricing (edge CHÍNH) + badge cockpit
Mục tiêu: edge headline, ở cả ladder studio lẫn action rail cockpit.

Việc:
1. Lớp mispricing trong `volSurfaceService`: chỉ cho dải ATM (quyết định 8), gọi
   devInspect `get_trade_amounts` đã có theo từng strike, đổi contract cost ra xác
   suất ngụ ý, tính `mispricing = contractImpliedProb - fairValueProb`. Cache theo
   `(oracleId, strike)` với TTL ngắn; hover/click mới mở rộng ngoài dải ATM một cách
   lười. Bound concurrency để RPC testnet sống.
2. `EdgePanel.tsx`: ladder mispricing cho expiry đang chọn (strike, fair prob,
   contract prob, edge, kèm dấu + màu + label). Ô heatmap trong dải ATM có tint/chỉ
   báo mispricing khác với dải màu IV (legend tài liệu hóa).
3. Cockpit: thêm badge mispricing gọn vào `ActionDock`/`ExposureRail` tái dùng
   `pricingSnapshot.quote` + `.fairValue` đã có sẵn trong context cho strike đang
   chọn. Không fetch mới ở cockpit. State đã định nghĩa khi quote degrade.

Chấp nhận: ô dải ATM hiện edge thật suy ra từ quote contract thật; mở rộng lười chạy
khi hover/click; cache chặn bão devInspect trùng lặp; badge cockpit hiện cùng edge cho
strike đang chọn hoặc state unavailable đã định nghĩa; RPC testnet không lỗi khi tương
tác bình thường.

Kiểm chứng: `bun run build`; unit test cho đổi cost->xác-suất-ngụ-ý->edge và hành vi
key/TTL của cache; Playwright assert ô dải ATM render edge và badge cockpit xuất hiện;
ghi chú thủ công về số lượng lời gọi devInspect trong một lượt hover quét.

Trạng thái: done.

### S4 — Arb-free checker (sức khỏe surface)
Mục tiêu: cảnh báo khi surface bất nhất nội tại.

Việc:
1. `application/arbFreeCheck.ts` (thuần): kiểm tra butterfly (lồi của giá theo strike
   / không có mật độ ngụ ý âm) theo từng cột expiry và kiểm tra calendar (total
   variance không giảm theo expiry tại cùng moneyness) qua các cột. Trả về
   `ArbViolation[]` có kiểu kèm vị trí + rule nào.
2. Sức khỏe surface hiện trong `EdgePanel` (status "Surface OK" / "N violations", dấu
   + label + icon) và ô vi phạm được flag trên heatmap (không chỉ màu). Degrade gọn
   khi một cột thiếu SVI.

Chấp nhận: một lưới bất nhất dựng sẵn bị flag đúng vị trí; lưới lành báo sạch; vi phạm
không bao giờ bịa từ dữ liệu thiếu.

Kiểm chứng: `bun run build`; unit test cho kiểm tra butterfly + calendar trên lưới
dựng tay (lành + từng loại vi phạm); Playwright assert status sức khỏe render.

Trạng thái: pending.

### S5 — Time-travel slider (đường cắt)
Mục tiêu: replay các SVI update gần đây. Thứ đầu tiên bị cắt nếu thiếu thời gian.

Việc:
1. `volSurfaceService`: giữ một ring buffer bound của các snapshot surface gần đây (từ
   lịch sử `GET /oracles/{id}/svi` lúc load + update sống).
2. `TimeTravel.tsx`: một scrubber re-render heatmap + smile ở một snapshot quá khứ;
   "Live" snap về hiện tại. Reduced-motion: tức thì, không tween. Degrade về control
   "live only" disabled khi không có lịch sử.

Chấp nhận: scrub đổi surface render thành một snapshot quá khứ thật; "Live" về hiện
tại; vắng lịch sử thì disable control với nhãn rõ, không crash.

Kiểm chứng: `bun run build`; Playwright scrub và assert surface đổi rồi về live;
assert state disabled khi lịch sử rỗng.

Trạng thái: done.

### S6 — Prod-readiness (CORS), states, a11y, tests, docs
Mục tiêu: deploy-ready end to end, đánh bóng, accessible, và thêm surface vào smoke
probe.

Việc:
1. **Sửa CORS (quyết định 9):** làm bản build prod chạy không trắng trang. Dựng xử lý
   `VITE_TESTNET_RPC_URL` ở CẢ HAI tầng gọi thẳng fullnode trong prod:
   `src/predict-surface-studio/main.tsx` + `src/predict-club-next/main.tsx` dapp-kit
   `createSuiClient` (hiện là `getJsonRpcFullnodeUrl` ở prod), và cấu hình RPC của
   tầng dữ liệu predict. Tài liệu hóa một provider CORS-friendly trong `.env.example`.
   Verify `bun run build` + `bun run preview` render studio và cockpit không lỗi CORS
   (hoặc với một yêu cầu set env var rõ ràng, có tài liệu).
2. Pass states: mỗi panel (heatmap, smile, edge, arb, time-travel) có state empty /
   loading / stale / disconnected đã định nghĩa. Không panel trắng, không số bịa,
   không em-dash.
3. Pass a11y: focus order, điều hướng bàn phím ô heatmap / chọn cột, ARIA trên matrix
   (role + label), audit contrast dải màu so với token (mỗi ô ghép màu với một số),
   verify reduced-motion.
4. Tests + probe: unit test xanh; mở rộng `scripts/predict-club-ui-smoke.mjs` (hoặc
   bản chị em) để phủ entry studio (mount, lưới heatmap có mặt, không lỗi console,
   không tràn desktop + mobile); một spec Playwright cho studio.
5. Docs: cập nhật `DESIGN.md` (hoặc một section studio) với model surface + edge; cập
   nhật trạng thái plan này; làm mới README plans.

Chấp nhận: bản build deploy render cả hai surface không lỗi CORS (hoặc với một yêu cầu
env một dòng có tài liệu); mọi panel có non-happy state; a11y pass; build + unit + e2e
+ smoke xanh.

Kiểm chứng: `bun run build`; `bun run preview` smoke; `bun run test:unit`;
`bun run test:e2e`; `node scripts/predict-club-ui-smoke.mjs` (mở rộng cho studio).

Trạng thái: pending.

## Tệp đụng tới (dự kiến)

Mới: `predict-surface-studio.html`, `src/predict-surface-studio/main.tsx`,
`plugins/predict-club/application/{sampleVolSurface,volSurfaceService,arbFreeCheck}.ts`,
`plugins/predict-club/domain/volSurface.ts`,
`plugins/predict-club/presentation/studio/{StudioShell,VolHeatmap,SmileSlice,EdgePanel,TimeTravel}.tsx`.

Sửa: `vite.config.ts` (đăng ký entry), `plugins/predict-club/plugin.tsx` (đăng ký
`PredictClub.Surface.Studio`), một rail cockpit (`ActionDock`/`ExposureRail`) cho badge
mispricing, `src/predict-club-next/main.tsx` + studio main (cấu hình RPC CORS),
`.env.example` (doc provider RPC), `package.json` (minor mỗi phase), `DESIGN.md`,
README index này.

Không đụng (cockpit chart-king giữ như plan 22 đã ship): `PriceChart.tsx`, layout
`CockpitShell.tsx`, `LifecycleRail`, `ContextRail`, `DockTabs`, `PredictClubContext`,
`domain/roundPhase.ts`, `domain/payoutPreview.ts` (tiêu thụ, không sửa),
`application/executeTradeplan.ts`, `data/`.

## Chiến lược commit

Commit nhỏ, mỗi phase một cái (S0 -> S6 theo thứ tự), bump minor package.json mỗi
phase, body message ghi checkpoint để revert được, giống plan 22.

## Rủi ro mở

- **Lượng devInspect (S3).** Kể cả dải ATM + lazy + cache vẫn có thể nặng nếu dải rộng
  hoặc hover giật. Bound dải chặt, debounce hover, cap concurrency; nếu testnet vẫn
  căng, thu về chỉ quote khi click. Đây là khoảnh khắc pressure-test quyết định 8.
- **Độ trễ fan-out SVI (S1).** Vài oracle x một SVI fetch mỗi cái lúc load. Bound vào
  oracle active/expiry-tương-lai, parallelize, và hiện cột khi chúng về thay vì chặn
  cả lưới.
- **Heatmap đọc ra "pro" (S1).** Cùng rủi ro như king chart ở plan 22: nếu matrix
  underwhelm ở S1, sửa density/contrast/typography trước khi S2+ xây trên nó.
- **Tính trung thực của realized-vol (S2).** Cửa sổ Binance 60 phút là ước lượng
  ngắn; ghi nhãn rõ (hiện độ dài cửa sổ) để IV-vs-realized không bị thổi phồng.
- **Scope time-travel (S5).** Tường minh là đường cắt. Nếu S0-S4 + S6 chạy dài, ship
  không có nó; surface + edge + arb-free đã đủ truyền tải luận điểm.
