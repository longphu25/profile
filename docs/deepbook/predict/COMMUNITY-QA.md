# DeepBook Predict — Community Q&A & Lessons Learned

Compiled from Discord/Telegram group discussions with Mysten team (June 2025).

---

## Q1: `assert_key_matches` abort code 1 khi mint

### Câu hỏi

> Mint bị abort với `assert_key_matches` (abort code 1) trong `oracle_config`.
> Đang build MarketKey với `market_key::up(oracle_id, strike, expiry)` dùng live oracle
> từ `/oracles` (active, future expiry), truyền `min_strike` và `expiry` chính xác.
> Thấy `ask_bounds: null` — có phải cần bounds được set trước?

### Trả lời (từ team)

**Root cause: argument order sai.**

```
market_key::up(oracle_id, expiry, strike)  ← ĐÚNG: expiry TRƯỚC strike
```

Nếu gọi `up(oracle_id, strike, expiry)` → strike chui vào slot expiry →
`assert_key_matches` check `market_key.expiry() == oracle.expiry()` → **mismatch → abort code 1**.

**`ask_bounds: null` là trạng thái bình thường, KHÔNG liên quan đến lỗi.**
Không cần authorized cap nào để mint. ask_bounds null = không có upper price limit, mint vẫn hoạt động.

### assert_key_matches kiểm tra gì

Dựa trên behavior đã confirm:

```move
// oracle_config module (predict package)
public fun assert_key_matches(oracle: &OracleSVI, key: &MarketKey) {
    // 1. oracle_id phải match
    assert!(key.oracle_id() == object::id(oracle), 1);
    // 2. expiry phải đúng oracle's expiry
    assert!(key.expiry() == oracle.expiry(), 1);
    // 3. strike >= min_strike
    assert!(key.strike() >= oracle.min_strike(), 1);
    // 4. strike aligned to tick_size
    assert!((key.strike() - oracle.min_strike()) % oracle.tick_size() == 0, 1);
}
```

Tất cả fail condition đều abort code 1. Cách debug:
- Swap expiry/strike → check #2 fails (phổ biến nhất)
- Strike < min_strike → check #3 fails
- Strike không aligned → check #4 fails

### Đối chiếu code của chúng ta (ĐÃ ĐÚNG)

```typescript
// tradeActions.ts
const [marketKey] = tx.moveCall({
  target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
  arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strikeRaw)],
  //                                  ^^^^^^ expiry    ^^^^^^^^ strike  ✅
})
```

---

## Q2: Exact-in / spend-cap pattern cho budget control

### Câu hỏi

> Bot cho user nhập budget (50 DUSDC), nhưng `predict::mint(quantity)` là quantity-in.
> Trong volatile moments, final spend có thể vượt budget.
> Có exact-in pattern hay planned API để guarantee "spend <= user budget"?

### Trả lời (từ team)

1. **`mint(quantity)` là duy nhất** — không có `mint_exact_in(max_spend)` hay spend-cap on-chain
2. **`assert_mintable_ask`** chỉ bound **per-unit price band** (ask bounds), không phải total cost
3. **Best practice client-side: fund manager chỉ đúng budget**

```typescript
// Pattern: cap spending atomically
const budget = 50_000_000n // 50 DUSDC exact
const [exactCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(budget)])

// Deposit CHỈ budget amount — không hơn
tx.moveCall({
  target: `${PREDICT_PKG}::predict_manager::deposit`,
  typeArguments: [DUSDC],
  arguments: [tx.object(managerId), exactCoin],
})

// Nếu mint cost > 50 DUSDC → tx abort atomically (insufficient balance)
// Wallet không bị drain, toàn bộ PTB rollback
tx.moveCall({
  target: `${PREDICT_PKG}::predict::mint`,
  typeArguments: [DUSDC],
  arguments: [
    tx.object(PREDICT_ID),
    tx.object(managerId),
    tx.object(oracleId),
    marketKey,
    tx.pure.u64(quantity),
    tx.object.clock(),
  ],
})
```

4. **Size quantity trước**: dùng server endpoint `get_trade_amounts()` để estimate cost
5. **Tương lai**: team đang plan `mint(amount)` function (spend-in) nhưng chưa release

### Key insight

- `coinWithBalance` hoặc `splitCoins` exact amount = budget cap tự nhiên
- Manager balance không đủ → abort atomically → không drain wallet
- Đây là pattern an toàn nhất cho bot/UI khi chưa có native spend-cap

---

## Q3: Chaining Predict + Margin + iron_bank trong PTB

### Câu hỏi

> Pattern chaining 3 protocol trong single PTB?

### Trả lời (từ team + community)

**Correct flow:**

```
borrow_quote → withdraw → (swap nếu asset khác) → predict_manager::deposit → mint_range
```

**Critical details:**

1. `borrow_*` chỉ **credits MarginManager balance** — KHÔNG trả Coin ra ngoài
2. Phải gọi `withdraw` để extract Coin từ MarginManager vào PTB
3. `predict_manager::deposit` và `mint_range` là **owner-gated** — signer phải là owner

**Testnet constraints:**

| Protocol | Asset | Network |
|----------|-------|---------|
| deepbook_margin | DBUSDC, SUI, DEEP, DBTC | Testnet |
| predict | dUSDC | Testnet |
| iron_bank | USDSUI | **Mainnet only** |

Trên testnet: margin borrow ra DBUSDC, predict cần dUSDC → cần swap step.
iron_bank không có trên testnet. Three-protocol loop đầy đủ = mainnet only.

**Testnet IDs:**

```
MARGIN_PKG:       0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6
MARGIN_REGISTRY:  0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75
PREDICT_PKG:      0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_OBJECT:   0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
DUSDC:            0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
```

---

## Q4: Keyless vault / protocol-owned BalanceManagers

### Câu hỏi (từ @Gutss)

> Muốn vault (shared object) custody funds non-custodially — vault giữ BM caps,
> trade via `withdraw_with_cap` / `generate_proof_as_trader`, không có human owner key.
> `new_with_custom_owner_caps<App>()` cần `assert_app_is_authorized<App>()`.
> Path mở (`new → mint_*_cap`) cần `sender == owner`. Có cách nào trên testnet?

### Trả lời (từ team)

> "For a truly keyless vault you'd need an authorized App, so there's **no self-serve path on testnet**."

- `balance_manager::new_with_custom_owner_caps<App>()` = đúng pattern
- Nhưng App phải được authorize on-chain bởi team
- Không có workaround cho testnet hiện tại
- **PR tracking**: https://github.com/MystenLabs/deepbookv3/pull/1042

---

## Resources

| Resource | URL |
|----------|-----|
| Workshop recording | https://go.sui.io/db-predict-workshop |
| Workshop FAQ | https://mystenlabs.notion.site/db-predict-workshop-faq |
| Workshop scripts (PTB examples) | https://github.com/MystenLabs/deepbookv3/tree/tlee/predict-workshop/scripts/transactions/predict_workshop |
| Keyless vault PR | https://github.com/MystenLabs/deepbookv3/pull/1042 |
| DUSDC faucet | https://tally.so/r/Xx102L |
| Predict server | https://predict-server.testnet.mystenlabs.com |

---

## Action Items cho codebase

| # | Task | Priority | Location |
|---|------|----------|----------|
| 1 | Thêm budget-cap pattern vào `buildTradeTx` (deposit exact budget, not quantity) | High | `tradeActions.ts` |
| 2 | Pre-check oracle ask-bounds trước mint (informational, not blocker) | Low | Trade UI |
| 3 | Add argument order warning comment trong code | Done ✅ | `tradeActions.ts` |
| 4 | Implement margin→predict PTB khi testnet assets align | Backlog | New file |
| 5 | Track `mint(amount)` function release | Watch | - |
| 6 | Track keyless vault / App authorization | Watch | PR #1042 |

---

## Corrections to Previous Understanding

| Previous belief | Correct information |
|----------------|-------------------|
| `ask_bounds: null` blocks minting | ❌ `ask_bounds: null` = normal, no bounds enforced, mint works |
| Need authorized cap to set ask_bounds before mint | ❌ Not needed for minting |
| abort code 1 = oracle config validation complex | ✅ But most common cause = **argument order swap** (expiry↔strike) |
| iron_bank available on testnet | ❌ Mainnet only (USDSUI asset) |

## Q5: Multi-venue router architecture for hackathon demo

### Context

Building a multi-venue trading system that routes across DeepBook Predict, Cetus, NAVI, Suilend.

### Advice (from mentor)

**Pattern: Venue-agnostic adapter**

```
Common interface: quote() / route() / execute()
├── Adapter: DeepBook Predict  (testnet ✅ live)
├── Adapter: Cetus            (testnet ✅ live)
├── Adapter: NAVI             (testnet stub, labeled)
└── Adapter: Suilend          (testnet stub, labeled)
```

- Đặt mỗi venue sau common adapter → router treats all venues the same
- Thêm mainnet venue = chỉ viết adapter mới, không rewrite
- **Demo strategy**: 2 venue live + 2 venue stub với clear labels
- Lead với architecture → show real execution → mainnet roadmap slide

**Judging tip**: "One thing working end-to-end beats a big half-built idea. They want a real demo, not a roadmap."

---

## Q6: Risk Guardian Agent — Agentic Web sub-track

### Concept (confirmed competitive by mentors)

Off-chain agent watches Pyth (price, confidence, staleness) + DeepBook mid price, scores divergence 0-100, fires signal to on-chain Move policy object when threshold breached.

```
Architecture:
┌─────────────────────────────────────────────┐
│  Off-chain Agent                             │
│  - Watch Pyth price feeds                    │
│  - Watch DeepBook mid price                  │
│  - Score divergence 0-100                    │
│  - Fire signal when threshold crossed        │
└──────────────────┬──────────────────────────┘
                   │ signal (tx)
                   ▼
┌─────────────────────────────────────────────┐
│  On-chain Move Policy Object                 │
│  - RE-CHECK breach from on-chain data        │
│  - If confirmed → pause/tighten vault        │
│  - One-way ratchet: only push safer          │
│  - Governance cap (DAO) required to unfreeze │
└─────────────────────────────────────────────┘
```

### Mentor feedback

- ✅ "Competitive for Agentic Web track — 50% judging = real-world impact"
- ✅ "One-way ratchet design alone sets it apart from most agentic DeFi submissions"
- ⚠️ **Critical**: Move object MUST confirm breach from on-chain data — not just trust agent's word
- ⚠️ Pattern itself isn't new → edge is **execution and clean demo**
- Enforce "agent can only push safer" rule **in the contract**

### Relevance cho Predict

Pattern reusable cho PredictManager risk:
- Agent monitor oracle staleness / SVI age / price lag
- Khi divergence cao → signal contract tighten exposure
- Chỉ DAO/owner mới widen lại

---

## Q7: PTB = single wallet confirmation (confirmed)

### Câu hỏi

> Có thể dùng PTB để run nhiều on-chain interactions với 1 wallet confirmation?

### Trả lời (mentor)

> "Exactly. PTBs can bundle multiple actions into a single transaction (pay → swap → deposit) so it's one signature and a seamless UX."

Confirms: deposit + mint trong 1 PTB = 1 user confirmation. Đây là pattern chúng ta đã implement.

---

## Q8: Autonomous track = agent manages independently

### Clarification

- "Autonomous" = agent manages trades/actions **independently** based on upfront guidelines
- Connect wallet 1 lần → set capital caps → system handles the rest
- Không cần manually approve mỗi transaction
- Cho DeFi: PTB giúp reduce manual steps

---

## Q9: USDsui + Testnet USDC coin type

### USDsui

**Mainnet only. Không có testnet faucet.**

Confirm: Three-Protocol Loop (iron_bank + margin + predict) không testable trên testnet.

### Testnet USDC (Circle)

```
Type: 0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

**Common failures:**
1. Dùng mainnet coin type trên testnet → `getCoins` trả empty → tx fail silently
2. Circle faucet chỉ cho USDC, vẫn cần testnet SUI cho gas (faucet.sui.io)

---

## Q10: Solana Keychain concept — relevance cho DeepBook

### Hai "Keychain" khác nhau

| Name | What | Relevance |
|------|------|-----------|
| `solana-foundation/solana-keychain` | Signing infra library (Rust/TS), multi-backend (AWS KMS, Vault, etc.) | ❌ Solana-only, Sui đã có wallet adapters |
| Stache Keychain (on-chain program) | On-chain account linking, delegated session keys, multi-wallet identity | ✅ Concept hay cho delegated trading |

### Stache Keychain concept

```
KeychainID (on-chain PDA)
├── Main Wallet (cold storage)
├── Session Key 1 (mobile, time-limited, scoped)
├── Session Key 2 (bot, budget-capped)
└── Session Key 3 (game client, auto-approve)
```

### Sui equivalents (đã có)

| Keychain concept | Sui equivalent |
|-----------------|----------------|
| Session key | zkLogin ephemeral keys |
| Delegated signing | TradeCap / DepositCap / WithdrawalCap (DeepBook spot) |
| Scoped permissions | Capability-based auth (Sui object model) |
| Program-owned account | `new_with_custom_owner_caps<App>()` (WIP — PR #1042) |
| Multi-wallet identity | Native Multisig / Enoki sessions |

### Kết luận

- DeepBook spot **đã có** Cap delegation (TradeCap, DepositCap, WithdrawalCap)
- DeepBook **Predict chưa có** — PredictManager owner-gated only
- Concept đáng theo dõi nhưng chưa actionable cho Predict hiện tại

---

## Resources & Tools mới

| Resource | URL | Relevance |
|----------|-----|-----------|
| Pawtato (Sui trading bot) | https://pawtato.finance/ | Reference bot architecture |
| t2000 Agent Stack & SDK | https://t2000.ai | Agent infra cho Agentic track |
| Workshop recording | https://go.sui.io/db-predict-workshop | Full walkthrough |
| Workshop FAQ | https://mystenlabs.notion.site/db-predict-workshop-faq | All Q&A |
| Workshop scripts | github.com/MystenLabs/deepbookv3/tree/tlee/predict-workshop/scripts/transactions/predict_workshop | PTB examples |
| Keyless vault PR | github.com/MystenLabs/deepbookv3/pull/1042 | App authorization |
| DUSDC faucet | https://tally.so/r/Xx102L | Testnet tokens |
| Circle testnet USDC faucet | (Circle) | Type: `0xa1ec7fc...::usdc::USDC` |
| Sui testnet SUI faucet | https://faucet.sui.io | Gas |

---

## Hackathon Tracks (Sui Overflow 2025)

| Track | Focus |
|-------|-------|
| AI Agents / Agentic Web | Autonomous agents, risk guardians, trading bots |
| Payments / Financial Primitives | PTB-based payment flows, subscriptions |
| Builder Tooling | SDKs, dev tools, indexers |
| Walrus | Decentralized data, storage |
| DeepBook | Trading, prediction markets, margin |


---

## Q11: Lấy dbUSDC bằng swap on-chain (không cần faucet)

### Câu hỏi

> Làm sao lấy dbUSDC trên testnet?

### Trả lời (từ team)

Swap trực tiếp on-chain qua DeepBook V3 SDK:

```typescript
import { DeepBookClient } from '@mysten/deepbook-v3'

const [baseOutCoin, quoteOutCoin, deepOutCoin] = db.deepBook.swapExactQuoteForBase({
  poolKey: 'SUI_DBUSDC', // pool phù hợp
  inOut: 0, // Minimum quote out (0 = no slippage protection)
});

tx.transferObjects(
  [baseOutCoin, quoteOutCoin, deepOutCoin],
  signer.toSuiAddress(),
);
```

- SDK docs: https://docs.sui.io/onchain-finance/deepbookv3-sdk/
- Dùng version mới nhất của DeepBook SDK (V3)
- Đảm bảo compatible versions giữa `@mysten/deepbook-v3` và `@mysten/sui`

### ⚠️ dbUSDC ≠ dUSDC (Predict)

| Token | Protocol | Cách lấy |
|-------|----------|----------|
| dbUSDC | DeepBook Spot (quote asset) | Swap on-chain via DeepBook SDK |
| dUSDC | Predict (quote asset) | Request qua tally form hoặc team mint |
| USDC (Circle) | General testnet | Circle testnet faucet |

Predict dùng **dUSDC** (`0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`), không phải dbUSDC.

---

## Q12: Oracle keeper outage — settlement stuck

### Report (June 2025)

Oracle `0x195833aeee071530d2bdcd2e03916b7458d57c81ed540b82d6e1cb594bdf41f2`:
- BTC, expiry Jun 12 08:00 UTC
- **Stopped price updates** Jun 10 at 13:55 UTC
- Multiple oracles stopped at exact same second → keeper instance crashed
- Expired Jun 12 → `settlement_price` = null (chưa settle)
- Rest of system fine — other feeds updating normally

### Impact

- Positions priced off this oracle **cannot be redeemed** (settlement_price null)
- Options: wait for keeper restart, hoặc rebuild position on fresh market

### Lessons

1. **Oracle staleness = real production problem** — validates Risk Guardian concept
2. UI should check `settlement_price != null` trước khi enable redeem button
3. Display warning: "Oracle pending settlement — keeper may be down"
4. Multiple oracles dying at same time = single keeper instance failure (not oracle-specific)
5. Cần monitor oracle `last_update_timestamp` — nếu stale > N minutes, flag warning

### Code implication

```typescript
// Trước khi attempt redeem, check settlement
const oracleState = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/state`)
const data = await oracleState.json()

if (data.status === 'settled' && data.settlement_price != null) {
  // Safe to redeem
} else if (data.status === 'pending_settlement') {
  // Show warning: oracle expired but not yet settled
  // Keeper may be down — check last_update_timestamp
}
```

---

## Q13: DeepBook Sandbox — alternative testing tool

### Resource

https://github.com/MystenLabs/deepbook-sandbox

Dùng khi:
- Cần test customizations mà không request lượng lớn DUSDC
- Team đang quản lý DUSDC distribution chặt (volume cao)
- Muốn isolated testing environment

### DUSDC request policy (June 2025)

- Team từ chối requests lớn ($20k DUSDC)
- Khuyên: "start with a smaller amount first"
- Alternative: dùng DeepBook sandbox
- Faucet form vẫn hoạt động: https://tally.so/r/Xx102L

---

## Updated Resources

| Resource | URL | Notes |
|----------|-----|-------|
| DeepBook V3 SDK docs | https://docs.sui.io/onchain-finance/deepbookv3-sdk/ | Swap, margin, spot |
| DeepBook Sandbox | https://github.com/MystenLabs/deepbook-sandbox | Isolated testing |
| DUSDC faucet (tally form) | https://tally.so/r/Xx102L | Request small amounts |
| Predict server | https://predict-server.testnet.mystenlabs.com | API endpoints |
| SUI testnet faucet | https://faucet.sui.io | Gas only |
| Circle testnet USDC | (Circle faucet) | Type: `0xa1ec7fc...::usdc::USDC` |


---

## Q14: Oracle settlement — authorized keepers & orphaned oracles (DEEP DIVE)

### Context

Oracle `0x195833...f2` (BTC, expiry Jun 12 08:00 UTC) stopped getting price updates Jun 10 13:55 UTC.
Multiple oracles stopped at same second → keeper instance died. Oracle expired → `settlement_price` still null.
Another oracle with same 08:00 expiry settled within seconds → different keeper instance, still alive.

### Key technical facts confirmed

#### 1. Settlement requires `OracleSVICap` (authorized only)

```move
// Only authorized keeper can call this:
public fun update_prices(
  oracle: &mut OracleSVI,
  cap: &OracleSVICap,  // ← AUTHORIZED CAP REQUIRED
  spot: u64,
  forward: u64,
  // ... SVI params
)
```

- `update_prices` with `OracleSVICap` is the ONLY way to push new prices and trigger settlement
- When oracle passes expiry + next price update arrives → settlement_price freezes
- **No permissionless settlement path exists** — you cannot settle an oracle yourself
- This is fundamentally different from `redeem_permissionless` (anyone can redeem positions)

#### 2. Keeper architecture (inferred from behavior)

```
Mysten Keeper Infrastructure:
├── Keeper Instance A (owns OracleSVICap for oracles 1, 2, 3)
├── Keeper Instance B (owns OracleSVICap for oracles 4, 5, 6)
├── Keeper Instance C (owns OracleSVICap for oracles 7, 8, 9)
└── ...

If Instance A dies:
  → Oracles 1, 2, 3 stop receiving price updates
  → When they expire, settlement_price = null forever (orphaned)
  → Oracles 4-9 continue normally (different keeper instances)
```

- Settlement is NOT "all oracles at expiry X settle together"
- Each oracle is bound to a specific keeper instance via its `OracleSVICap`
- Keeper instance death = all its oracles become orphaned
- Multiple oracles dying at same second = strong signal of single instance crash

#### 3. Orphaned oracle = likely stuck forever (on testnet)

The question "do orphaned oracles eventually get picked up?" was asked directly to team.
**No definitive answer given** — team only said "this oracle is already expired" (not helpful).

**Practical conclusion**: On testnet, orphaned oracles likely stay unsettled forever unless:
- Team manually restarts the specific keeper instance
- Team manually settles with the cap
- A monitoring system detects and re-assigns

**Recommendation**: Move tests to a fresh market. Don't wait.

**Real impact reported**: One builder's vault held a position on this orphaned oracle — funds
locked, cannot recover without settlement. Rebuilding the entire simulation from scratch is
significantly more work than simply swapping the oracle, because positions are part of a larger
test setup (vault state, manager balances, strategy parameters). This is a **capital loss**
scenario on testnet.

**Design lesson**: Never commit vault/strategy funds to a single oracle without an exit plan.
Consider spreading positions across multiple oracles, or building test harnesses that can
snapshot and restore state independently of oracle settlement.

---

### Bài học rút ra (Lessons Learned)

#### For builders on DeepBook Predict

| # | Lesson | Action |
|---|--------|--------|
| 1 | Oracle settlement = centralized dependency | Design UI/bot to handle "oracle stuck" gracefully |
| 2 | Cannot self-serve settle | Don't build features that assume settlement happens automatically |
| 3 | Keeper instance crash = multiple oracles orphaned at once | Monitor `last_update_timestamp` across all oracles |
| 4 | Same expiry ≠ same fate | Don't assume "expiry 08:00 = all settle at 08:00" |
| 5 | Testnet infra less reliable than mainnet will be | Always have fallback: "use a different oracle" |
| 6 | Position stuck on orphaned oracle = capital locked | Build early detection + warning for users |
| 7 | Vault holding positions on single oracle = single point of failure | Diversify across oracles, never all-in on one |
| 8 | Rebuilding simulation from scratch >> swapping oracle | Design vault tests with recovery path (snapshot state, allow oracle swap) |

#### For our codebase specifically

| # | What to implement | Where |
|---|-------------------|-------|
| 1 | Orphaned oracle detection | Oracle health monitor |
| 2 | "Oracle likely stuck" warning in UI | Trade panel, portfolio |
| 3 | Auto-suggest fresh oracle when current is stale | Oracle selector |
| 4 | Don't show "Claim" button for positions on unsettled oracles | Portfolio tab |
| 5 | Track keeper health via `last_update_timestamp` delta | KeeperTab, alerts |

---

### Two types of "keeper" — critical distinction

```
┌─────────────────────────────────────────────────────────────────┐
│  TYPE 1: Oracle Price Keeper (AUTHORIZED — Mysten only)         │
│                                                                  │
│  What: Push price updates, trigger settlement                    │
│  Who: Mysten Labs infra (holds OracleSVICap)                    │
│  Permission: AUTHORIZED — requires OracleSVICap                  │
│  If dies: Oracle stops updating, settlement_price = null         │
│  You can do: NOTHING (except report to team)                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TYPE 2: Position Redeem Keeper (PERMISSIONLESS — anyone)        │
│                                                                  │
│  What: Call redeem_permissionless for settled positions           │
│  Who: Anyone with SUI for gas                                    │
│  Permission: NONE — fully permissionless                         │
│  Prerequisite: Oracle MUST be settled (settlement_price != null)  │
│  Incentive: Currently none (you pay gas, payout goes to owner)   │
│  You can do: Build and run this yourself ✅                      │
└─────────────────────────────────────────────────────────────────┘
```

**TYPE 2 cannot function without TYPE 1 completing first.**
If oracle never settles → redeem_permissionless can never be called → positions stuck.

---

### Orphaned oracle detection code

```typescript
/**
 * Detect if an oracle is likely orphaned (expired but never settled).
 * 
 * Heuristic: If oracle expired > 30 minutes ago and still not settled,
 * the keeper is probably dead. Normal settlement happens within seconds.
 */
function classifyOracleHealth(oracle: {
  status: string
  expiry: number
  settlement_price: number | null
  last_update_timestamp?: number
}): 'healthy' | 'stale' | 'orphaned' {
  const now = Date.now()
  
  // Already settled = healthy
  if (oracle.status === 'settled' && oracle.settlement_price != null) {
    return 'healthy'
  }
  
  // Active but not updating = stale (keeper may be dying)
  if (oracle.status === 'active' && oracle.last_update_timestamp) {
    const staleness = now - oracle.last_update_timestamp
    if (staleness > 5 * 60 * 1000) return 'stale' // > 5 min without update
  }
  
  // Expired but not settled = orphaned
  if (oracle.expiry < now) {
    const timeSinceExpiry = now - oracle.expiry
    if (timeSinceExpiry > 30 * 60 * 1000) return 'orphaned' // > 30 min past expiry
    return 'stale' // < 30 min — might still settle
  }
  
  return 'healthy'
}

// Usage in UI:
const health = classifyOracleHealth(oracle)
if (health === 'orphaned') {
  showWarning('Oracle expired >30 min ago without settlement. Keeper likely down. Use a different oracle.')
} else if (health === 'stale') {
  showWarning('Oracle has not updated recently. Monitor closely.')
}
```

---

### Timeline of the incident (reconstructed)

```
Jun 10, 13:55 UTC — Keeper instance crashes
  → Multiple oracles stop receiving price updates
  → oracle 0x1958... last_update_timestamp frozen at Jun 10 13:55

Jun 10-12 — Oracle is "active" but stale (no new data)
  → Mints still possible (oracle.status = active)
  → But prices are stale → positions priced incorrectly

Jun 12, 08:00 UTC — Oracle expiry timestamp reached
  → Status transitions to "pending_settlement"
  → Normally: first post-expiry price update → freezes settlement_price
  → But keeper is dead → no update arrives → settlement_price = null

Jun 12, 08:00+ UTC — Other oracles with same expiry settle normally
  → Different keeper instance → different OracleSVICap → works fine

Jun 12, present — Oracle stuck in "pending_settlement" forever
  → settlement_price = null
  → redeem_permissionless cannot be called
  → Positions are effectively locked
```

---

### Impact on predict-club architecture

For Predict Club rounds:
1. When selecting oracle for a round, **check staleness** before proposing to members
2. If oracle becomes stale during an active round, **warn leader immediately**
3. If round oracle is orphaned post-expiry, **mark round as "settlement pending — oracle issue"**
4. Provide "Switch to fresh oracle" action for leader (cancel round + create new)
5. Never auto-commit to a single oracle without health check

```typescript
// Before creating a round, validate oracle health
async function validateOracleForRound(oracleId: string): Promise<{
  valid: boolean
  reason?: string
}> {
  const state = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/state`).then(r => r.json())
  
  if (state.status !== 'active') {
    return { valid: false, reason: `Oracle is ${state.status}, not active` }
  }
  
  const staleness = Date.now() - state.last_update_timestamp
  if (staleness > 5 * 60 * 1000) {
    return { valid: false, reason: `Oracle stale (last update ${Math.round(staleness/60000)}m ago)` }
  }
  
  // Check expiry is far enough in the future for the round
  const timeToExpiry = state.expiry - Date.now()
  if (timeToExpiry < 10 * 60 * 1000) {
    return { valid: false, reason: `Oracle expires in ${Math.round(timeToExpiry/60000)}m — too soon` }
  }
  
  return { valid: true }
}
```


---

## Q15: Oracle creation — self-serve NOT possible (confirmed)

### Câu hỏi

> Are there short-expiry oracles live on testnet? Can builders create one themselves?
> `add_oracle_grid` is `public(package)` and requires `OracleSVICap`.

### Trả lời (từ team)

- **Self-serve is NOT possible** — `add_oracle_grid` requires `OracleSVICap`
- Chỉ team Mysten mới tạo oracle mới
- Lấy active oracles: `GET /predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/oracles`
- Endpoint có thể trả về inactive oracles → filter bằng check on-chain object
- Example TX showing oracle setup: https://testnet.suivision.xyz/txblock/E965YssePiRm4eqqnxunVGbknFF1eKxUsHTvezpYpXTs?tab=Changes

### Implication

Builders hoàn toàn phụ thuộc team Mysten cho:
1. Tạo oracle mới (oracle grid)
2. Price updates (keeper với OracleSVICap)
3. Settlement (post-expiry price push)

Không có path nào để tự lập oracle riêng trên testnet.

---

## Q16: Risk Guardian — AI chỉ tính score, có competitive không?

### Câu hỏi

> AI chỉ calculate risk score (0-100). Contract tự verify on-chain data trước khi act.
> FREEZE dựa trên Pyth<>DeepBook divergence (on-chain math), không dựa AI.
> Lo "Generic LLM wrappers that happen to hold SUI will not place".

### Architecture đề xuất

```
[offchain] AI agent heartbeat:
  - Input: oracles + DeepBook mid + volatility market data
  - Output: 0-100 risk score
  
[onchain] GuardianPolicy (shared Move object):
  [1] Nhận AI score → điều chỉnh params lending SAFETY direction only
      - Contract checks: timestamp, Pyth<>DeepBook divergence
      - Only allows params to move SAFER (one-way ratchet)
  [2] FREEZE based on on-chain divergence (NOT AI decision)
      - Pure math: abs(pyth_price - deepbook_mid) > threshold
      - Unfreeze: only DAO/owner cap
```

### Phân tách responsibilities

| Component | Role | Trust Level |
|-----------|------|-------------|
| AI agent (off-chain) | Calculate risk score, push to contract | Advisory — can only suggest safer |
| Move contract (on-chain) | Verify divergence, enforce bounds, freeze | Authoritative — source of truth |
| DAO/owner cap | Unfreeze, widen params | Governance — ultimate authority |

### Tại sao competitive (based on earlier mentor feedback)

- ✅ Not a "generic LLM wrapper" — AI is advisory, contract is enforcement
- ✅ One-way ratchet: AI cannot harm, only push safer
- ✅ FREEZE uses on-chain math, not AI output
- ✅ Contract verifies independently before acting
- ✅ Real problem: oracle divergence protection for lending vaults

### Chưa có reply chính thức từ mentor cho câu hỏi này

Nhưng architecture matches exactly với feedback Q6: "the Move object should confirm the breach from on-chain data itself, not just take the agent's word for it."

---

## Q17: DUSDC faucet — process via tally form

### Confirmed flow

> "Thanks for filling it, that's the right way to request DUSDC and it'll get processed from there.
> Hang tight, it'll come through. You can keep building in the meantime."

- Tally form: https://tally.so/r/Xx102L
- Processed manually by team (không instant)
- Không có programmatic faucet
- Nếu blocked: ping team với specific blocker


---

## Future Ideas (Stretch / Next)

### x402/MPP để monetize Predict data API

Có thể dùng x402/MPP (Machine Payments Protocol) để monetize Predict data API — ví dụ:
- Premium real-time SVI surface data (pay-per-query)
- Risk scores / divergence alerts (subscription via micro-payments)
- Historical oracle data + backtesting (metered access)

Đây là concept rất xa, không phải core DeepBook functionality. Nhưng nếu build data layer cho Predict, x402 pattern (HTTP 402 → agent pays USDC → gets data) là interesting monetization path cho:
- Bot builders muốn premium data feeds
- AI agents cần real-time vol surface cho trading decisions
- Third-party analytics platforms

References:
- suimpp.dev (MPP on Sui)
- https://github.com/MystenLabs/x402 (outdated but Sui-native)
- https://github.com/x402-foundation/x402/pull/2616 (working implementation)


---

## Q18: Risk Guardian Sub-track 1 — MUST-HAVES & mentor validation

### Sub-track 1 official must-haves

> "Must have: live price feed, visible AI risk score, at least one autonomous on-chain action, human override mechanism"

| # | Must-Have | Description |
|---|-----------|-------------|
| 1 | Live price feed | Pyth/DeepBook real-time streaming |
| 2 | Visible AI risk score | UI displays 0-100 score |
| 3 | At least one autonomous on-chain action | Contract auto-tightens or freezes without human trigger |
| 4 | Human override mechanism | DAO/owner can unfreeze/widen |

**Important**: must-haves = required expectations for specific sub-track. Missing any → may fit broader Agentic Web but NOT sub-track 1.

### Mentor validation (confirmed competitive)

> "You are on the right path. Since this concept fits right into the sub-track, the product direction is correct."

### To avoid "generic LLM wrapper" — build robust specialized ML model

**Required differentiation:**

1. **Specialized AI risk model** — not generic analysis tool
2. **Clear scoring criteria** — not just oracle health:
   - Liquidity depth (on-chain via DeepBook + off-chain CEXs)
   - Volatility velocity
   - Price divergence (Pyth vs DeepBook mid)
3. **Provable robustness:**
   - Documented ML methodology
   - Backtests for crypto flash crash cases
   - Listed input metrics with justification
4. **Reference**: Gauntlet / Chaos Labs (leading quantitative risk management firms)

### Validated trust model: trust-minimized (not trustless)

```
Trust-minimized = same category as Gauntlet/Chaos Labs
- Cannot re-derive AI score on-chain (impossible)
- Accept this tradeoff explicitly
- Mitigate with contract-level verification for critical actions
```

**Two-tier enforcement (confirmed valid by mentor):**

```
[Tier 1] ML risk adjustments (advisory):
  - Off-chain ML computes risk score
  - Pushes score to contract
  - Contract APPROVES or DECLINES based on own checks
  - Can only make params SAFER (one-way ratchet)

[Tier 2] FREEZE (autonomous, no ML):
  - Contract-only calculation: abs(pyth_price - deepbook_mid) > threshold
  - No AI involved in freeze decision
  - Pure on-chain math → trustless
  - Unfreeze: only DAO/owner cap
```

### Track submission clarification

- 1 project = 1 track (form allows only 1 submission)
- "Problem statements" = guidance for broader track (flexible)
- "Must-haves" = **required** for specific sub-track (strict)
- Broader Agentic Web idea without sub-track must-haves → submit to general Agentic Web

---

## Q19: Oracle orphaned — final resolution

### Outcome (from thread Q12/Q14)

- Team: "Let me double-check with the team and get back to you" — escalated internally
- Builder: "We'll go ahead with new testing. Funds locked by Predict = written off as lost."

### Final status

| Item | Status |
|------|--------|
| Oracle settled? | **No** — still stuck |
| Funds recoverable? | **No** — permanently locked |
| Team fix timeline? | Unknown — "double-checking" |
| Builder action | Rebuilt on fresh oracle, accepted loss |
| DUSDC lost | Cannot return to faucet pool |

### Lesson (definitive)

**On testnet, funds locked by orphaned oracle = permanent loss.** No admin override demonstrated, no manual settlement path available. Budget test DUSDC accordingly — never deploy all funds to a single oracle.


---

## Q20: Swap trực tiếp trên DeepBook testnet (market makers active)

### Context

> "If the mods are slow to respond and you're in a hurry, feel free to swap directly on DeepBook testnet. We have market makers providing liquidity there."

### Code example (from team)

```typescript
const tx = new Transaction()

// swapExactQuoteForBase: sell exact SUI (quote) → get DEEP (base)
const [baseOutCoin, quoteOutCoin, deepOutCoin] = tx.add(
  client.deepbook.deepBook.swapExactQuoteForBase({
    poolKey,           // e.g. 'DEEP_SUI'
    amount: 1,        // sell 1 SUI (quote)
    deepAmount: 0,    // DEEP fee amount (0 if not paying with DEEP)
    minOut: 0,        // minimum base out (0 = no slippage protection)
  }),
)

// MUST transfer all 3 return coins or get UnusedValueWithoutDrop error
tx.transferObjects(
  [baseOutCoin, quoteOutCoin, deepOutCoin],
  signer.toSuiAddress(),
)
```

### Key details

| Detail | Value |
|--------|-------|
| Pool used | `DEEP_SUI` (confirmed liquidity) |
| Return values | **3 coins** (base, quote, deep) — transfer ALL |
| `deepAmount` | 0 = not paying fees with DEEP |
| `minOut` | 0 = no slippage protection (testnet OK) |
| Market makers | Active on testnet, providing liquidity |

### ⚠️ Note: This gets DEEP, not dUSDC

- This example swaps SUI → DEEP via DeepBook spot
- To get **dUSDC** (Predict quote asset): still need tally form faucet
- Unless there's a dUSDC pool with liquidity (check available pools)
- Pattern is the same: `swapExactQuoteForBase` / `swapExactBaseForQuote`

### Available testnet pools (check via SDK)

```typescript
import { DeepBookClient } from '@mysten/deepbook-v3'

const client = new DeepBookClient({ client: suiClient, network: 'testnet' })
// Check client.pools for available trading pairs
```

Or via indexer: `https://deepbook-indexer.mainnet.mystenlabs.com/pools` (mainnet)
Testnet equivalent may differ.
