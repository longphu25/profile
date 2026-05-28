# Sui On-chain Finance — Deep Dive

Comprehensive technical documentation for Sui's on-chain finance primitives, with practical guidance for the `@mysten/deepbook-v3` TypeScript SDK.

## Documents

| Topic | English | Vietnamese |
|-------|---------|------------|
| Closed-Loop Token | [closed-loop-token.md](./closed-loop-token.md) | [closed-loop-token.vi.md](./vi/closed-loop-token.vi.md) |
| Permissioned Asset Standard (PAS) | [pas.md](./pas.md) | [pas.vi.md](./vi/pas.vi.md) |
| DeepBookV3 (CLOB) | [deepbookv3.md](./deepbookv3.md) | [deepbookv3.vi.md](./vi/deepbookv3.vi.md) |
| DeepBook Margin | [deepbook-margin.md](./deepbook-margin.md) | [deepbook-margin.vi.md](./vi/deepbook-margin.vi.md) |
| DeepBook Predict | [deepbook-predict.md](./deepbook-predict.md) | [deepbook-predict.vi.md](./vi/deepbook-predict.vi.md) |
| `@mysten/deepbook-v3` SDK Reference | [sdk-reference.md](./sdk-reference.md) | [sdk-reference.vi.md](./vi/sdk-reference.vi.md) |

## Reading Order

1. **Closed-Loop Token** — building block for restricted-flow tokens (foundation)
2. **PAS** — full asset-permissioning system (extends CLT concepts)
3. **DeepBookV3** — base CLOB exchange, used directly and by margin/predict
4. **DeepBook Margin** — leverage layer on top of DeepBookV3
5. **DeepBook Predict** — vol-surface prediction markets (composes with all above)
6. **SDK Reference** — practical TS code for everything above

## Source Reading

- Official docs: https://docs.sui.io/onchain-finance/
- SDK: `node_modules/@mysten/deepbook-v3` (v1.4.1)
- Predict source: https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16

## External References

| Project | Type | Use case |
|---------|------|----------|
| [predict-cli](https://github.com/SeventhOdyssey71/predict-cli) | Rust CLI | Most accurate Predict reference: full mint/redeem flow, local SVI pricing, agentic perps layer |
| [mcxross/deepbook-cli](https://github.com/mcxross/deepbook-cli) | TS CLI + TUI | Production CLI for spot/margin/predict. Reference for SDK usage |
| [mcxross/skills](https://github.com/mcxross/skills) | Skill bundles | AI-agent skills including `deepbook-cli` |
| [KZN-Labs/DeepDive](https://github.com/KZN-Labs/DeepDive) | Go server | Real-time order book streaming (event subscriber → WebSocket + REST) |

## Critical fixes from references

These details are not obvious from the official docs alone but are essential for working code:

### Predict mint requires 3 transactions

```
TX 1: predict::create_manager  → wait for indexer
TX 2: predict_manager::deposit<DUSDC>  ← often missed!
TX 3: predict::mint or mint_range
```

The `mint` function reads from the manager's balance, not the wallet. Without TX 2, the mint will fail with insufficient funds.

### Strike validation

```
strike >= min_strike  AND  (strike − min_strike) % tick_size == 0
```

### Pricing formula (exact)

```
k = ln(K / F)
w(k) = a + b · (ρ·(k−m) + √((k−m)² + σ²))
d₂ = −k/√w − √w/2
P(S_T > K) = N(d₂)              ← binary UP fair value
```

The on-chain price adds spread + utilization adjustment that cannot be reproduced client-side without `devInspect`.

### Settlement boundaries

- Binary UP wins iff `settlement > strike` (strict)
- Range wins iff `lower < settlement ≤ higher` (open-closed)
