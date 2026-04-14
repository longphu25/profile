# DeepBook Hedging Bot — Technical Documentation

Plugin `sui-deepbook-hedging-bot` v1.0.0 · Added in v0.21.0

Client-side hedging bot chạy hoàn toàn trên browser, không cần server.
Import 2 private keys → bot tự động cân bằng → mở/đóng positions → theo dõi realtime.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser Tab (client-side)                            │
│                                                       │
│  ┌──────────┐  ┌──────────┐                          │
│  │ Account A │  │ Account B │  ← import keys          │
│  │  (Long)   │  │  (Short)  │                         │
│  └─────┬─────┘  └─────┬─────┘                         │
│        │               │                              │
│  ┌─────▼───────────────▼─────┐                        │
│  │     Auto-Balance           │                        │
│  │  1. Check SUI balances     │                        │
│  │  2. Transfer to equalize   │                        │
│  │  3. Swap SUI → base token  │                        │
│  └─────────────┬─────────────┘                        │
│                │                                      │
│  ┌─────────────▼─────────────┐                        │
│  │     Bot Runtime Loop       │  ← setInterval        │
│  │  1. Fetch price            │                        │
│  │  2. Place open legs (A+B)  │                        │
│  │  3. Hold position          │                        │
│  │  4. Place close legs       │                        │
│  │  5. Calculate PnL          │                        │
│  │  6. Repeat                 │                        │
│  └───────────────────────────┘                        │
│                                                       │
│  ┌───────────────────────────┐                        │
│  │     2-Column Dashboard     │                        │
│  │  LEFT:  Mini Orderbook     │                        │
│  │         Funding Check      │                        │
│  │         Points Estimator   │                        │
│  │  RIGHT: Setup / Dashboard  │                        │
│  │         History / Logs     │                        │
│  └───────────────────────────┘                        │
└──────────────────────────────────────────────────────┘
```

---

## Features

### Key Management

| Method | Description | Security |
|--------|-------------|----------|
| Generate 2 Wallets | `Ed25519Keypair.generate()` — tạo 2 ví mới | Keys in memory only |
| Import sui.keystore | Parse JSON array of base64 keys (flag + 32 bytes) | File read locally via FileReader |
| Import .vault | AES-256-GCM encrypted file, password-protected | PBKDF2 600K iterations |
| Paste key | `suiprivkey1...` (bech32) hoặc base64 | Direct input |

**Encrypted Vault (.vault file):**
- Encrypt: PBKDF2(password, salt) → AES-256-GCM(keys)
- Format: `salt(16) + iv(12) + ciphertext`
- Use case: lưu trên iCloud/Google Drive, mở trên iPad
- Web Crypto API native — chạy trên mọi browser

**Keystore picker:**
- Hiện danh sách addresses từ keystore
- Fetch all coin balances via `suix_getAllBalances` JSON-RPC
- Hiện badges: `10.0000 SUI` `325.50 DEEP` `0.5000 WAL`
- Click `→ A` / `→ B` để assign

### Auto-Balance

Tự động chạy khi bấm Start Bot:

1. **Check balances** — `suix_getAllBalances` cho cả 2 ví
2. **Transfer SUI** — nếu lệch > 0.5 SUI, chia đều qua `splitCoins` + `transferObjects`
3. **Swap base token** — Account B cần base token (DEEP, WAL, NS...)
   - Dùng `@mysten/deepbook-v3` SDK: `swapExactQuoteForBase`
   - Swap 90% SUI của B → base token, giữ 0.3 SUI gas
4. **Refresh balances** — cập nhật UI

```
Nạp 20 SUI vào 1 ví → Start Bot
  → Transfer 10 SUI sang ví kia
  → Ví B: swap 9 SUI → DEEP
  → Bot bắt đầu chạy cycles
```

### Bot Cycle Logic

```
OPEN → HOLD → CLOSE → repeat
```

| Phase | Action |
|-------|--------|
| OPEN | Fetch mid price → place A: BUY, B: SELL |
| HOLD | Random duration (holdMin–holdMax) with progress bar |
| CLOSE | Fetch price → close both legs |
| PnL | Calculate from maker rebates minus fees |

**Config:**

| Param | Default | Description |
|-------|---------|-------------|
| pool | DEEP_SUI | Trading pair |
| notionalUsd | 10 | USD value per leg |
| holdMinSec | 60 | Minimum hold time |
| holdMaxSec | 180 | Maximum hold time |
| maxCycles | null (∞) | Stop after N cycles |
| intervalMs | 5000 | Check interval between cycles |

### Mini Orderbook (Left Column)

- 10 asks (red, reversed) + mid price + 10 bids (green)
- Auto-refresh every 5s, synced to selected pool
- Spread % display
- Data: DeepBook Indexer `/orderbook/:pool`

### Funding Check (Left Column)

- Hiện pool tokens cần cho mỗi ví:
  - `A (Long/Buy DEEP): needs SUI`
  - `B (Short/Sell DEEP): needs DEEP`
- Fetch all coin balances per wallet
- ✓/✗ indicator cho đủ/thiếu funds

### Points Estimator (Left Column)

- Tính toán realtime dựa trên config
- Metrics: cycles/hour, cycles/day, volume/day, volume/week
- Points estimate: ~1 pt per $1 maker volume
- DeepBook maker fee = 0 (miễn phí)

### Dashboard Tab

- Status dot: idle/opening/holding/closing/error
- Stats grid: Price, PnL, Volume, Est. Points, Cycles, Pool, Network
- Hold progress bar with countdown
- Account addresses

### History Tab

- Completed cycles table: #, open/close prices, PnL, hold duration

### Logs Tab

- Runtime logs with timestamps
- Color-coded: info (gray), warn (yellow), error (red), success (green)
- Max 200 entries, clearable

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Keypair | `@mysten/sui/keypairs/ed25519` — Ed25519Keypair |
| RPC | `@mysten/sui/grpc` — SuiGrpcClient |
| Transactions | `@mysten/sui/transactions` — Transaction builder |
| Swap | `@mysten/deepbook-v3` — DeepBookClient |
| Encryption | Web Crypto API — PBKDF2 + AES-256-GCM |
| Balance query | JSON-RPC `suix_getAllBalances` |
| Market data | DeepBook Indexer REST API |
| UI | React + custom CSS (BEM) |

---

## DeepBook Indexer API Endpoints Used

| Endpoint | Used For |
|----------|----------|
| `GET /ticker` | Current prices per pool |
| `GET /summary` | 24h stats, volatility ranking |
| `GET /orderbook/:pool` | Level 2 orderbook (bids/asks) |
| `GET /get_pools` | Pool list with metadata |

**Base URLs:**
- Mainnet: `https://deepbook-indexer.mainnet.mystenlabs.com`
- Testnet: `https://deepbook-indexer.testnet.mystenlabs.com`

---

## DeepBook SDK Usage

### Swap (Auto-Balance)

```typescript
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds } from '@mysten/deepbook-v3'

const dbClient = new DeepBookClient({
  client: new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC_URL }),
  address: walletAddress,
  network: 'mainnet',
  coins: mainnetCoins,
  pools: mainnetPools,
  packageIds: mainnetPackageIds,
})

const tx = new Transaction()
dbClient.deepBook.swapExactQuoteForBase({
  poolKey: 'DEEP_SUI',
  amount: 9.0,       // SUI to spend
  deepAmount: 0,
  minOut: 0,          // accept any for auto-balance
})(tx)
```

### Transaction Signing (Keypair)

```typescript
const kp = Ed25519Keypair.fromSecretKey(secretKey)
tx.setSender(kp.getPublicKey().toSuiAddress())
const built = await tx.build({ client })
const sig = await kp.signTransaction(built)
await client.executeTransactionBlock({
  transactionBlock: built,
  signature: [sig.signature],
})
```

---

## Pool Analysis (Live Data)

Pools sorted by 24h volatility (lowest = best for hedging):

| Pool | 24h % | Spread | Volume | Hedging Rating |
|------|-------|--------|--------|----------------|
| USDT_USDC | 0.03% | 0.001% | $323K | ★★★★★ Stablecoin |
| SUIUSDE_USDC | 0.00% | 0.070% | $138K | ★★★★ Stable |
| WAL_USDC | 1.19% | 0.042% | $1M | ★★★★ High vol |
| DEEP_SUI | 1.36% | 0.131% | $118K | ★★★ Good |
| NS_SUI | 1.90% | 0.105% | $6K | ★★ Low vol |
| SUI_USDC | 3.87% | 0.021% | $8.7M | ★★★ Tight spread |

**Fee structure:**
- Maker fee: **0** (free)
- Taker fee: small, paid in DEEP or quote token
- Hedging bot uses POST_ONLY maker orders → 0 fee

---

## Funding Requirements

Mỗi ví cần collateral cho 1 leg:

| Pool | Account A needs | Account B needs |
|------|----------------|----------------|
| DEEP_SUI | SUI (quote) | DEEP (base) |
| SUI_USDC | USDC (quote) | SUI (base) |
| WAL_USDC | USDC (quote) | WAL (base) |
| WAL_SUI | SUI (quote) | WAL (base) |

**Minimum funding:** notional × 2 + gas (0.3 SUI × 2)

Example: $10 notional on DEEP_SUI
- Total needed: ~$20 + gas
- Nạp 20 SUI vào 1 ví → auto-balance handles the rest

---

## Security Model

| Aspect | Implementation |
|--------|---------------|
| Key storage | Memory only, never persisted |
| Key transmission | Never sent to any server |
| Tab close | Keys cleared automatically |
| Encrypted export | AES-256-GCM, PBKDF2 600K iterations |
| Signing | Local Ed25519 via `@mysten/sui` |
| RPC calls | Direct to Sui fullnode (HTTPS) |
| Indexer calls | Read-only REST API (no auth) |

---

## File Structure

```
plugins/sui-deepbook-hedging-bot/
├── plugin.tsx          # Main plugin (1400+ lines)
└── style.css           # Dark OLED theme (Fira Code/Sans)

src/sui-deepbook-hedging-bot/
├── main.tsx            # Standalone page entry
├── HedgingBotPage.tsx  # Page wrapper (loads plugin)
└── hedging-bot.css     # Page-level styles

sui-deepbook-hedging-bot.html  # Dedicated HTML entry
```

**Registrations:**
- `vite.config.ts` — HTML entry + plugin build entry
- `SuiWasmDashboard.tsx` — DeepBook Trading group (ESM badge)

---

## Points Estimation Formula

```
cycleTime = (holdMin + holdMax) / 2 + 30  (overhead)
cyclesPerHour = 3600 / cycleTime
volumePerCycle = notional × 2  (both legs)
volumePerDay = volumePerCycle × cyclesPerHour × 24
pointsPerDay ≈ volumePerDay  (1 pt per $1 maker volume)
```

Example: $10 notional, hold 60-180s
- Cycle time: ~150s
- Cycles/hour: ~24
- Volume/day: ~$4,800
- Points/day: ~4,800

---

## Planned: WASM Orderbook Analysis Engine

### `sui-deepbook-analysis` — WASM-Powered Market Analysis

**Concept:** Rust-compiled WASM module cho orderbook analysis nặng, tích hợp vào hedging bot.

**Why WASM:**
- JS bottleneck khi xử lý >1000 orderbook snapshots
- Monte Carlo simulation cần loop triệu lần
- Backtest trên historical data lớn
- Real-time spread/depth analysis mỗi tick

**Planned Features:**

| Feature | Description | Perf Gain |
|---------|-------------|-----------|
| Orderbook depth analysis | Tính liquidity depth, imbalance ratio, wall detection | 10-20x |
| Spread predictor | Statistical model dự đoán spread tối ưu cho maker orders | 20-50x |
| Monte Carlo PnL simulator | Simulate N cycles với random params → expected PnL distribution | 50-100x |
| Backtest engine | Replay historical trades → test strategy params | 30-50x |
| Optimal hold time calculator | Analyze price volatility → suggest holdMin/holdMax | 10-20x |

**Architecture:**
```
Rust (WASM)                          TypeScript (Plugin)
┌─────────────────────┐              ┌──────────────────────┐
│ orderbook_engine.rs  │  ← wasm →   │ hedging-bot/plugin.tsx│
│                      │              │                      │
│ • analyze_depth()    │              │ • fetchOrderbook()   │
│ • predict_spread()   │              │ • pass to WASM       │
│ • monte_carlo()      │              │ • display results    │
│ • backtest()         │              │                      │
│ • optimal_hold()     │              │                      │
└─────────────────────┘              └──────────────────────┘
```

**Rust crate dependencies:**
- `wasm-bindgen` — JS interop
- `serde` / `serde_json` — data serialization
- `rand` (wasm feature) — Monte Carlo RNG
- `statrs` — statistical distributions

**Integration with hedging bot:**
- Load WASM module on demand (lazy)
- Pass orderbook snapshots as `Float64Array` (zero-copy)
- Results displayed in new "Analysis" tab
- Strategy recommendations fed back to bot config

**Effort:** High
**Value:** High for advanced users, strategy optimization
**Status:** ❌ Planned
