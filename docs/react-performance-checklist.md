# Vercel React Best Practices Checklist

**Nguồn:** vercel-react-best-practices skill (Vercel Engineering)  
**Mục đích:** Review, viết mới hoặc refactor React / Next.js code theo 8 nhóm ưu tiên theo mức độ ảnh hưởng.

Sử dụng checklist này khi:
- Viết component hoặc page mới
- Implement data fetching
- Review performance
- Tối ưu bundle / re-render / load time

---

## 1. CRITICAL - Eliminating Waterfalls (`async-*`)

Mục tiêu: Tránh sequential fetches gây chậm.

- [ ] `async-cheap-condition-before-await` — Kiểm tra điều kiện rẻ (sync) trước khi await
- [ ] `async-defer-await` — Di chuyển `await` vào nhánh thực sự cần dùng
- [ ] `async-parallel` — Dùng `Promise.all()` cho các tác vụ độc lập
- [ ] `async-dependencies` — Sử dụng pattern partial dependencies thay vì sequential
- [ ] `async-api-routes` — Khởi tạo promise sớm, await muộn trong API routes
- [ ] `async-suspense-boundaries` — Dùng Suspense để stream content

---

## 2. CRITICAL - Bundle Size Optimization (`bundle-*`)

Mục tiêu: Giảm kích thước bundle và cải thiện load time.

- [ ] `bundle-barrel-imports` — Import trực tiếp, tránh barrel files (index.ts re-export)
- [ ] `bundle-dynamic-imports` — Dùng `next/dynamic` hoặc dynamic import cho component nặng
- [ ] `bundle-defer-third-party` — Load analytics, logging sau hydration
- [ ] `bundle-conditional` — Chỉ load module khi feature được kích hoạt
- [ ] `bundle-preload` — Preload resource khi hover/focus

---

## 3. HIGH - Server-Side Performance (`server-*`)

Mục tiêu: Tối ưu RSC, data fetching trên server.

- [ ] `server-auth-actions` — Xác thực server actions giống như API routes
- [ ] `server-cache-react` — Dùng `React.cache()` để dedup per-request
- [ ] `server-cache-lru` — Dùng LRU cache cho cross-request
- [ ] `server-dedup-props` — Tránh serialize trùng lặp props xuống client
- [ ] `server-hoist-static-io` — Hoist static I/O (fonts, images) lên module level
- [ ] `server-no-shared-module-state` — Tránh mutable state ở module level trong RSC/SSR
- [ ] `server-serialization` — Giảm tối đa dữ liệu truyền xuống client
- [ ] `server-parallel-fetching` — Tái cấu trúc component để fetch song song
- [ ] `server-parallel-nested-fetching` — Dùng Promise.all cho nested fetches
- [ ] `server-after-nonblocking` — Dùng `after()` cho công việc non-blocking

---

## 4. MEDIUM-HIGH - Client-Side Data Fetching (`client-*`)

Mục tiêu: Tối ưu fetching trên client.

- [ ] `client-swr-dedup` — Dùng SWR (hoặc tương đương) cho dedup request
- [ ] `client-event-listeners` — Dedup global event listeners
- [ ] `client-passive-event-listeners` — Dùng passive listeners cho scroll/touch
- [ ] `client-localstorage-schema` — Version và giảm thiểu dữ liệu localStorage

---

## 5. MEDIUM - Re-render Optimization (`rerender-*`)

Mục tiêu: Giảm re-render không cần thiết.

- [ ] `rerender-defer-reads` — Không subscribe state chỉ dùng trong callback
- [ ] `rerender-memo` — Trích xuất công việc đắt đỏ thành memoized component
- [ ] `rerender-memo-with-default-value` — Hoist default props không phải primitive
- [ ] `rerender-dependencies` — Dùng primitive dependencies trong effects
- [ ] `rerender-derived-state` — Subscribe derived boolean thay vì raw value
- [ ] `rerender-derived-state-no-effect` — Derive state trong render thay vì effect
- [ ] `rerender-functional-setstate` — Dùng functional setState cho stable callbacks
- [ ] `rerender-lazy-state-init` — Truyền function vào useState cho giá trị đắt
- [ ] `rerender-simple-expression-in-memo` — Tránh memo cho expression đơn giản
- [ ] `rerender-split-combined-hooks` — Tách hooks có dependencies độc lập
- [ ] `rerender-move-effect-to-event` — Đưa logic interaction vào event handler
- [ ] `rerender-transitions` — Dùng `startTransition` cho update không khẩn cấp
- [ ] `rerender-use-deferred-value` — Defer render đắt để giữ input responsive
- [ ] `rerender-use-ref-transient-values` — Dùng ref cho giá trị thay đổi thường xuyên
- [ ] `rerender-no-inline-components` — Không định nghĩa component bên trong component

---

## 6. MEDIUM - Rendering Performance (`rendering-*`)

Mục tiêu: Tối ưu render và hydration.

- [ ] `rendering-animate-svg-wrapper` — Animate wrapper div thay vì element SVG
- [ ] `rendering-content-visibility` — Dùng `content-visibility` cho list dài
- [ ] `rendering-hoist-jsx` — Trích xuất static JSX ra ngoài component
- [ ] `rendering-svg-precision` — Giảm độ chính xác tọa độ SVG
- [ ] `rendering-hydration-no-flicker` — Dùng inline script cho client-only data
- [ ] `rendering-hydration-suppress-warning` — Suppress mismatch dự kiến
- [ ] `rendering-activity` — Dùng Activity component cho show/hide
- [ ] `rendering-conditional-render` — Dùng ternary thay vì `&&` cho conditional
- [ ] `rendering-usetransition-loading` — Ưu tiên useTransition cho loading state
- [ ] `rendering-resource-hints` — Dùng React DOM resource hints (preload, preconnect)
- [ ] `rendering-script-defer-async` — Dùng defer/async cho script tags

---

## 7. LOW-MEDIUM - JavaScript Performance (`js-*`)

Mục tiêu: Micro-optimizations ở JS level.

- [ ] `js-batch-dom-css` — Group thay đổi CSS qua class hoặc cssText
- [ ] `js-index-maps` — Build Map/Set cho repeated lookups
- [ ] `js-cache-property-access` — Cache object properties trong loop
- [ ] `js-cache-function-results` — Cache kết quả function ở module level
- [ ] `js-cache-storage` — Cache localStorage / sessionStorage reads
- [ ] `js-combine-iterations` — Gộp filter + map + reduce thành 1 loop
- [ ] `js-length-check-first` — Kiểm tra length trước khi so sánh đắt
- [ ] `js-early-exit` — Return sớm khỏi function
- [ ] `js-hoist-regexp` — Hoist RegExp ra ngoài loop
- [ ] `js-min-max-loop` — Dùng loop thay vì sort cho min/max
- [ ] `js-set-map-lookups` — Dùng Set/Map cho O(1) lookup
- [ ] `js-tosorted-immutable` — Dùng toSorted() cho immutability
- [ ] `js-flatmap-filter` — Dùng flatMap để map + filter cùng lúc
- [ ] `js-request-idle-callback` — Defer công việc không quan trọng bằng requestIdleCallback

---

## 8. LOW - Advanced Patterns (`advanced-*`)

- [ ] `advanced-effect-event-deps` — Không đặt kết quả useEffectEvent vào effect deps
- [ ] `advanced-event-handler-refs` — Lưu event handlers trong refs
- [ ] `advanced-init-once` — Khởi tạo app chỉ một lần per load
- [ ] `advanced-use-latest` — Dùng useLatest cho stable callback refs

---

## Hướng dẫn sử dụng

- Bắt đầu từ nhóm **CRITICAL**, sau đó HIGH → MEDIUM...
- Mỗi rule có file chi tiết tại: `.agents/skills/vercel-react-best-practices/rules/<rule-name>.md`
- Khi review code hoặc refactor, tick các item đã áp dụng.
- Kết hợp với `AGENTS.md` trong thư mục skill để xem ví dụ đầy đủ.

**Ví dụ sử dụng nhanh:**
```
Review component này theo Vercel React best practices, ưu tiên CRITICAL và HIGH trước.
```

Checklist được tạo từ skill `vercel-react-best-practices` (cập nhật theo dữ liệu local).
