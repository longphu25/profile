# Development Workflow

## Scripts chính

Từ `package.json`:

- `bun run dev` hoặc `npm run dev`: chạy Vite dev server
- `bun run build`: chạy `tsc -b && vite build`
- `bun run lint`: lint toàn repo
- `bun run format`: format toàn repo bằng Biome
- `bun run preview`: preview build output

Repo có `bun.lock`, nên Bun là lựa chọn tự nhiên nhất.

## Cách nghĩ đúng về việc thêm feature

### Nếu là feature host/runtime

Chỉnh ở:

- `src/plugins/*` cho generic runtime
- `src/sui-dashboard/*` cho shared Sui runtime
- `src/sui-wasm/*` nếu liên quan WASM flow
- `vite.config.ts` nếu cần thay đổi build behavior

### Nếu là feature business/plugin

Chỉnh ở:

- `plugins/<plugin-name>/`
- sau đó đăng ký plugin vào dashboard tương ứng
- cuối cùng thêm entry trong `vite.config.ts`

## Scaffold plugin mới

### Plugin generic

```bash
node scripts/create-plugin.mjs my-plugin
```

### Sui plugin dual-mode

```bash
node scripts/create-sui-plugin.mjs my-sui-plugin
```

Template dual-mode được thiết kế để:

- chạy standalone trong `plugin-demo`
- hoặc chạy với shared wallet context trong `sui-dashboard`

## Checklist khi thêm plugin mới

1. Tạo `plugins/<name>/plugin.tsx`
2. Tạo `plugins/<name>/style.css`
3. Đăng ký vào dashboard cần dùng
4. Thêm build entry ở `vite.config.ts`
5. Nếu plugin có asset riêng, đảm bảo production copy path hợp lệ
6. Nếu thay đổi không nhỏ, bump version trong `package.json`

## Build conventions cần nhớ

- plugin được load bằng dynamic `import()`
- production build giữ tên file plugin ổn định dưới `assets/plugins/<name>.js`
- CSS plugin được copy sang `dist/plugins/<name>/style.css`
- nếu có thư mục `pkg/`, build cũng copy `.js`, `.wasm`, `.d.ts` sang `dist/plugins/<name>/pkg/`

## Shared Sui runtime conventions

Plugin Sui không nên tự quản lý wallet provider nếu đang chạy trong shared dashboard. Thay vào đó:

- lấy context qua `getSuiContext()`
- subscribe bằng `onSuiContextChange()`
- yêu cầu connect/disconnect/switch network qua host
- gọi signing/execution qua host thay vì truy cập wallet trực tiếp nếu flow đã được host quản lý

## Documentation conventions trong repo

- `docs/` là Obsidian vault thực tế
- root notes đóng vai trò index/map
- note theo domain nằm ở `deepbook/`, `defi/navi/`, `seal/`, `walrus/`
- khi thêm feature lớn, nên thêm ít nhất một note link từ [[INDEX]]

## Release note riêng của repo

Theo `AGENTS.md`:

- đổi nhỏ nhưng có tác động user-facing hoặc bảo trì thông thường: bump `patch`
- đổi rộng hơn về behavior/tính năng: bump `minor`
- chỉ có typo/comment rất nhỏ mới có thể bỏ qua version bump

## Điểm dễ quên

- không phải tạo plugin xong là dashboard nhìn thấy ngay; thường bạn còn thiếu bước registry và build input
- `src/App.tsx` không phải nơi tốt để dựa vào khi phân tích luồng chính của repo
- tài liệu feature sâu đã có sẵn; tài liệu mới nên ưu tiên đóng vai trò định vị và dẫn đường
