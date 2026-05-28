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
