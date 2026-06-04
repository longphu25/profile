# Kế Hoạch Kiến Trúc Predict Manager Bot

## Tóm Tắt

Thiết kế hỗ trợ bot cho các tài khoản `PredictManager` của người dùng mà không
custody thiếu an toàn hoặc vượt qua sự đồng ý của ví.

DeepBook Predict dùng một `PredictManager` shared object trên mỗi người dùng để
giữ quote balance và theo dõi vị thế binary/range. Bot có thể giám sát và hỗ
trợ manager này, nhưng không nên có quyền trực tiếp mint, redeem vị thế còn mở,
withdraw hay di chuyển tiền trừ khi người dùng ký giao dịch hoặc đã nạp tiền vào
một strategy vault riêng.

## 4 Vai Trò Bot

- `AssistantBot`
- `ExecutionAssistant`
- `KeeperBot`
- `StrategyVaultBot`

## Quy Tắc Cốt Lõi

Không thiết kế bot giữ private key của người dùng hoặc có quyền không giới hạn
trên `PredictManager` cá nhân của họ.

Với personal manager:
- bot có thể chuẩn bị hành động
- owner của ví phải ký các bước nhạy cảm

Với automation thật:
- dùng strategy vault hoặc delegated-manager contract riêng, có giới hạn rõ ràng

## Mô Hình Quyền

Personal manager flow:
- bot đọc dữ liệu
- bot build PTB để người dùng rà soát
- người dùng ký

Keeper flow:
- bot dùng ví của chính nó
- gọi `predict::redeem_permissionless` cho các vị thế đã settled

Vault flow:
- user nạp tiền vào vault
- bot chỉ điều khiển vault-owned manager theo policy

## Execution Matrix

- read-only action: bot tự làm được
- user-sensitive action: bot chỉ chuẩn bị, người dùng phải ký
- permissionless settled redeem: keeper tự gửi được
- automated strategy trading: chỉ qua vault

## Test / Acceptance

- user chưa có manager
- user có manager nhưng chưa có DUSDC
- user có active oracle và DUSDC
- user có settled positions
- bot quét toàn bộ managers
- vault automation dùng explicit strategy limits
