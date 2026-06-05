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
