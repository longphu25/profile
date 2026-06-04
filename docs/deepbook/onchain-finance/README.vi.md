# Sui On-chain Finance — Phân Tích Sâu

Tài liệu kỹ thuật toàn diện cho các primitive tài chính on-chain của Sui, kèm
hướng dẫn thực tế cho TypeScript SDK `@mysten/deepbook-v3`.

## Tài Liệu

| Chủ đề | Tiếng Anh | Tiếng Việt |
|-------|---------|------------|
| Closed-Loop Token | [closed-loop-token.md](./closed-loop-token.md) | [closed-loop-token.vi.md](./vi/closed-loop-token.vi.md) |
| Permissioned Asset Standard (PAS) | [pas.md](./pas.md) | [pas.vi.md](./vi/pas.vi.md) |
| DeepBookV3 (CLOB) | [deepbookv3.md](./deepbookv3.md) | [deepbookv3.vi.md](./vi/deepbookv3.vi.md) |
| DeepBook Margin | [deepbook-margin.md](./deepbook-margin.md) | [deepbook-margin.vi.md](./vi/deepbook-margin.vi.md) |
| DeepBook Predict | [deepbook-predict.md](./deepbook-predict.md) | [deepbook-predict.vi.md](./vi/deepbook-predict.vi.md) |
| Tham chiếu SDK `@mysten/deepbook-v3` | [sdk-reference.md](./sdk-reference.md) | [sdk-reference.vi.md](./vi/sdk-reference.vi.md) |

## Thứ Tự Nên Đọc

1. **Closed-Loop Token** — khối xây dựng cho token có luồng bị giới hạn (nền tảng)
2. **PAS** — hệ thống cấp quyền tài sản đầy đủ (mở rộng khái niệm CLT)
3. **DeepBookV3** — sàn CLOB nền, được dùng trực tiếp và bởi margin/predict
4. **DeepBook Margin** — lớp leverage chạy trên DeepBookV3
5. **DeepBook Predict** — thị trường dự đoán vol-surface (kết hợp với toàn bộ phần trên)
6. **SDK Reference** — mã TS thực tế cho toàn bộ phần trên

## Nguồn Đọc

- Tài liệu chính thức: https://docs.sui.io/onchain-finance/
- SDK: `node_modules/@mysten/deepbook-v3` (v1.4.1)
- Mã nguồn Predict: https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16

## Tham Chiếu Bên Ngoài

| Dự án | Loại | Use case |
|---------|------|----------|
| [predict-cli](https://github.com/SeventhOdyssey71/predict-cli) | Rust CLI | Tham chiếu Predict chính xác nhất: full mint/redeem flow, định giá SVI local, lớp perps tác tử |
| [mcxross/deepbook-cli](https://github.com/mcxross/deepbook-cli) | TS CLI + TUI | CLI production cho spot/margin/predict. Tham chiếu cho cách dùng SDK |
| [mcxross/skills](https://github.com/mcxross/skills) | Skill bundles | Bộ kỹ năng cho AI agent, gồm cả `deepbook-cli` |
| [KZN-Labs/DeepDive](https://github.com/KZN-Labs/DeepDive) | Go server | Streaming order book thời gian thực (event subscriber → WebSocket + REST) |

## Các Sửa Lỗi Quan Trọng Rút Ra Từ Tham Chiếu

Những chi tiết này không hiển nhiên nếu chỉ đọc docs chính thức, nhưng lại là
điều kiện thiết yếu để code chạy đúng:

### Predict mint cần 3 giao dịch

```
TX 1: predict::create_manager  → chờ indexer
TX 2: predict_manager::deposit<DUSDC>  ← thường bị bỏ sót!
TX 3: predict::mint hoặc mint_range
```

Hàm `mint` đọc số dư từ balance của manager, không đọc từ ví. Nếu thiếu TX 2,
lệnh mint sẽ fail vì không đủ tiền.

### Xác thực strike

```
strike >= min_strike  AND  (strike − min_strike) % tick_size == 0
```

### Công thức định giá (chính xác)

```
k = ln(K / F)
w(k) = a + b · (ρ·(k−m) + √((k−m)² + σ²))
d₂ = −k/√w − √w/2
P(S_T > K) = N(d₂)              ← giá trị hợp lý của binary UP
```

Giá on-chain còn cộng thêm spread + điều chỉnh theo utilization, nên phía client
không thể tái tạo chính xác nếu không có `devInspect`.

### Biên settlement

- Binary UP thắng khi và chỉ khi `settlement > strike` (strict)
- Range thắng khi và chỉ khi `lower < settlement ≤ higher` (open-closed)
