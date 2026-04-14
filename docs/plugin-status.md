# Plugin Status & Next Steps

## Completed Plugins (21)

| # | Plugin | Group | WASM | Description |
|---|--------|-------|------|-------------|
| 1 | `hello-plugin` | Core | ESM | Hello world demo |
| 2 | `hello-world-sui` | Core | ESM | Testnet faucet |
| 3 | `sui-wallet` | Core | ESM | Basic wallet connect |
| 4 | `sui-wallet-profile` | Core | ESM | Required wallet connector + SuiNS + tokens |
| 5 | `sui-create-wallet` | Core | 🟣 WASM | Secp256k1 keypair generator (@noble/curves) |
| 6 | `sui-link` | Core | ESM | Cross-chain wallet links (SuiLink NFTs) |
| 7 | `sui-dual-wallet` | Core | ESM | 2 wallets side by side |
| 8 | `sui-pool-explorer` | DeepBook | ESM | Browse all DeepBook v3 pools |
| 9 | `sui-deepbook-orderbook` | DeepBook | ESM | Live Level 2 orderbook + depth chart |
| 10 | `sui-price-feed` | DeepBook | ESM | Live prices + OHLCV sparkline |
| 11 | `sui-swap` | DeepBook | ESM | Generic token swap via DeepBook |
| 12 | `sui-deepbook-portfolio` | DeepBook | ESM | Margin positions + collateral + points |
| 13 | `sui-deepbook-history` | DeepBook | ESM | Trade history per pool |
| 14 | `sui-margin-manager` | DeepBook | ESM | Margin position inspector |
| 15 | `sui-hedging-monitor` | DeepBook | ESM | Bot status dashboard (SSE) |
| 16 | `sui-walrus-upload` | Walrus | 🟣 WASM | Upload files (publisher + direct mode) |
| 17 | `sui-walrus-viewer` | Walrus | ESM | View/download blobs + owned blobs |
| 18 | `sui-walrus-earn` | Walrus | ESM | Stake WAL with storage nodes |
| 19 | `sui-wal-swap` | Walrus | ESM | Swap WAL/SUI and WAL/USDC |
| 20 | `sui-lending` | DeFi | ESM | Scallop lending pools |
| 21 | `sui-payment` | Payment | ESM | Payment Kit — create & pay requests |

## Next Plugins to Build (Priority Order)

### 🟣 WASM Plugins (highest value)

#### 1. `sui-seal-vault` — Encrypted File Vault
**SDK:** `@mysten/seal` (already installed)
**WASM:** AES-GCM encryption + threshold decryption
**Features:**
- Encrypt file → upload encrypted to Walrus
- Set access policy (NFT holders, token balance, allowlist)
- Decrypt if authorized via Seal session key
- End-to-end encrypted storage

**Why WASM:** Real crypto operations — AES-GCM, key derivation, threshold decryption run in WASM-grade modules.

#### 2. `sui-walrus-viewer` v2 — Full Blob Manager
**SDK:** `@mysten/walrus` + `@mysten/walrus-wasm`
**WASM:** RedStuff decoding for quilt reads
**Features:**
- Extend blob lifetime (Move call)
- Delete deletable blobs
- Read quilt files (extract from container)
- Blob attributes (set/get/remove)
- Consistency check
- See `docs/walrus/viewer-roadmap.md`

#### 3. `sui-seal-gated-content` — Token-Gated Content
**SDK:** `@mysten/seal`
**WASM:** Seal encryption + access control
**Features:**
- Creator uploads encrypted content with access policy
- Viewer connects wallet → check eligibility → decrypt
- Policies: NFT ownership, token threshold, allowlist

### 🟡 WASM-Grade Plugins

#### 4. `sui-zksend` — Claimable Links
**SDK:** `@mysten/zksend` (already installed)
**WASM-grade:** ZK proof generation
**Features:**
- Select assets (SUI/tokens/NFTs) → create shareable link
- Recipient claims without knowing sender
- Airdrop, gifting, tipping

#### 5. `sui-zksend-claim` — Claim Page
**SDK:** `@mysten/zksend`
**Features:**
- Paste link → preview contents
- Claim into connected wallet

#### 6. `sui-multisig` — Multi-Signature Transactions
**WASM-grade:** Signature aggregation
**Features:**
- Define signers + threshold
- Build tx → collect signatures → combine → execute

### 🔵 ESM Plugins (high user value)

#### 7. `sui-nft-gallery` — NFT Gallery
**SDK:** `@mysten/sui` (listOwnedObjects)
**Features:**
- Grid view with image previews
- Metadata display (name, description, attributes)
- Transfer NFT to another address
- Filter by collection

#### 8. `sui-staking` — SUI Validator Staking
**SDK:** `@mysten/sui` (system staking calls)
**Features:**
- Validator list with APY, commission
- Stake/unstake UI
- Rewards tracking

#### 9. `sui-object-explorer` — Object Inspector
**SDK:** `@mysten/sui`
**Features:**
- Inspect any Sui object by ID
- Object fields, type, owner, history
- Dynamic fields

#### 10. `sui-payment-registry` — Payment Dashboard
**SDK:** `@mysten/payment-kit`
**Features:**
- View payment history
- Withdraw collected funds
- Registry management

## Available SDKs (installed)

| Package | Used By | Status |
|---------|---------|--------|
| `@mysten/sui` | All plugins | ✅ Active |
| `@mysten/dapp-kit-react` | wallet-profile | ✅ Active |
| `@mysten/deepbook-v3` | swap, wal-swap | ✅ Active |
| `@mysten/walrus` | upload, viewer | ✅ Active |
| `@mysten/walrus-wasm` | upload (direct) | ✅ Active |
| `@mysten/seal` | — | 🔲 Not yet used |
| `@mysten/payment-kit` | payment | ✅ Active |
| `@mysten/zksend` | — | 🔲 Not yet used |
| `@mysten/bcs` | — | Available |

## Architecture Notes for Next Session

- All plugins in `plugins/<name>/` with `plugin.tsx` + `style.css`
- Multi-file plugins: `config.ts`, component files (see `sui-walrus-upload/`)
- Plugin interface: `src/plugins/types.ts` → `Plugin { name, version, init, mount, unmount }`
- Shared context: `SuiHostAPI` from `src/sui-dashboard/sui-types.ts`
- Wallet data: `sharedData.walletProfile` (address, network, balances)
- Transaction signing: `sharedHost.signAndExecuteTransaction(tx)`
- Signer registration: `sharedHost.registerSigner(fn)` (from wallet-profile)
- WASM dashboard: `src/sui-wasm/SuiWasmDashboard.tsx` with collapsible groups
- `noShadow: true` for plugins needing full DOM (wallet popups)
- See `docs/walrus/dev-notes.md` for Walrus-specific gotchas
- See `docs/walrus/bug-log.md` for known issues and fixes
