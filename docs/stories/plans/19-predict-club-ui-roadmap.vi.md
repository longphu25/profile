# Roadmap Triển Khai Giao Diện Predict Club

## Mục Tiêu

Chuyển prototype Predict Club hiện tại thành cockpit DeepBook Predict rõ ràng,
đặt ví ở trung tâm. Kế hoạch này chia UI thành các bước có thể triển khai và
kiểm chứng độc lập.

Tài liệu chuẩn:

- `docs/product/predict-club.md`
- `docs/product/predict-club-ui-requirements.vi.md`
- `docs/deepbook/predict-club-data-contract.vi.md`
- `docs/deepbook/predict-club-devinspect-pricing.vi.md`
- `docs/deepbook/predict-club-payout-preview.vi.md`
- `docs/stories/plans/16-predict-club-wallet-profile-popup.vi.md`

## Baseline Hiện Tại

Đã triển khai hoặc triển khai một phần:

- Predict Club page và plugin shell.
- Decision strip với BTC spot/forward/oracle summary.
- Wallet profile popup mount qua `plugins/sui-wallet-profile`.
- Tách `PredictClubContext` để ổn định Fast Refresh.
- Cache wallet profile và fallback khi RPC trả 429.
- Công việc ban đầu cho contract quote và payout preview.
- Funding router, escrow offers, round history, portfolio/vault summaries ở mức
  UI một phần.

Khoảng trống đã biết:

- Một số field từ Predict server và Sui object vẫn là `Unavailable`.
- Mapping lỗi contract quote cần message sạch hơn cho người dùng.
- Range positions cần hiển thị rõ.
- Active oracle selection cần modal/list đầy đủ hơn.
- Funding routes ngoài Direct DUSDC chưa wallet-signed đầy đủ.
- Tests mới bao phủ smoke path hẹp.

## Phase 1: Ổn Định Data Contracts

Mục tiêu:

Làm rõ shape dữ liệu của app và đảm bảo mọi panel đọc từ một shared snapshot.

Trạng thái: đã triển khai trong `0.45.3`.

Việc cần làm:

1. Audit state/actions trong `PredictClubContext` theo
   `predict-club-data-contract.vi.md`.
2. Đảm bảo oracle state có spot, forward, expiry, freshness, price ticks và
   latest SVI.
3. Đảm bảo manager snapshot giữ dữ liệu tốt gần nhất khi một sub-read fail.
4. Đảm bảo vault snapshot expose available liquidity, max payout, utilization
   và wallet LP share nếu có.
5. Chuẩn hóa mọi lý do `Unavailable` để UI giải thích được.

Acceptance:

- Không panel nào tự fetch oracle, wallet, manager hoặc vault nếu context đã sở
  hữu dữ liệu đó.
- `Unavailable` luôn đi cùng reason.
- Wallet popup vẫn mở được và không spam balance RPC.

Validation:

- `bun run build`
- unit tests tập trung cho data normalization nếu test harness đã có
- manual active oracle check khi RPC/API khả dụng

Ghi chú triển khai:

- `PredictPricingSnapshot` giờ có `managerReason` và `vaultReason` để trạng
  thái `Unavailable` giải thích được.
- `PredictClubContext` giữ manager/vault snapshot tốt gần nhất khi một sub-read
  sau đó fail.
- `RiskGateInput` nhận thêm trạng thái oracle active, forward price, SVI, quote
  và vault availability từ shared context snapshot.
- `Risk Checks` giờ hiển thị các check `Oracle active`, `Forward price`,
  `SVI surface`, `Contract quote` và `Vault liquidity`.
- `RiskPanel` hiển thị lý do manager/vault unavailable thay vì copy chung chung.
- Thêm ambient type declaration cho `bun:test` để project build type-check được
  các test file nằm trong `plugins/`.

Validation đã chạy:

- `bun run build`
- `bun run test:unit`

## Phase 2: Hoàn Thiện Decision Strip

Mục tiêu:

Biến decision strip thành nguồn round context chính.

Trạng thái: đã triển khai trong `0.45.4`.

Việc cần làm:

1. Cố định thứ tự ô: Asset, Forward, Direction, Strike, Expiry, Pledged,
   Price Ticks, Active Oracles.
2. Render BTC spot và forward với money/data emphasis.
3. Dùng 24 price ticks cuối cho mini chart với kích thước ổn định.
4. Đưa toàn bộ oracle selection UI sang phía phải.
5. Thêm selected/active state cho oracle list rows.
6. Hiển thị stale/missing state inline mà không làm layout nhảy.

Acceptance:

- Người dùng thấy selected oracle, price, forward, direction, strike, expiry,
  pledged amount và tick count mà không mở panel khác.
- Active Oracles mở/đóng được mà không che primary action.

Validation:

- Playwright screenshot desktop và mobile.
- Không có text overlap trong strip.

Ghi chú triển khai:

- Thứ tự Decision Strip hiện là Asset, Forward, Direction, Strike/Range,
  Expiry, Pledged, Price ticks, rồi Active Oracles/actions bên phải.
- BTC spot và forward dùng nhấn mạnh kiểu money/data.
- Expiry gộp expiry của selected oracle và freshness trong một ô compact.
- Price ticks render thành mini chart 24 tick có width ổn định và badge số
  lượng cố định.
- Active Oracles mở từ phía phải và hiển thị selected state, expiry, oracle id,
  cùng trạng thái Price/SVI đã load cho selected oracle.
- Fallback static `predict-club.html` đã được cập nhật để khớp terminology và
  thứ tự strip.

Validation đã chạy:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 3: Dọn Risk Và Exposure

Mục tiêu:

Làm right panel rõ cho người mới và chính xác cho người dùng nâng cao.

Trạng thái: đã triển khai trong `0.45.5`.

Việc cần làm:

1. Chỉ giữ một readiness block: `Risk Checks`.
2. Bỏ các block ready/execution trùng lặp.
3. Rebuild `Your Exposure` với:
   - estimated cost
   - win probability
   - gross if win hoặc indicative payout
   - potential profit
   - risk/reward
4. Thêm format số chặt chẽ.
5. Thêm lý do `Preview unavailable` ngắn.
6. Map raw Move abort thành quote reason cho người dùng.

Acceptance:

- UI không hiện raw number quá dài.
- `Win Probability` không hiện `0.0%` sai do thiếu data.
- Quote failures ngắn và có thể hành động.

Validation:

- unit tests cho display formatting và quote error mapping
- Playwright check cho trạng thái preview unavailable

Ghi chú triển khai:

- `Your Exposure` hiện năm metric gọn: estimated cost, win probability, gross
  if win, potential profit và risk/reward.
- Probability thiếu hoặc degraded hiển thị `—`; probability bị floor hiển thị
  `<0.1%`.
- DUSDC lớn dùng compact formatting để UI không lộ raw contract-scale number.
- Lỗi `devInspect` dài và Move abort được rút gọn trước khi hiển thị nhưng vẫn
  giữ lý do có thể hành động.

Validation đã chạy:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 4: Wallet Profile Và Address UX

Mục tiêu:

Làm thông tin wallet/account/object dùng được ở mọi nơi.

Trạng thái: đã triển khai trong `0.45.5`.

Việc cần làm:

1. Đưa shared address control cho copy và SuiScan testnet links.
2. Áp dụng cho wallet profile, PredictManager id, oracle id, vault id và
   position ids.
3. Chỉ mount wallet profile khi mở.
4. Giữ cache wallet/profile reads và in-flight guard.
5. Thêm đóng bằng keyboard và focus handling nếu còn thiếu.

Acceptance:

- Click vào address-like value copy được full value hoặc có copy icon rõ.
- Object id link tới `/object/<id>` và account address link tới
  `/account/<address>`.
- Popup tương tác mượt.

Validation:

- Playwright popup open/close test
- assert link URL
- không có console error nghiêm trọng

Ghi chú triển khai:

- Thêm shared Predict Club `AddressControl` để copy và mở SuiScan testnet.
- Áp dụng address/object control cho wallet row, PredictManager id, oracle row
  đã chọn và Predict positions trong wallet profile.
- Account link dùng `/account/<address>`; object-like id dùng `/object/<id>`.
- Wallet profile popup tự focus khi mở và có thể đóng bằng `Escape`.
- Embedded wallet profile vẫn return `null` khi đóng, nên UI profile nặng chỉ
  mount khi đang hiển thị.

Validation đã chạy:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 5: Portfolio, Range Positions Và Vaults

Mục tiêu:

Hiển thị ví đang sở hữu gì và thanh khoản nào đang backing round.

Trạng thái: đã triển khai trong `0.45.6`.

Việc cần làm:

1. Parse và render binary positions.
2. Parse và render range positions.
3. Hiển thị row unsupported thay vì ẩn position.
4. Thêm label claimable/settled/open.
5. Resolve vault liquidity và max payout từ server hoặc chain reads.
6. Hiển thị wallet PLP balance và LP share nếu có.

Acceptance:

- Ví đã kết nối thấy được có open Predict positions hay không.
- Range positions hiển thị được.
- Vault metrics không dùng số demo nếu không ghi nhãn.

Validation:

- script/manual check với wallet đã biết
- Playwright cho portfolio empty và populated states

Ghi chú triển khai:

- `RiskPanel` giờ hiển thị các row vị thế thay vì chỉ tổng số open.
- Wallet profile hiển thị số lượng open, binary và range cùng một section
  vault backing riêng.
- Vault metrics hiển thị rõ liquidity, max payout, withdrawal và LP share,
  không còn ẩn sau placeholder chung.
- Mỗi position row cho thấy oracle id và strike context khi có dữ liệu.
- Shared wallet profile payload giữ lại binary/range details để popup và các
  panel khác dùng chung.

Validation đã chạy:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 6: Funding Router Và Escrow

Mục tiêu:

Làm bước nạp vốn của member dễ hiểu trước khi automation on-chain đầy đủ.

Việc cần làm:

1. Giữ Direct DUSDC là route fully ready duy nhất nếu chưa có signed
   integration khác.
2. Ghi nhãn chính xác cho swap, bridge, borrow và escrow.
3. Thêm flow create/fill/cancel offer nơi local hoặc on-chain support đã có.
4. Viết disabled reason ngắn.
5. Đưa giải thích dài vào modal hoặc docs.

Acceptance:

- Member mới thấy rõ funding route nào dùng được.
- Preview-only routes không bị hiểu nhầm là transaction đã execute.

Validation:

- Playwright funding modal test
- disabled-state regression check

Status: implemented trong `0.46.0`.

## Phase 7: Round Lifecycle Và Actions

Mục tiêu:

Để primary action đi theo lifecycle round.

Việc cần làm:

1. Chuẩn hóa phase: Draft, Funding, Ready, Executing, Open Position, Expired,
   Settled, Claimable, Claimed.
2. Derive primary action duy nhất từ wallet state, manager state, funding
   state, quote state và round phase.
3. Disable action không thể dùng với lý do rõ.
4. Thêm settled/claimable actions khi có dữ liệu.

Acceptance:

- Trang không bao giờ hiện hai primary actions cạnh tranh nhau.
- Member mới đi theo được:

```text
Connect Wallet -> Create Manager -> Fund/Pledge DUSDC -> Review Risk -> Sign & Execute
```

Validation:

- unit tests kiểu state machine nếu khả thi
- Playwright checks cho disconnected và connected states

Status: implemented trong `0.46.0`.

## Phase 8: Tests Và Documentation Hardening

Mục tiêu:

Ngăn regression khi feature mở rộng.

Việc cần làm:

1. Thêm tests cho payout preview, probability formatting, quote error mapping,
   risk aggregation và address formatting.
2. Mở rộng Playwright coverage:
   - page render được
   - wallet triggers tồn tại
   - wallet popup mở được
   - Active Oracles mở được
   - Signal Evidence mặc định đóng
   - Funding modal mở được
   - không có page error nghiêm trọng
3. Giữ docs cập nhật trong:
    - `docs/product/`
    - `docs/deepbook/`
    - `docs/stories/plans/`
    - `docs/decisions/` khi tradeoff trở thành quyết định lâu dài

Status: implemented trong `0.46.0`.
4. Chạy QMD index sau docs changes.
5. Chạy CodeGraph index sau source changes lớn.

Acceptance:

- Build và focused tests pass trước khi commit.
- Docs mô tả đúng behavior hiện tại và bước triển khai kế tiếp.

Validation:

- `bun run build`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`
- `qmd update -c profile-docs`
- `bun run codegraph:index` sau source changes

## Chiến Lược Commit

Chia commit nhỏ:

1. docs/product và deepbook contract updates
2. context/data service changes
3. UI phase changes
4. tests
5. docs/index refresh

Trước code commits, bump `package.json` theo repo policy:

- patch cho focused fixes
- minor cho feature work rộng hơn
