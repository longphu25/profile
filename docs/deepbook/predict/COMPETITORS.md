# DeepBook Predict — Competitor Analysis

---

## DeepMarket (@Deepmarket64083)

**URL**: https://x.com/Deepmarket64083
**Status**: Live on testnet (predict-testnet-4-16)
**Type**: Standalone web app (dedicated domain)
**Track**: Likely Agentic Web or DeepBook

### Features

| Feature | Detail |
|---------|--------|
| Predict tab | Binary UP/DOWN + Range minting, strike grid ($1 increments), live countdown |
| Vol Smile | TradingView chart integration + candles/trades views |
| Vault | PLP supply/withdraw, live NAV, PLP share price, risk dashboard |
| Vault Risk | Exposure/TVL, Total Max Payout, Total MTM, Withdrawal Limiter status |
| Leaderboard | Trading performance ranking |
| Portfolio | Position tracking with oracle links |
| Agent tab | AI agent autonomous trading, AgentCap on-chain, verifiable decisions |
| Multi-Outcome | Custom markets beyond BTC binary (UI button visible) |
| +New Market | Custom market creation button |

### Key differentiator: AgentCap + MemWal (Provable AI)

```
Architecture:
├── AI agent operates under on-chain AgentCap (Move capability object)
├── Every trade decision has verifiable TX link
├── Agent reasoning stored on Walrus via MemWal
├── "Not trust-me AI. Provable AI."
└── Poll interval: 30s
```

From Agent tab (observed):
- 9 decisions, 9 mints, 0 passes
- 7 UP, 2 DOWN
- $4 total cover
- Agent addresses: `0x8e67...c325`, `0xe5a7...1196`
- Each row links to on-chain TX

### AgentCap pattern (worth studying)

```move
// Likely structure (inferred from behavior):
struct AgentCap has key, store {
    id: UID,
    owner: address,        // human owner
    agent: address,        // AI agent address
    budget_limit: u64,     // max spend per period
    oracle_filter: vector<ID>,  // which oracles agent can trade
}

// Agent signs tx with own keypair, presents AgentCap as authorization
// Every decision recorded on-chain → auditable
// Reasoning stored on Walrus (MemWal) → provable
```

### Vault metrics (testnet snapshot)

```
Vault TVL:            $1,015,364.09
Available liquidity:  $1,013,512.37
Utilization:          0.2%
NAV (live):           $1,014,666.34
PLP share price:      $1.0026 (+0.20% vs par)
MTM liability:        $697.75
Total Max Payout:     $1,851.72
Exposure/TVL:         0.182%
Cap used:             0.2% of $812,291.27
Withdrawal Limiter:   Disabled — capped only by available headroom
Unsettled oracles:    0
```

### UI/UX observations

- Very polished dark theme
- TradingView charts embedded
- Strike grid shows $1 increments (grid of buttons)
- Live countdown (HRS:MIN:SEC)
- Current price + forward price displayed
- Manager balance prominent (wallet vs manager separation clear)
- "WITHDRAW $13.12 → WALLET" button (one-click)
- Testnet badge visible

---

## Comparison: DeepMarket vs Our Project (Predict Club)

### They have, we don't

| Feature | DeepMarket | Priority to add |
|---------|-----------|-----------------|
| AgentCap (on-chain AI authorization) | ✅ | High — strong narrative |
| MemWal (provable reasoning storage) | ✅ | Medium — Walrus integration |
| Leaderboard | ✅ | Low — easy to add |
| TradingView charts | ✅ | Low — nice-to-have |
| Multi-Outcome markets | ✅ (button exists) | Low — oracle creation = team only |

### We have, they don't

| Feature | Our project | Competitive edge |
|---------|-------------|-----------------|
| Club workflow (leader/member/rounds) | ✅ | Social trading UX, group consensus |
| Escrow market (P2P USDC↔DUSDC) | ✅ | Onboarding without faucet dependency |
| Fair value calculator (SVI-based) | ✅ | Pricing transparency |
| Oracle health monitor (stale/orphaned detection) | ✅ | Risk management |
| Multi-venue router (DeepBook + Cetus + more) | ✅ | Architecture extensibility |
| Three-Protocol Loop design (margin + predict + iron_bank) | ✅ | Composability showcase |
| Keeper service (batch permissionless redeem) | ✅ | Protocol maintenance |
| Risk Guardian concept (one-way ratchet) | ✅ Design | Agentic Web sub-track fit |
| Plugin architecture (composable, reusable) | ✅ | Builder tooling angle |

### Comparable features

| Feature | DeepMarket | Us | Notes |
|---------|-----------|-----|-------|
| Binary + Range minting | ✅ | ✅ | Similar UX |
| PLP Vault supply/withdraw | ✅ | ✅ | Similar |
| Risk dashboard (exposure, MTM) | ✅ | ✅ | Both have it |
| Portfolio tracking | ✅ | ✅ | Similar |
| Live oracle streaming | ✅ | ✅ | Both WebSocket |
| Wallet connection | ✅ | ✅ | Standard |

---

## Strategic Implications

### If competing on DeepBook track

DeepMarket is the most feature-complete competitor observed. Their edge:
- Standalone polished app (vs our plugin architecture)
- AgentCap narrative (provable AI trading)
- TradingView integration (professional look)

Our edge:
- Social/club layer (unique — no one else has group trading)
- Multi-venue architecture (beyond just Predict)
- Composability (Three-Protocol Loop)
- Risk management (oracle health, keeper, guardian)

### If competing on Agentic Web track

DeepMarket's Agent tab directly competes with Risk Guardian concept.
Their approach: "AI trades FOR you" (AgentCap + verifiable decisions)
Our approach: "AI protects you" (Risk Guardian + one-way ratchet)

Different angles — both valid. Theirs is more aggressive (AI makes money), ours is more defensive (AI prevents losses).

### Recommendations

1. **Don't try to out-polish them on trading UI** — they're ahead on standalone app UX
2. **Double down on social layer** — club workflow is unique differentiator no one else has
3. **If Agentic Web: build AgentCap equivalent** — or lean into Risk Guardian (defense > offense)
4. **If DeepBook track: lead with composability** — multi-venue + three-protocol + keeper
5. **Consider MemWal integration** — storing trade reasoning on Walrus is strong narrative regardless of track

---

## Other Hackathon Projects Observed (not DeepBook competitors)

| Project | Track | What | URL |
|---------|-------|------|-----|
| Velfi | Agentic Web | Programmable payments, AI-handled payment confirmation | https://velfi.xyz |
| suimpp | DeFi & Payments | MPP (Machine Payments Protocol) on Sui, HTTP 402 agent payments | https://suimpp.dev |
| Splashz | (unknown) | Mobile-first UI | https://v1.splashz.xyz |

---

## References

- DeepMarket Twitter: https://x.com/Deepmarket64083/status/2066229398559240224
- MemWal (Walrus memory): https://staging.memory.walrus.xyz/
- MemWal source: https://github.com/MystenLabs/MemWal


---

## DeepPulse (@deeppulse0)

**URL**: https://x.com/deeppulse0
**Type**: Autonomous AI market-making agent
**Target**: DeepBook CLOB (spot), NOT Predict
**Track**: Agentic Web or DeepBook

### What it does

AI market-maker that provides 24/7 liquidity on DeepBook spot order book:

| Feature | Detail |
|---------|--------|
| Pricing model | Avellaneda-Stoikov (optimal bid/ask quotes) |
| Execution | Atomic via Sui PTBs |
| Risk management | Circuit breakers |
| Audit trail | Walrus-verified decision logs |
| Goal | Tighter spreads, deeper liquidity |

### Relevance

- **Not a direct competitor** — spot CLOB market-making, not prediction markets
- Same track (DeepBook) but different vertical
- Shares pattern: autonomous agent + Walrus logs + circuit breakers
- Shows judges expect: verifiable AI decisions + risk controls

### Pattern overlap with our approach

| Concept | DeepPulse | Us |
|---------|-----------|-----|
| Autonomous on-chain action | ✅ Place/cancel orders | ✅ Tighten/freeze vault |
| Audit trail (Walrus) | ✅ Decision logs | ❌ (could add) |
| Circuit breaker | ✅ Stop trading | ✅ Freeze lending |
| Risk model | Avellaneda-Stoikov (spread) | ML risk score (divergence) |
| Target | DeepBook spot liquidity | DeepBook Predict positions |

---

## Competitive Landscape Summary

| Project | Focus | Track | Threat level |
|---------|-------|-------|-------------|
| **DeepMarket** | Predict trading + provable AI agents | DeepBook/Agentic | 🔴 High (direct) |
| **DeepPulse** | Spot CLOB market-making AI | DeepBook/Agentic | 🟡 Medium (same track, different vertical) |
| **Velfi** | Programmable payments | Agentic Web | 🟢 Low (different domain) |
| **suimpp** | Machine payments protocol | DeFi & Payments | 🟢 Low (different domain) |
| **predict-cli** (SeventhOdyssey) | Rust CLI for Predict | Builder Tooling | 🟡 Medium (same protocol, different product) |
