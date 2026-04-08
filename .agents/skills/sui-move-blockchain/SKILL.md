---
name: Sui Move Blockchain Development
description: Use when building Sui blockchain features — wallet integration, on-chain queries, transactions, dApp Kit, client extensions, Move object patterns. Covers @mysten/sui (gRPC/GraphQL/JSON-RPC), @mysten/dapp-kit-react, @mysten/walrus, @mysten/seal, @mysten/zksend, @mysten/payment-kit. For SDK 2.0 migration specifics, see the sui-sdk-2-migration skill.
metadata:
    version: "1.0"
---

# Sui Move Blockchain Development

## Product Summary

Sui is a Layer 1 blockchain using the Move programming language. The TypeScript SDK (`@mysten/sui` v2.x) provides gRPC, GraphQL, and JSON-RPC clients for interacting with the Sui network. `@mysten/dapp-kit-react` provides React hooks for wallet connection and network management. Extension packages (`walrus`, `seal`, `zksend`, `payment-kit`) add domain-specific functionality via the `$extend()` pattern.

Every `@mysten/*` package ships LLM documentation in `docs/llms-index.md` inside `node_modules/@mysten/*/`. Read the index first to find the relevant page, then read that page for details.

## When to Use

- Connecting Sui wallets in React apps (Slush, Suiet, Sui Wallet, etc.)
- Querying on-chain objects, balances, transactions via gRPC/GraphQL
- Building and executing Sui transactions (Move calls, coin operations)
- Integrating Walrus (decentralized storage), Seal (encryption), ZKSend (link-based transfers)
- Working with Move object patterns (owned, shared, wrapped, dynamic fields)
- Implementing ZKLogin, Passkey authentication flows
- Using Payment Kit for fiat-to-crypto onramps

## Quick Reference

### Client Setup

```typescript
// Recommended: gRPC client
import { SuiGrpcClient } from '@mysten/sui/grpc'

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
})

// With extensions
import { walrus } from '@mysten/walrus'
import { seal } from '@mysten/seal'

const extendedClient = client.$extend(walrus()).$extend(seal())
```

### Network URLs

| Network | gRPC URL |
|---------|----------|
| mainnet | `https://fullnode.mainnet.sui.io:443` |
| testnet | `https://fullnode.testnet.sui.io:443` |
| devnet  | `https://fullnode.devnet.sui.io:443` |

### Core API Methods

| Task | Method |
|------|--------|
| Get object | `client.core.getObject({ objectId, include: { json: true } })` |
| List owned objects | `client.core.listOwnedObjects({ owner, type, include: { json: true } })` |
| Get balance | `client.core.getBalance({ owner })` |
| List balances | `client.core.listBalances({ owner })` |
| Get transaction | `client.core.getTransaction({ digest, include: { effects: true } })` |
| List dynamic fields | `client.core.listDynamicFields({ parentId })` |
| Get multiple objects | `client.core.getObjects({ objectIds })` |

### dApp Kit React Setup

```typescript
import { createDAppKit } from '@mysten/dapp-kit-core'
import { DAppKitProvider, useDAppKit, useCurrentAccount,
  useCurrentNetwork, useCurrentClient, useWallets,
  useWalletConnection } from '@mysten/dapp-kit-react'
import { SuiGrpcClient } from '@mysten/sui/grpc'

// MUST include all 3 networks to satisfy DAppKitProvider type
const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) => new SuiGrpcClient({
    network,
    baseUrl: GRPC_URLS[network],
  }),
})

// Type registration for type-safe hooks
declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit }
}
```

### Available Hooks

| Hook | Returns |
|------|---------|
| `useDAppKit()` | dAppKit instance for actions (connect, sign, execute) |
| `useCurrentAccount()` | Connected account (address, publicKey) |
| `useCurrentClient()` | Sui client for current network |
| `useCurrentNetwork()` | Current network string |
| `useWallets()` | Array of detected wallets |
| `useWalletConnection()` | `{ isConnected, isConnecting }` |
| `useCurrentWallet()` | Current connected wallet |

### Wallet Actions (via useDAppKit)

```typescript
const dAppKit = useDAppKit()

// Connect
await dAppKit.connectWallet({ wallet })

// Disconnect
await dAppKit.disconnectWallet()

// Sign and execute transaction
const result = await dAppKit.signAndExecuteTransaction({ transaction })
const tx = result.Transaction ?? result.FailedTransaction

// Sign message
await dAppKit.signPersonalMessage({ message: new Uint8Array([...]) })

// Switch network (must cast type)
dAppKit.switchNetwork(newNetwork as 'mainnet' | 'testnet' | 'devnet')
```

### Building Transactions

```typescript
import { Transaction } from '@mysten/sui/transactions'

const tx = new Transaction()
tx.setSender(address)

// Move call
tx.moveCall({
  target: `${packageId}::module::function`,
  arguments: [tx.object(objectId), tx.pure.u64(amount)],
})

// Split and transfer coins
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)])
tx.transferObjects([coin], tx.pure.address(recipient))

// Execute
const result = await client.core.executeTransaction({
  transaction: await tx.build({ client }),
  signatures: [signature],
})
```

### Faucet (Devnet/Testnet)

```typescript
import { getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet'
import { MIST_PER_SUI } from '@mysten/sui/utils'

const result = await requestSuiFromFaucetV2({
  host: getFaucetHost('devnet'),
  recipient: address,
})
```

## Decision Guidance

| Scenario | Recommended |
|----------|-------------|
| New project | `SuiGrpcClient` (fastest, recommended) |
| Need event queries / Kiosk | `SuiJsonRpcClient` or `SuiGraphQLClient` |
| Complex queries with filtering | `SuiGraphQLClient` |
| Transport-agnostic library | Accept `ClientWithCoreApi` type |
| Wallet UI in React | `@mysten/dapp-kit-react` hooks |
| No ConnectButton component | Build custom UI with `useWallets()` + `dAppKit.connectWallet()` |
| Decentralized storage | `client.$extend(walrus())` |
| Encrypted content | `client.$extend(seal())` |
| Link-based transfers | `client.$extend(zksend())` |

## Common Gotchas

- `ConnectButton` does NOT exist in `@mysten/dapp-kit-react` — it's a web component from `@mysten/dapp-kit-core/web`. Build custom connect UI instead.
- `createDAppKit` MUST include all 3 networks (`mainnet`, `testnet`, `devnet`) or `DAppKitProvider` will throw TS2322.
- `switchNetwork()` expects literal union type, not `string` — cast with `as 'mainnet' | 'testnet' | 'devnet'`.
- All `@mysten/*` packages are ESM only — project needs `"type": "module"` in package.json.
- Client constructors require explicit `network` parameter in v2.
- Transaction results are union type — unwrap with `result.Transaction ?? result.FailedTransaction`.
- `client.core.*` is the namespace for all query methods (not `client.getObject()` directly).
- Kiosk extension does NOT work with `SuiGrpcClient` — use `SuiJsonRpcClient` or `SuiGraphQLClient`.
- Each plugin/component using dApp Kit should create its own `createDAppKit()` instance.
- `MIST_PER_SUI` is a BigInt — use `Number()` conversion for display.

## LLM Documentation

For detailed API docs, read the index files in node_modules:

```
node_modules/@mysten/sui/docs/llms-index.md
node_modules/@mysten/dapp-kit-react/docs/llms-index.md
node_modules/@mysten/dapp-kit-core/docs/llms-index.md
node_modules/@mysten/walrus/docs/llms-index.md
node_modules/@mysten/seal/docs/llms-index.md
node_modules/@mysten/zksend/docs/llms-index.md
node_modules/@mysten/payment-kit/docs/llms-index.md
node_modules/@mysten/bcs/docs/llms-index.md
```

Read the index first, then navigate to the specific page you need.

## Verification Checklist

- [ ] `createDAppKit` includes all 3 networks
- [ ] `network` parameter set on all client constructors
- [ ] Transaction results unwrapped with `result.Transaction ?? result.FailedTransaction`
- [ ] No direct `client.getObject()` calls — use `client.core.getObject()`
- [ ] Wallet connect UI built manually (no `ConnectButton` import)
- [ ] `switchNetwork` uses type cast
- [ ] Extensions added via `$extend()` pattern
- [ ] Cleanup in `unmount()` for subscriptions/intervals
