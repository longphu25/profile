# Plugin Ideas — Sui SDK Ecosystem

Plugin ideas based on `@mysten/*` SDKs available in the project.

## Available SDKs

| Package | Purpose |
|---------|---------|
| `@mysten/seal` | Access control + encryption (AES-GCM, threshold decryption) |
| `@mysten/payment-kit` | Payment links, registry, ephemeral payments |
| `@mysten/zksend` | Claimable links for coins/NFTs (ZK proofs) |
| `@mysten/walrus` + `walrus-wasm` | Decentralized blob storage (RedStuff encoding) |
| `@mysten/sui` | Core SDK — objects, balances, transactions |
| `@mysten/deepbook-v3` | DEX orderbook, swaps, margin |
| `@mysten/dapp-kit-react` | Wallet connection, signing |

---

## 🟣 WASM Plugins (real crypto/encoding)

### 1. `sui-walrus-upload` — File Upload to Walrus

Upload files to Walrus decentralized storage.

- File picker → epoch selector → cost estimate
- Upload progress bar (encode → register → upload → certify)
- Returns blob ID + Walrus URL
- Uses `@mysten/walrus-wasm` for RedStuff encoding (native WASM)

**WASM:** RedStuff encoding via `@mysten/walrus-wasm`

### 2. `sui-walrus-viewer` — Blob Viewer

View/download files from Walrus by blob ID.

- Paste blob ID → fetch + decode → preview
- Supports: images, text, JSON, PDF
- Quilt support: list files inside a quilt

**WASM:** RedStuff decoding via `@mysten/walrus-wasm`

### 3. `sui-seal-vault` — Encrypted File Vault

Encrypt/decrypt files on-chain with Seal.

- Encrypt file → upload to Walrus → store encrypted object on Sui
- Only authorized addresses can decrypt
- Session key management
- Use cases: private NFT content, confidential documents

**WASM:** AES-GCM encryption + threshold decryption

### 4. `sui-seal-chat` — Encrypted Messaging

Encrypted messages between Sui addresses.

- Encrypt message → store on Walrus → recipient decrypts via Seal session key
- Chat-like UI with message history
- End-to-end encrypted

**WASM:** AES-GCM + Seal key derivation

### 5. `sui-seal-gated-content` — Token-Gated Content

Create content only accessible to NFT/token holders.

- Creator: upload encrypted content with access policy
- Viewer: connect wallet → check eligibility → decrypt if authorized
- Policies: NFT ownership, token balance threshold, allowlist

**WASM:** Seal encryption + access control verification

### 6. `sui-walrus-site` — Deploy Static Sites

Deploy static websites to Walrus Sites.

- Upload HTML/CSS/JS bundle
- Get `.wal.app` URL
- Version management

**WASM:** RedStuff encoding for site assets

---

## 🟡 WASM-Grade Plugins (crypto in JS, same perf as WASM)

### 7. `sui-zksend` — Create Claimable Links

Send SUI/tokens/NFTs via shareable links.

- Select assets → create link → share URL
- Recipient claims without needing sender's address
- Airdrop, gifting, tipping use cases

**WASM-grade:** ZK proof generation for claimable links

### 8. `sui-multisig` — Multi-Signature Transactions

Create and sign multisig transactions.

- Define signers + threshold
- Build transaction → collect signatures → combine → execute
- Dashboard for pending multisig proposals

**WASM-grade:** Signature aggregation

---

## 🔵 ESM Plugins (high value, no WASM needed)

### 9. `sui-payment` — Payment Requests

Create payment requests with QR codes.

- Merchant creates payment request (amount, token, memo)
- Generates QR code / payment link
- Buyer scans → auto-fills transaction
- Supports SUI, USDC, WAL

**SDK:** `@mysten/payment-kit`

### 10. `sui-payment-registry` — Payment Dashboard

Manage payment records and funds.

- View payment history
- Withdraw collected funds
- Set epoch expiration
- Registry management

**SDK:** `@mysten/payment-kit`

### 11. `sui-zksend-claim` — Claim Page

Claim assets from zkSend links.

- Paste link → preview contents (coins, NFTs)
- Claim into connected wallet
- Transaction confirmation

**SDK:** `@mysten/zksend`

### 12. `sui-nft-gallery` — NFT Gallery

Display all NFTs/objects owned by connected wallet.

- Grid view with image previews
- Metadata display (name, description, attributes)
- Transfer NFT to another address
- Filter by collection

**SDK:** `@mysten/sui` (listOwnedObjects)

### 13. `sui-object-explorer` — Object Inspector

Inspect any Sui object by ID.

- Object fields, type, owner
- Transaction history
- Dynamic fields
- Mini Suiscan experience

**SDK:** `@mysten/sui` (getObject, listDynamicFields)

### 14. `sui-staking` — SUI Validator Staking

Stake SUI with validators for rewards.

- Validator list with APY, commission
- Stake/unstake UI
- Rewards tracking
- Active stakes overview

**SDK:** `@mysten/sui` (system staking calls)

---

## Priority Matrix

| Priority | Plugin | WASM | Effort | User Value |
|----------|--------|------|--------|------------|
| 🥇 | `sui-walrus-upload` | 🟣 Native WASM | Medium | High — practical utility |
| 🥇 | `sui-nft-gallery` | 🔵 ESM | Low | High — visual, universal |
| 🥇 | `sui-seal-vault` | 🟣 Native WASM | High | High — unique feature |
| 🥈 | `sui-payment` | 🔵 ESM | Medium | High — merchant use case |
| 🥈 | `sui-zksend` | 🟡 WASM-grade | Medium | High — viral sharing |
| 🥈 | `sui-walrus-viewer` | 🟣 Native WASM | Low | Medium — complements upload |
| 🥈 | `sui-staking` | 🔵 ESM | Medium | High — passive income |
| 🥉 | `sui-seal-gated-content` | 🟣 Native WASM | High | Medium — creator economy |
| 🥉 | `sui-zksend-claim` | 🔵 ESM | Low | Medium — complements zksend |
| 🥉 | `sui-object-explorer` | 🔵 ESM | Low | Medium — developer tool |
| 4 | `sui-payment-registry` | 🔵 ESM | Medium | Niche — merchants only |
| 4 | `sui-seal-chat` | 🟣 Native WASM | High | Niche — messaging |
| 4 | `sui-walrus-site` | 🟣 Native WASM | High | Niche — developers |
| 4 | `sui-multisig` | 🟡 WASM-grade | High | Niche — advanced users |
