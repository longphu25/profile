# Sui Overflow Hackathon — Notes & Logistics

Compiled from Discord group discussions (June 2025).

---

## Hackathon Rules & Logistics

### Demo Day

- **Testnet OK for demo day** — project can run on testnet during demo and judging
- **Mainnet required for prize** — winners must deploy to mainnet to receive remaining prize portion
- Outlined in Award Structure section of participant handbook

### Submission

- **Core Track checkbox** — tick if submitting under Agentic Web OR DeFi & Payments (no separate bounties)
- **Pre-existing projects allowed** — must disclose + clearly specify what was built during hackathon
- **Package ID** on submission form = contract address (like Solidity contract address)

### Tracks

| Track | Focus |
|-------|-------|
| Agentic Web | Autonomous agents, risk guardians, AI-powered DeFi |
| DeFi & Payments | Financial primitives, PTB payment flows |
| Builder Tooling | SDKs, dev tools, indexers |
| Walrus | Decentralized data, storage |

---

## zkLogin — Address Derivation (Important)

```
zkLogin address = f(Google issuer, OAuth client_id, user_account, user_salt)
```

**Key facts:**
- Different `client_id` OR different `salt` → different Sui address
- This is **by design** (privacy) — one Google account doesn't map to single shared address
- Two apps share same address ONLY if they share same `client_id` + same `salt`
- Harbor and your app → different client IDs → different addresses for same Gmail

**Implication for predict-club:**
- If using zkLogin, users get unique address per app
- Cannot "share identity" between Harbor and our app without sharing OAuth credentials

---

## Enoki Sponsored Transactions

### How it works

- Client-side: build tx normally (no difference from standard approach)
- Server/config: add transaction to **allowlist** in Enoki Portal settings page
- Mainnet supported with **paid subscription**

### Resources

- Docs: https://docs.enoki.mystenlabs.com/
- Enoki Portal: manage allowlists, subscription
- MemWal source (reference): https://github.com/MystenLabs/MemWal/blob/dev/apps/app/src/pages/LandingPage.tsx

### Storage payment

- Walrus storage paid with **WAL** token
- Not sponsored by default (separate from tx sponsoring)

---

## Harbor (Walrus Storage Service)

### API Key situation

- Harbor has `ApiKeyCreateResponse` model in OpenAPI docs
- But **does NOT expose API to create keys programmatically**
- No official "embed Harbor with zkLogin" API exists
- Builders copying internal site flow → fragile, breaks on Harbor deploys

### Known issues (June 2025)

1. **Prisma `email_hash` unique constraint error** — if headless session creation already made user record, subsequent login attempts fail
2. **zkLogin address mismatch** — expected behavior (different client_id/salt per app)
3. **Session creation regression** — team deployed fix that broke headless flows

### Walrus auth model

> "For Walrus itself, there isn't really a concept of creating API keys for end users.
> Authentication and authorization are tied to wallet signatures and ownership of Sui objects,
> not per-user API tokens."

---

## x402 on Sui

- Repo: https://github.com/MystenLabs/x402
- **Warning**: Mysten repo is "drastically outdated"
- Most recent working implementation: https://github.com/x402-foundation/x402/pull/2616
- x402 = HTTP 402 Payment Required protocol (pay-per-request API monetization)

---

## CLI / Tooling Notes

### `sui` CLI outdated on Homebrew

Fix: use `suiup` to update instead of Homebrew:
```bash
suiup
```

### USDC testnet issues

- Common problem: USDC tx not going through on testnet
- Fix: update `sui` CLI via `suiup`
- Testnet USDC type: `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC`

---

## Useful Links

| Resource | URL |
|----------|-----|
| Enoki docs | https://docs.enoki.mystenlabs.com/ |
| MemWal (memory + Walrus) | https://staging.memory.walrus.xyz/ |
| MemWal source | https://github.com/MystenLabs/MemWal |
| x402 Sui (outdated) | https://github.com/MystenLabs/x402 |
| x402 PR (current) | https://github.com/x402-foundation/x402/pull/2616 |
| Harbor API docs | https://api.testnet.harbor.walrus.xyz/docs/openapi |
| SuiVision (testnet) | https://testnet.suivision.xyz/ |
| Sui testnet faucet | https://faucet.sui.io |
| DUSDC request | https://tally.so/r/Xx102L |


---

## Velfi (velfi.xyz)

- **By**: Kingnanaweb3
- **What**: Programmable Payments on Sui
- **Track**: Agentic Web ("AI handles payments to the point of user confirmation")
- **Repo**: https://github.com/Kingnanaweb3/velfi-app
- **Relevance cho DeepBook**: Không. Payment-focused, không dùng DeepBook/Predict/Margin.

---

## suimpp.dev — Machine Payments Protocol on Sui

### What

MPP (Machine Payments Protocol) ported sang Sui. Open standard bởi Stripe + Tempo Labs.

**Flow:**
```
1. Client request paid resource
2. Server returns HTTP 402 Payment Required + payment instructions
3. Client (AI agent) signs payment in USDC
4. Client retries request with payment proof
5. Server delivers resource
```

No API keys, no accounts, no subscriptions. Sub-second settlement.

### Origin

- **x402**: Coinbase (late 2024) — HTTP 402 + USDC on Base
- **MPP**: Stripe + Tempo Labs — extends x402 with more features
- **suimpp**: Port of MPP to Sui ecosystem

### Comparison: x402 vs MPP

| Feature | x402 (Coinbase) | MPP (Stripe/Tempo) |
|---------|----------------|-------------------|
| Standard | HTTP 402 + payment header | HTTP 402 + extended negotiation |
| Settlement | EIP-3009 (USDC) or Permit2 | Multi-token, multi-chain |
| Sui support | https://github.com/MystenLabs/x402 (outdated) | suimpp.dev |
| Use case | Simple API paywall | Complex metered services |

### Resources

| Resource | URL |
|----------|-----|
| suimpp (Sui port) | https://suimpp.dev/ |
| MPP Dashboard | https://mpplayerprotocol.com/ |
| x402 Sui (outdated) | https://github.com/MystenLabs/x402 |
| x402 working PR | https://github.com/x402-foundation/x402/pull/2616 |
| x402 vs MPP (Alchemy) | https://www.alchemy.com/blog/x402-vs-mpp-comparing-agent-payment-protocols |
| Cloudflare x402 docs | https://developers.cloudflare.com/agents/x402/ |

### Relevance cho DeepBook

**Không trực tiếp liên quan.** Đây là payment protocol cho API monetization, không phải trading.

Stretch concept (future): monetize Predict data API qua x402/MPP (premium SVI data, risk scores). Xem thêm note trong `docs/deepbook/predict/COMMUNITY-QA.md`.
