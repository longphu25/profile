Làm được, và về mặt kỹ thuật thì đó chính là những gì các wallet hiện nay đang làm: tạo keypair Ed25519/Secp, derive địa chỉ Sui từ public key, rồi lưu seed/private key ở client. Bạn có thể bọc phần crypto nặng trong WASM (Rust) và gọi từ JS/TS trên browser.

***

## 1. Sui cần gì để “tạo ví”?

Một “ví Sui” tối thiểu gồm:

- Một **keypair** theo 1 trong các scheme: `Ed25519`, `Secp256k1`, `Secp256r1` (đa số dùng Ed25519).  
- (Nếu dùng HD wallet) một **mnemonic BIP‑39**, derive về seed rồi keypair qua SLIP‑0010/BIP‑32/BIP‑44 với path chuẩn của Sui, ví dụ cho Ed25519:  
  `m/44'/784'/{account}'/{change}'/{address}'`. [docs.sui](https://docs.sui.io/guides/developer/transactions/transaction-auth/auth-overview)
- Địa chỉ Sui được tạo bằng cách **BLAKE2b‑256( scheme_flag || public_key_bytes )** [docs.sui](https://docs.sui.io/guides/developer/transactions/transaction-auth/auth-overview).  

TypeScript SDK của Mysten (`@mysten/sui.js`) đã bao sẵn logic này, ví dụ tạo keypair từ mnemonic với `Ed25519Keypair.deriveKeypair(mnemonic, DEFAULT_ED25519_DERIVATION_PATH)`. [sdk.mystenlabs](https://sdk.mystenlabs.com/typescript/cryptography/keypairs)

WASM chỉ là **cách triển khai** crypto (Ed25519, BLAKE2b, BIP‑32/39/44) trong Rust/AssemblyScript rồi compile sang `.wasm`.

***

## 2. Kiến trúc: JS gọi WASM để tạo ví

Luồng hợp lý trên client:

1. **WASM module (Rust)**:
   - Dùng thư viện crypto (ví dụ `ed25519-dalek`, `fastcrypto`, BLAKE2b…).  
   - Sinh random seed/mnemonic BIP‑39 (hoặc nhận mnemonic từ JS).  
   - Derive keypair theo chuẩn của Sui.  
   - Tạo địa chỉ Sui từ public key theo spec (flag + BLAKE2b).  
   - Trả về JSON `{ mnemonic, privateKey, publicKey, address }` qua `wasm-bindgen`. [mojoauth](https://mojoauth.com/keypair-generation/generate-keypair-using-ed25519-with-wasm)

2. **JS/TS (React/Vite)**:
   - Import wasm `init()` và các hàm export.  
   - Gọi `create_sui_wallet()` khi user “Create wallet”.  
   - Hiển thị address, và lưu seed/private key vào IndexedDB/localStorage/extension storage (hoặc bắt user ghi mnemonic).  

Như vậy **phần nhạy cảm (crypto)** nằm trong WASM, JS chỉ lo UI + storage.  

***

## 3. Ví dụ skeleton Rust + WASM (giản lược)

Ví dụ mô phỏng ý tưởng (không phải code hoàn chỉnh prod, nhưng đủ để bạn triển khai):

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;
use serde::Serialize;
// Ví dụ: dùng ed25519-dalek + blake2b; trong thực tế bạn có thể dùng fastcrypto có hỗ trợ wasm[web:78].
use ed25519_dalek::Keypair;
use rand::rngs::OsRng;
use blake2::{Blake2b256, Digest};

#[derive(Serialize)]
pub struct SuiWallet {
    pub address: String,
    pub public_key: String,
    pub private_key: String, // lưu ý: nên để ở dạng base64/hex và bảo mật cực kỳ cẩn thận
    // pub mnemonic: Option<String>, // nếu bạn implement BIP-39
}

#[wasm_bindgen]
pub fn create_sui_wallet() -> JsValue {
    // 1. Tạo keypair Ed25519
    let mut csprng = OsRng;
    let keypair: Keypair = Keypair::generate(&mut csprng);

    let pub_bytes = keypair.public.to_bytes();
    let priv_bytes = keypair.secret.to_bytes();

    // 2. Tính địa chỉ Sui: BLAKE2b( flag || pubkey )
    // Ed25519 flag = 0x00[web:70]
    let mut hasher = Blake2b256::new();
    hasher.update([0x00u8]); // scheme flag Ed25519
    hasher.update(pub_bytes);
    let hash = hasher.finalize();
    let address = hex::encode(hash); // 32 bytes → 64 hex chars

    let wallet = SuiWallet {
        address: format!("0x{}", address),
        public_key: hex::encode(pub_bytes),
        private_key: hex::encode(priv_bytes),
    };

    JsValue::from_serde(&wallet).unwrap()
}
```

Compile sang WASM:

```bash
# Cargo.toml: thêm wasm-bindgen, ed25519-dalek, blake2, serde, serde_json...
wasm-pack build --target web   # hoặc --target bundler tùy cách bạn dùng với Vite[web:72][web:75]
```

Trong Vite + React:

```ts
// src/wasm/index.ts
import init, { create_sui_wallet } from 'your-wasm-pkg'; // đường dẫn từ wasm-pack

export async function createSuiWalletClient() {
  await init();                  // init wasm
  const res = create_sui_wallet();
  return res as {
    address: string;
    public_key: string;
    private_key: string;
  };
}
```

Rồi trong React component:

```ts
const handleCreateWallet = async () => {
  const wallet = await createSuiWalletClient();
  console.log('Sui address:', wallet.address);
  // TODO: hiện lên UI, cho user lưu mnemonic/private key, lưu local storage…
};
```

***

## 4. So sánh với dùng TS SDK thuần

Cách **đơn giản và an toàn hơn trong đa số dApp** là: dùng luôn TS SDK:

```ts
import { Ed25519Keypair, DEFAULT_ED25519_DERIVATION_PATH } from '@mysten/sui.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const mnemonic = bip39.generateMnemonic(wordlist);
const keypair = Ed25519Keypair.deriveKeypair(mnemonic, DEFAULT_ED25519_DERIVATION_PATH);
const address = keypair.getPublicKey().toSuiAddress();  // theo đúng spec Sui[web:62][web:73].
```

Mysten đã implement đúng spec BIP‑39/BIP‑32/SLIP‑0010 và address format cho bạn, không cần tự re‑implement bằng WASM trừ khi: [blog.sui](https://blog.sui.io/wallet-cryptography-specifications/)

- Bạn muốn **tối ưu hiệu năng crypto**,  
- Hoặc dùng chung core crypto cho backend/khác ngôn ngữ,  
- Hoặc mục tiêu học/ nghiên cứu.

***

## 5. Lưu ý bảo mật khi tạo ví bằng WASM trên client

- **Randomness**: đảm bảo sử dụng CSPRNG phù hợp cho WASM (Rust + `getrandom` tích hợp WebCrypto khi target web) – không tự chế RNG.  
- **Lưu trữ private key/mnemonic**:  
  - Tuyệt đối không gửi về server.  
  - Lưu tối thiểu trong `IndexedDB`/extension storage có encrypt, hoặc tốt nhất để user tự ghi mnemonic.  
- **XSS**: nếu app dính XSS, attacker lấy private key ngay, dù bạn dùng WASM hay JS.  
- **Audit**: dùng thư viện crypto uy tín (`fastcrypto`, `ed25519-dalek`…) và hạn chế tự viết primitive. Papers như CT‑Wasm cho thấy cần chú ý cả timing‑side‑channel khi viết crypto trong Wasm. [arxiv](https://arxiv.org/abs/1808.01348)

***

### Kết luận

- **Có thể** viết hàm tạo ví Sui bằng WASM trên client, bằng cách implement Ed25519 + BLAKE2b + (tuỳ chọn) BIP‑39/44 trong Rust rồi export qua `wasm-bindgen`.  
- Về thực tế dApp: nếu không có lý do đặc biệt, bạn nên ưu tiên dùng `@mysten/sui.js`/`@mysten/cryptography` trên client (nhiều khả năng bản thân chúng cũng đã dùng core Rust/WASM bên dưới) và chỉ đưa WASM vào khi thật sự cần thêm về hiệu năng hoặc reuse code.