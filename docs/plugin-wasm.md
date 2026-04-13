Có, bạn **hoàn toàn có thể “nâng cấp” plugin sang dùng WASM**, nhưng về kiến trúc thực tế sẽ là:

- **Plugin entry vẫn là TypeScript/ESM** (để tương thích với plugin loader hiện tại).  
- **Phần logic nặng** (tính toán, xử lý data…) được chuyển sang một **WASM module** (Rust / AssemblyScript / TS→WASM) và được **load bên trong plugin TS** qua `import`/`fetch + WebAssembly.instantiate`. [stackoverflow](https://stackoverflow.com/questions/76477419/loading-wasm-with-react-ts-and-vitejs)

Không nên (và gần như không thể) làm plugin “thuần WASM” nếu loader hiện tại đang `import()` file `.ts/.js` và plugin cần truy cập DOM, Sui Wallet, v.v. vì WASM **không truy cập trực tiếp DOM hay WebExtension** mà phải đi qua JS host. [v4.vite](https://v4.vite.dev/guide/features)

***

## 1. Hiểu giới hạn: tại sao không thay thẳng `index.ts` bằng `.wasm`?

1. **Plugin loader hiện tại** (trong `src/plugins`) gần chắc chắn đang làm dạng:
   ```ts
   const mod = await import('/plugins/sui-wallet/index.ts');
   mod.default(profileContext);
   ```
   Loader này **kỳ vọng một ES module** export function/object TS/JS.  
2. Trình duyệt chỉ **import `.wasm` như module** nếu bạn có loader đặc biệt (VD: `vite-plugin-wasm` sinh ra wrapper ESM, hoặc chính bạn tự viết JS để `WebAssembly.instantiate`). [npmjs](https://www.npmjs.com/package/vite-plugin-wasm)
3. WASM **không thể tự gọi DOM, `window.suiWallet`, `chrome.runtime`…**, mà phải thông qua hàm “host” do JS cấp vào lúc instantiate. [v4.vite](https://v4.vite.dev/guide/features)

Vì thế cách khả thi nhất là:

> **Giữ plugin dạng TS/ESM làm “wrapper”**, bên trong wrapper **load và gọi WASM**.

***

## 2. Kiến trúc đề xuất cho plugin Sui Wallet

Giả sử hiện tại plugin `plugins/sui-wallet/index.ts` có dạng (giả định):

```ts
// index.ts hiện tại (giả lập)
import type { ProfilePluginContext } from '../../src/plugins/types';

export default function register(ctx: ProfilePluginContext) {
  ctx.registerWallet({
    id: 'sui-wallet',
    connect: async () => { /* gọi window.suiWallet */ },
    signTx: async (tx) => { /* ... */ },
  });
}
```

Bạn muốn chuyển 1 phần logic (ví dụ serialize tx, verify signature, encode/decode…) sang WASM.

### Bước 1: Viết core logic bằng WASM (Rust hoặc AssemblyScript)

**Ví dụ AssemblyScript** (TS-like, dễ cho bạn đang xài TS):

```ts
// wasm-src/sui_core.ts (AssemblyScript)
export function normalize_address(ptr: i32, len: i32): i32 {
  // nhận string từ memory, xử lý, trả về string mới (chi tiết bỏ qua)
  // ...
  return resultPtr;
}
```

Build:

```bash
npx asc wasm-src/sui_core.ts -b public/wasm/sui_core.wasm
```

Với Vite, bạn có thể dùng `vite-plugin-wasm` để import file này như 1 module. [github](https://github.com/Menci/vite-plugin-wasm)

### Bước 2: Cấu hình Vite để load WASM

Trong `vite.config.ts` của project `profile`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
});
```

Plugin này cho phép:

```ts
import init, { normalize_address } from '/wasm/sui_core.wasm?init';
```

và `init()` sẽ instantiate WASM. [npmjs](https://www.npmjs.com/package/vite-plugin-wasm)

### Bước 3: Viết lại `plugins/sui-wallet/index.ts` như 1 wrapper

```ts
// plugins/sui-wallet/index.ts (mới)
import type { ProfilePluginContext } from '../../src/plugins/types';
import initWasm, { normalize_address } from '/wasm/sui_core.wasm?init';

let wasmReady = false;

async function ensureWasm() {
  if (!wasmReady) {
    await initWasm();        // instantiate module
    wasmReady = true;
  }
}

export default function register(ctx: ProfilePluginContext) {
  ctx.registerWallet({
    id: 'sui-wallet',
    connect: async () => {
      // phần connect vẫn phải ở JS: gọi window.suiWallet, DOM, event, ...
      await ensureWasm();

      // ví dụ dùng WASM để chuẩn hóa address hoặc xử lý chuỗi
      const addr = await window.suiWallet.getAddress();
      const normalized = normalize_address(addr);
      return normalized;
    },
    signTx: async (tx) => {
      await ensureWasm();
      // có thể dùng WASM để chuẩn hóa/encode tx trước khi sign
      // const encoded = encode_tx_wasm(tx);
      return window.suiWallet.signTransaction(tx);
    },
  });
}
```

Như vậy:

- **Loader không cần đổi gì**: nó vẫn `import('plugins/sui-wallet/index.ts')` như trước.  
- **Core logic nặng** nằm trong `sui_core.wasm`.  
- **Tương tác Sui Wallet, DOM** vẫn ở JS (bnb/chrome API bắt buộc phải qua JS). [v4.vite](https://v4.vite.dev/guide/features)

***

## 3. Nếu muốn plugin “thuần WASM” thì sao?

Bạn vẫn có thể tiến thêm 1 bước: định nghĩa **ABI plugin ở mức WASM**, ví dụ plugin loader:

1. Fetch file `.wasm` theo cấu hình plugin:  
   ```ts
   const resp = await fetch('/plugins/sui-wallet/plugin.wasm');
   const { instance } = await WebAssembly.instantiateStreaming(resp, imports);
   const plugin = instance.exports;
   ```
2. Yêu cầu mỗi plugin export các hàm chuẩn như:
   - `init()`
   - `onClick(profilePtr, profileLen)`
3. Loader convert JS object `profile` sang bytes, viết vào WASM memory, lấy pointer, gọi `onClick`.

Nhưng cách này có nhược điểm:

- Bạn phải **thiết kế lại toàn bộ plugin system** + ABI, memory layout, encode/decode.  
- WASM vẫn **không gọi trực tiếp DOM/wallet**, nên loader phải cung cấp hàm host cho mọi thứ (log, alert, callWallet…).  

Đây là hướng phù hợp nếu bạn muốn:  
> “Plugin system trung lập ngôn ngữ, plugin có thể viết bằng Rust/Go/AssemblyScript, không chỉ JS”.  

Còn nếu mục tiêu chỉ là **tối ưu hiệu năng / reuse code** thì giải pháp wrapper ở mục 2 là thực tế và ít risk hơn.

***

## 4. Các bước cụ thể mình khuyên cho repo hiện tại

1. **Xác định rõ interface plugin**  
   Mở `src/plugins` xem loader đang `import` plugin thế nào và plugin phải `export default` cái gì (function, object, class?).  
2. **Tách core logic trong plugin Sui Wallet**  
   - Những chỗ chỉ xử lý string/bytes, tính toán, encode/decode… → chuyển sang 1 file `core.ts` (pure function, không DOM, không window).  
3. **Port `core.ts` sang AssemblyScript hoặc Rust WASM** như ví dụ trên.  
4. **Thêm `vite-plugin-wasm`** và build WASM vào `public/wasm/`.  
5. **Thay implementation trong `index.ts`**:  
   - giữ API y hệt cho loader;  
   - bên trong, thay việc gọi `core.ts` bằng gọi hàm WASM đã import.  
6. **Test**:  
   - Dev: `npm run dev`, kiểm tra network tab có tải `.wasm` thành công, không lỗi MIME type; [stackoverflow](https://stackoverflow.com/questions/76477419/loading-wasm-with-react-ts-and-vitejs)
   - Prod: `npm run build && npm run preview`, đảm bảo server trả `Content-Type: application/wasm` cho file `.wasm`. [v4.vite](https://v4.vite.dev/guide/features)

***

## 5. Trade-off

- ✅ Ưu điểm:
  - Re-use code nếu sau này bạn muốn dùng cùng logic trên backend (WASM trong Node).  
  - Tối ưu CPU heavy tasks (hashing, encoding phức tạp, zk proof…).  
- ⚠️ Nhược điểm:
  - Toolchain phức tạp hơn (Rust/AssemblyScript + bindings). [zenn](https://zenn.dev/yoshi333/articles/c289c1b923daad)
  - Debug khó hơn JS thuần.  
  - Vẫn phải viết JS wrapper cho DOM + Sui Wallet.  

***

Nếu bạn gửi thêm đoạn code trong `plugins/sui-wallet/index.ts` và `src/plugins` (loader), mình có thể viết luôn phiên bản wrapper WASM cụ thể cho repo của bạn (gần như copy‑paste là chạy được).