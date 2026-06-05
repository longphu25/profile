#!/usr/bin/env bash
set -euo pipefail

REPO="longphu25/profile"

# Đảm bảo đã:
#   gh auth login
#   gh auth status

issues=(
  # =====================
  # P0 – Safety & core flow
  # =====================

  "P0: riskGate – chuẩn hóa policy checks|Refactor evaluateRiskGate() để:
- Trả về danh sách checks đầy đủ cho oracle, expiry, funding, signal.
- Mỗi check có: id, label, passed, severity (warning/blocking), message, actionHint.
- Thêm state tổng: ready / warning / blocked / unknown.
- Đưa các ngưỡng (stale threshold, minSafeExpiry, v.v.) xuống policies.ts thay vì hard-code trong UI.|P0,risk,backend"

  "P0: RiskPanel – hiển thị blockingReasons dễ hiểu|Cập nhật RiskPanel để:
- Lấy RiskGateResult mới (state + checks).
- Hiển thị banner tổng: Ready / Warning / Blocked với copy dễ hiểu cho user mới.
- Render blockingReasons thành checklist, nhóm theo: Tiền & số dư, Dữ liệu thị trường, An toàn giao dịch.
- Mỗi lý do có title ngắn, detail, actionLabel và onClick mở đúng panel (FundingRouter, oracle section, PredictionRoom).|P0,risk,UX"

  "P0: DecisionStrip – tôn trọng riskEval.state|Kết nối DecisionStripPanel với riskEval:
- Khi state=ready: CTA chính là 'Ký lệnh Predict' hoặc hành động hợp lệ tiếp theo.
- Khi state=warning: CTA cho phép tiếp tục nhưng phải có confirm dialog.
- Khi state=blocked/unknown: CTA chính bị disable, hiển thị lý do block ngắn gọn và link 'Xem chi tiết rủi ro' mở RiskPanel.|P0,core,UX"

  "P0: confirmRound – bắt buộc snapshot indicator & risk|Cập nhật application/confirmRound.ts để:
- Bắt buộc gọi snapshot indicator (BTC + DeepBook state) trước khi cho confirm.
- Lưu lại indicatorReasons và riskChecks vào round để RoundHistoryPanel có đủ dữ liệu thesis evidence.
- Nếu RiskGate state=blocked thì không cho confirm.|P0,backend,risk"

  "P0: executeTradeplan – đảm bảo V1 user-signed & respect riskGate|Cập nhật executeTradeplan.ts để:
- Đảm bảo V1 chỉ dùng user-signed flow, không bot giữ private key.
- Check riskGate trước khi build PTB, nếu state=blocked thì không gọi gateway.
- Nếu thiếu DUSDC hoặc PredictManager chưa funded thì điều hướng user sang FundingRouterPanel thay vì fail mơ hồ.|P0,backend,risk"

  # =====================
  # P1 – Funding & indicator UX
  # =====================

  "P1: FundingRouter – wizard 4 bước nạp DUSDC|Thiết kế lại FundingRouterPanel thành wizard:
1) Hỏi user đang có gì (SUI / tài sản chain khác / không có gì).
2) Gợi ý route chính (swap trên DeepBook, borrow Scallop, bridge).
3) Sau khi có USDC, show EscrowOffers để đổi sang DUSDC.
4) Hướng dẫn deposit DUSDC vào PredictManager và quay lại round.
Kết nối với recommendFundingRoute.ts để chọn route tốt nhất.|P1,funding,UX"

  "P1: EscrowOffersPanel – làm rõ P2P DUSDC funding|Cập nhật EscrowOffersPanel để:
- Hiển thị danh sách offer (leader / member) với rate, size, expiry.
- Làm nổi bật offer của leader hoặc offer được club tin cậy.
- Cho phép user fill offer và quay lại FundingRouter/RiskPanel.
- Thêm empty state: chưa có offer thì giải thích cơ chế.|P1,funding,UX"

  "P1: indicatorConsensus – explainable signal bias|Nâng cấp domain/indicatorConsensus.ts để:
- Trả về không chỉ bias (bullish/bearish/neutral/no-trade) mà cả list indicatorReasons ngắn gọn.
- Thêm confidence (thấp/vừa/cao) để PredictionRoomPanel và RiskPanel có thể giải thích tại sao hệ thống khuyên 'no-trade' hoặc 'cẩn trọng'.|P1,backend,risk"

  "P1: PredictionRoomPanel – diễn giải kèo Predict cho người mới|Cập nhật PredictionRoomPanel.tsx để:
- Diễn giải CommunityPrediction thành câu tiếng Việt đời thường: direction, strike/range, expiry, size, payout/ max loss.
- Hiển thị 3–5 indicatorReasons nổi bật.
- Giải thích rule settlement (binary up: settlement > strike; range: lower < settlement ≤ higher).|P1,UX,content"

  # =====================
  # P1 – Lifecycle & history
  # =====================

  "P1: roundLifecycle – thêm cancelRound & policy failure|Cập nhật domain/roundLifecycle.ts để:
- Thêm transition cho cancelRound khi round đang open.
- Thêm transition 'confirmed -> cancelled' khi policy/riskGate fail.
- Đảm bảo mọi transition hợp lệ được encode rõ ràng để UI DecisionStrip/RoundHistory dùng chung.|P1,backend,core"

  "P1: RoundHistoryPanel – hiển thị PnL & thesis evidence|Cập nhật RoundHistoryPanel.tsx để:
- Hiển thị danh sách round kèm PnL, participation, thesis evidence (indicator snapshot, riskChecks khi confirm).
- Cho phép lọc theo kết quả (win/loss) và role (leader/member).
- Empty state cho club mới: hướng dẫn leader tạo round đầu tiên.|P1,UX,analytics"

  # =====================
  # P2 – UX polish & mobile
  # =====================

  "P2: Mobile layout – tabs Room/Risk/Members/History|Cải thiện PredictClubRoot.tsx để:
- Trên mobile, dùng 4 tab: Room, Risk, Members, History như trong product doc.
- Thêm sticky bottom primary action tương ứng với DecisionStrip.
- Đảm bảo RiskPanel vẫn dễ đọc trên màn hình nhỏ (checklist không bị overflow).|P2,UX,mobile"

  "P2: ModalLayer – tách nhỏ modal & thêm onboarding tour|Refactor ModalLayer.tsx để:
- Tách modal createRound/confirmRound/executeTrade/funding tour thành component riêng nếu cần.
- Thêm onboarding modal lần đầu vào Predict Club giải thích vòng đời round và vai trò leader/member/observer.
- Đảm bảo modal không chặn keyboard navigation.|P2,UX,refactor"

  "P2: Style & theming – align với DESIGN.md Terminal theme|Rà soát style.css và toàn bộ panel để:
- Đảm bảo dùng đúng token màu/typography/radius như trong plugins/predict-club/DESIGN.md.
- Loại bỏ hard-code màu, class thừa, và đảm bảo dark-only theme nhất quán (terminal style).
- Kiểm tra lại contrast & readability cho long-session trading.|P2,UX,design"
)

for item in "${issues[@]}"; do
  IFS='|' read -r title body labels <<< "$item"
  IFS=',' read -ra label_arr <<< "$labels"

  cmd=(gh issue create --repo "$REPO" --title "$title" --body "$body")
  for label in "${label_arr[@]}"; do
    cmd+=(--label "$label")
  done

  echo "Creating issue: $title"
  "${cmd[@]}"
done