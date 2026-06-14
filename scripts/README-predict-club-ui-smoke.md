# predict-club-ui-smoke.mjs — UI smoke probe

## Mục đích

Kiểm tra headless rằng cockpit (chart-king, plan 22) **render đúng** trên route
Next ở cả desktop và mobile. Đây là companion chạy-tay của
`tests/e2e/predict-club-cockpit.spec.ts`: cùng surface, nhưng một lượt nhanh,
report dễ đọc, và exit code phản ánh pass/fail — hợp cho sanity check local hoặc
một CI smoke gate.

Khác với `predict-club-probe.mjs` (đọc state on-chain: balances, oracle, vault,
quote), script này chỉ probe DOM của UI.

## Chạy

```bash
# dev server phải đang chạy (bun run dev)
bun run probe:ui              # hoặc: node scripts/predict-club-ui-smoke.mjs
node scripts/predict-club-ui-smoke.mjs --json
```

> Phải chạy bằng `node`, không phải `bun`: project pin playwright 1.59.x, còn
> bun resolve một playwright-core mới hơn với browser build chưa cài.

## Cấu hình

Thứ tự ưu tiên: **CLI flag > biến môi trường (.env) > default**.

| Env var | Flag | Default | Mô tả |
|---|---|---|---|
| `PC_SMOKE_URL` | `--url` | `http://127.0.0.1:5173` | Origin của dev server |
| `PC_SMOKE_ENTRY` | `--entry` | `predict-club-next.html` | File entry HTML |
| `PC_SMOKE_WAIT_MS` | `--wait` | `9000` | Chờ live prices về (ms) |
| `PC_SMOKE_DESKTOP` | `--desktop` | `1440x900` | Viewport desktop |
| `PC_SMOKE_MOBILE` | `--mobile` | `390x844` | Viewport mobile |

Biến nằm trong `.env` (gitignored). Mẫu tham khảo ở `.env.example` (block
`PC_SMOKE_*`). Script tự nạp `.env`, nhưng giá trị đã có sẵn trong `process.env`
luôn thắng (để CI / shell override được).

## Các check

- `cockpit mounts` — `[data-pc-cockpit]` có mặt
- `chart zone / lifecycle rail / action rail / exposure rail` — mỗi rail mount
- `chart spot + forward lines` — 2 polyline (spot + forward), hoặc state
  "Collecting" / "No oracle feed" khi giá chưa về
- `disconnected gating` — Connect hiện, nút submit-up/submit-down ẩn
- `no desktop/mobile x-overflow` — không tràn ngang ở cả hai width
- `mobile CTA bar` → `sheet opens on tap` → `Escape closes sheet`
- `no severe console errors` — lỗi fullnode testnet / Binance được lọc bỏ

Exit code `0` nếu tất cả pass, `1` nếu có check fail (hoặc probe không chạy được).
