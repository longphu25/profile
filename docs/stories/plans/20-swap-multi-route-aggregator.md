# 20 — Swap Multi-Route Aggregator

> Story: Nâng cấp plugin `sui-swap` từ single-DEX (DeepBook only) thành multi-route aggregator
> hỗ trợ DeepBook (CLOB), Cetus (AMM), Turbos (AMM).

**Status:** Planning  
**Priority:** High  
**Estimate:** 2-3 sessions  

## Mục tiêu

- User thấy quote từ 3 DEX cùng lúc, chọn route tốt nhất
- Tốc độ nhanh: gọi song song, timeout 3s, streaming render
- Mở rộng dễ dàng: thêm DEX mới chỉ cần thêm 1 fetcher file

## Phạm vi

### Trong scope
- Quote comparison UI (3 routes)
- DeepBook execution (giữ nguyên logic hiện tại)
- Cetus quote + execution via aggregator API
- Turbos quote + execution via API
- Best route badge + price impact warning
- Debounce, timeout, cache, streaming

### Ngoài scope
- Split routing (chia order qua nhiều DEX)
- Multi-hop custom paths
- Token list management UI
- Limit orders qua Cetus/Turbos

## Kế hoạch chi tiết

### Task 1: Tạo lib layer (types + utils)
- `plugins/sui-swap/lib/types.ts` — QuoteParams, RouteQuote, DexId
- `plugins/sui-swap/lib/utils.ts` — withTimeout, debounce, formatters, cache

### Task 2: Route fetchers
- `plugins/sui-swap/lib/deepbook.ts` — Wrap existing DeepBook logic thành fetcher
- `plugins/sui-swap/lib/cetus.ts` — Cetus aggregator API integration
- `plugins/sui-swap/lib/turbos.ts` — Turbos API integration
- `plugins/sui-swap/lib/router.ts` — Orchestrator: parallel fetch + sort + cache

### Task 3: React hook
- `plugins/sui-swap/hooks/useSwapQuotes.ts` — streaming quotes hook

### Task 4: UI updates
- Route selector cards (hiện tất cả quotes, highlight best)
- Loading skeleton per-route (streaming)
- DEX logo/badge cho mỗi route
- Price impact warning (> 1% yellow, > 3% red)
- Fee comparison row

### Task 5: Execute via selected route
- DeepBook: giữ nguyên `swapExactBaseForQuote` / `swapExactQuoteForBase`
- Cetus: deserialize TX từ API → sign via wallet
- Turbos: deserialize TX từ API → sign via wallet

### Task 6: Style updates
- Route card styles
- Active/best badge
- Loading states
- Mobile responsive

## Dependencies

- `@mysten/deepbook-v3` ✅ (đã có)
- Cetus API: public, no key required
- Turbos API: public, no key required

## Acceptance criteria

1. User nhập amount → thấy quotes từ ≥2 DEX trong < 4 giây
2. Best route được highlight tự động
3. Swap execution thành công qua route được chọn
4. Nếu 1 DEX timeout/fail, các route khác vẫn hiển thị
5. Price impact > 3% hiện warning đỏ
6. Mobile responsive

## Tài liệu liên quan

- `docs/defi/swap-router-optimization.md` — Chi tiết kỹ thuật
- `plugins/sui-swap/plugin.tsx` — Code hiện tại
- `node_modules/@mysten/deepbook-v3/` — DeepBook SDK reference
