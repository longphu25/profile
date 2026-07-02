# Quyết Định

Hãy dùng thư mục này cho các quyết định bền vững và các tradeoff dài hạn.

Tạo một bản ghi quyết định khi một thay đổi làm thay đổi đáng kể kiến trúc,
authorization, boundary của wallet/signing, hành vi của provider, yêu cầu
validation, hoặc product contract nhìn thấy bởi người dùng.

Dùng `../templates/decision.md` cho các bản ghi mới.

## Bản Ghi

| File | Quyết định |
| --- | --- |
| [predict-club-architecture.md](predict-club-architecture.md) | Predict Club khởi đầu như một lớp điều phối lai, không custody, và dời việc custody DUSDC gộp sang group vault có policy guard trong tương lai. |
| [predict-club-funding-escrow.md](predict-club-funding-escrow.md) | Predict Club dùng mô hình P2P escrow exchange để nạp vốn USDC sang DUSDC thay vì coi USDC là quote asset của Predict. |
| [btc-chart-exchange-backend.vi.md](btc-chart-exchange-backend.vi.md) | Giai đoạn 1: CF Worker CORS OKX/MEXC trên Pages tĩnh; giai đoạn 2: Convex hoặc D1 aggregate OI đa sàn. |
