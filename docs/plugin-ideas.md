# Plugin Ideas & Status

All plugins — completed and planned — for the Sui plugin dashboard.

---

## Completed Plugins (21)

| # | Plugin | Group | WASM | Commit | Description |
|---|--------|-------|------|--------|-------------|
| 1 | `hello-plugin` | Core | ESM | `6bd0309` | Hello world demo |
| 2 | `hello-world-sui` | Core | ESM | `6bd0309` | Testnet faucet |
| 3 | `sui-wallet` | Core | ESM | `6bd0309` | Basic wallet connect + balances + tx history |
| 4 | `sui-wallet-profile` | Core | ESM | `95de062` | Required wallet connector + SuiNS + tokens + signer |
| 5 | `sui-create-wallet` | Core | 🟣 WASM | `136ee32` | Secp256k1 keypair generator (@noble/curves) |
| 6 | `sui-link` | Core | ESM | `2818a8d` | Cross-chain wallet links (SuiLink NFTs) |
| 7 | `sui-dual-wallet` | Core | ESM | `6c91a6e` | 2 wallets side by side with shared data |
| 8 | `sui-pool-explorer` | DeepBook | ESM | `6133100` | Browse all DeepBook v3 pools |
| 9 | `sui-deepbook-orderbook` | DeepBook | ESM | `ff6c840` | Live Level 2 orderbook + depth chart |
| 10 | `sui-price-feed` | DeepBook | ESM | `2c90905` | Live prices + OHLCV sparkline |
| 11 | `sui-swap` | DeepBook | ESM | `7483cf1` | Generic token swap via DeepBook SDK |
| 12 | `sui-deepbook-portfolio` | DeepBook | ESM | `4aee8f2` | Margin positions + collateral + points |
| 13 | `sui-deepbook-history` | DeepBook | ESM | `03e357b` | Trade history per pool |
| 14 | `sui-margin-manager` | DeepBook | ESM | `a1b97f9` | Margin position inspector + open orders |
| 15 | `sui-hedging-monitor` | DeepBook | ESM | `2ecc9a9` | Bot status dashboard (REST/SSE) |
| 16 | `sui-walrus-upload` | Walrus | 🟣 WASM | `fff80f9` | Upload files (publisher + direct/WASM mode) |
| 17 | `sui-walrus-viewer` | Walrus | ESM | `fff80f9` | View/download blobs + owned blobs list |
| 18 | `sui-walrus-earn` | Walrus | ESM | `929ef4a` | Stake WAL with storage nodes |
| 19 | `sui-wal-swap` | Walrus | ESM | `1b18e63` | Swap WAL/SUI and WAL/USDC via DeepBook |
| 20 | `sui-lending` | DeFi | ESM | `08b5d63` | Scallop lending pools viewer |
| 21 | `sui-payment` | Payment | ESM | `b30a953` | Payment Kit — create & pay requests |

---

## Planned Plugins (11)

### 🟣 WASM Plugins (real crypto/encoding)

#### 1. `sui-seal-vault` — Encrypted File Vault
**SDK:** `@mysten/seal` (installed) · **WASM:** AES-GCM + threshold decryption
- Encrypt file → upload encrypted to Walrus
- Set access policy (NFT holders, token balance, allowlist)
- Decrypt if authorized via Seal session key

#### 2. `sui-walrus-viewer` v2 — Full Blob Manager
**SDK:** `@mysten/walrus` + `walrus-wasm` (installed) · **WASM:** RedStuff decoding
- Extend blob lifetime, delete blobs, burn blobs
- Read quilt files, blob attributes, consistency check
- See `docs/walrus/viewer-roadmap.md`

#### 3. `sui-seal-gated-content` — Token-Gated Content
**SDK:** `@mysten/seal` (installed) · **WASM:** Seal encryption
- Creator uploads encrypted content with access policy
- Viewer: connect wallet → check eligibility → decrypt

#### 4. `sui-seal-chat` — Encrypted Messaging
**SDK:** `@mysten/seal` (installed) · **WASM:** AES-GCM + key derivation
- Encrypted messages between Sui addresses
- Store on Walrus, decrypt via Seal session key

#### 5. `sui-walrus-site` — Deploy Static Sites
**SDK:** `@mysten/walrus` + `walrus-wasm` (installed) · **WASM:** RedStuff encoding
- Upload HTML/CSS/JS bundle → get `.wal.app` URL

### 🟡 WASM-Grade Plugins

#### 6. `sui-zksend` — Claimable Links
**SDK:** `@mysten/zksend` (installed) · **WASM-grade:** ZK proof generation
- Select assets → create shareable link
- Airdrop, gifting, tipping

#### 7. `sui-multisig` — Multi-Signature Transactions
**WASM-grade:** Signature aggregation
- Define signers + threshold → collect signatures → execute

### 🔵 ESM Plugins (high user value)

#### 8. `sui-nft-gallery` — NFT Gallery
**SDK:** `@mysten/sui` · Grid view, metadata, transfer, filter by collection

#### 9. `sui-staking` — SUI Validator Staking
**SDK:** `@mysten/sui` · Validator list, stake/unstake, rewards tracking

#### 10. `sui-object-explorer` — Object Inspector
**SDK:** `@mysten/sui` · Inspect any object: fields, type, owner, dynamic fields

#### 11. `sui-zksend-claim` — Claim Page
**SDK:** `@mysten/zksend` · Paste link → preview → claim into wallet

---

## Priority Matrix

| Priority | Plugin | WASM | Effort | Status |
|----------|--------|------|--------|--------|
| 🥇 | `sui-seal-vault` | 🟣 | High | ❌ Next |
| 🥇 | `sui-nft-gallery` | 🔵 | Low | ❌ Next |
| 🥈 | `sui-zksend` | 🟡 | Medium | ❌ |
| 🥈 | `sui-walrus-viewer` v2 | 🟣 | Medium | ❌ |
| 🥈 | `sui-staking` | 🔵 | Medium | ❌ |
| 🥉 | `sui-seal-gated-content` | 🟣 | High | ❌ |
| 🥉 | `sui-zksend-claim` | 🔵 | Low | ❌ |
| 🥉 | `sui-object-explorer` | 🔵 | Low | ❌ |
| 4 | `sui-seal-chat` | 🟣 | High | ❌ |
| 4 | `sui-walrus-site` | 🟣 | High | ❌ |
| 4 | `sui-multisig` | 🟡 | High | ❌ |

---

## Available SDKs (installed)

| Package | Used By | Status |
|---------|---------|--------|
| `@mysten/sui` | All plugins | ✅ Active |
| `@mysten/dapp-kit-react` | wallet-profile | ✅ Active |
| `@mysten/deepbook-v3` | swap, wal-swap | ✅ Active |
| `@mysten/walrus` | upload, viewer | ✅ Active |
| `@mysten/walrus-wasm` | upload (direct) | ✅ Active |
| `@mysten/seal` | — | 🔲 Ready to use |
| `@mysten/payment-kit` | payment | ✅ Active |
| `@mysten/zksend` | — | 🔲 Ready to use |

---

## Architecture Notes

- Plugins live in `plugins/<name>/` with `plugin.tsx` + `style.css`
- Multi-file: `config.ts`, components (see `sui-walrus-upload/`, `sui-wallet-profile/`)
- Plugin interface: `src/plugins/types.ts` → `Plugin { name, version, init, mount, unmount }`
- Host API: `src/sui-dashboard/sui-types.ts` → `SuiHostAPI`
- Wallet data: `sharedData.walletProfile` → `{ address, network, suinsName, balances }`
- Signing: `sharedHost.signAndExecuteTransaction(tx)` (registered by wallet-profile)
- WASM dashboard: `src/sui-wasm/SuiWasmDashboard.tsx` with collapsible groups
- `noShadow: true` for plugins needing full DOM (wallet popups)
- Walrus gotchas: `docs/walrus/dev-notes.md`
- Walrus bugs: `docs/walrus/bug-log.md`

---

## DeepBook Bot Plugins (from depbuk-hedging)

Derived from `depbuk-hedging/src/lib/server/bot/` modules.
These plugins bring bot-level trading operations to the browser dashboard.

### Bot Operation Plugins

#### `sui-deepbook-trade` — Place Orders UI
**Source:** `deepbook-execution.ts`
**Features:**
- Place limit orders (POST_ONLY maker)
- Place market orders
- Margin limit orders with borrow factor
- Order type selector: limit / market / POST_ONLY
- Price input with tick size validation
- Quantity input with lot size validation
- Account A (Long) / Account B (Short) selector

#### `sui-deepbook-cleanup` — Order & Position Cleanup
**Source:** `deepbook-cleanup.ts`
**Features:**
- Cancel all open orders for a pool
- Withdraw settled balances
- Repay margin debt + withdraw collateral
- Cancel conditional orders (TP/SL)
- Compact cleanup (cancel + withdraw + repay in one tx)
- One-click "Clean All" button

#### `sui-deepbook-auto-balance` — Wallet Rebalancing
**Source:** `runtime-auto-balance`, `deepbook-execution.ts`
**Features:**
- Preview balance requirements for N cycles
- Auto-swap SUI↔USDC via 7K aggregator
- Transfer tokens between Account A and Account B
- Top-up gas reserves
- Configurable buffer BPS

#### `sui-deepbook-margin` — Margin Manager Operations
**Source:** `deepbook-margin-state.ts`
**Features:**
- Create margin manager for a pool
- Deposit/withdraw collateral (base + quote)
- Borrow with configurable factor
- View margin state: assets, debts, risk ratio
- Liquidation risk indicator
- Repay debt

#### `sui-deepbook-bot` — Hedging Bot Dashboard (Enhanced)
**Source:** `runtime.ts`, `runtime-cycle-executor.ts`
**Features:**
- Full bot control: start, stop, stop-and-clean
- Settings editor (all bot config fields)
- Live cycle execution: open → hold → close
- Preflight checks: balance, price, manager state
- Auto-topup status
- Cycle history with PnL per cycle
- Runtime logs with level filtering
- SSE live stream

#### `sui-deepbook-strategy` — Strategy Builder
**Source:** `runtime-cycle-executor.ts`, `runtime-shared.ts`
**Features:**
- Configure hedging parameters:
  - Notional size, hold time range, max cycles
  - Slippage tolerance, maker reprice seconds
  - Random size BPS, order delay range
  - Borrow factors (A quote, B base)
- Strategy presets: conservative, aggressive, scalping
- Backtest estimate from historical data
- PnL simulator

### Bot Utility Plugins

#### `sui-deepbook-aggregator` — Multi-DEX Swap
**Source:** `deepbook-execution.ts` (swapExactInWithAggregator)
**SDK:** `@7kprotocol/sdk-ts` (need to install)
**Features:**
- Quote from multiple DEXes (Cetus, FlowX, DeepBook, Bluefin)
- Best route selection
- Slippage protection
- Swap execution with wallet signing

#### `sui-deepbook-points` — Points Tracker
**Source:** DeepBook Indexer `/get_points`
**Features:**
- Track DeepBook points earned
- Points per address
- Points projection based on volume
- Leaderboard view

### Priority for Bot Plugins

| Priority | Plugin | Effort | Value |
|----------|--------|--------|-------|
| 🥇 | `sui-deepbook-trade` | Medium | High — core trading |
| 🥇 | `sui-deepbook-cleanup` | Low | High — essential maintenance |
| 🥈 | `sui-deepbook-margin` | Medium | High — margin operations |
| 🥈 | `sui-deepbook-points` | Low | High — airdrop tracking |
| 🥉 | `sui-deepbook-auto-balance` | Medium | Medium — automation |
| 🥉 | `sui-deepbook-bot` | High | Medium — full bot (enhanced hedging-monitor) |
| 4 | `sui-deepbook-strategy` | High | Niche — advanced users |
| 4 | `sui-deepbook-aggregator` | Medium | Medium — needs @7kprotocol SDK |
