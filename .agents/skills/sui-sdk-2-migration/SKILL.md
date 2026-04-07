---
name: Sui TypeScript SDK 2.0 Migration
description: Use when working with @mysten/* packages (sui, dapp-kit, kiosk, zksend, suins, deepbook-v3, walrus, seal). This skill covers all breaking changes and migration patterns for the Sui TypeScript SDK 2.0 release including ESM migration, new client APIs (gRPC, GraphQL, JSON-RPC), BCS schema changes, client extensions, dApp Kit rewrite, and package-specific migrations.
metadata:
    source: https://sdk.mystenlabs.com/sui/migrations/sui-2.0
    version: "2.0"
---

# Sui TypeScript SDK 2.0 Migration Reference

Source: [https://sdk.mystenlabs.com/sui/migrations/sui-2.0](https://sdk.mystenlabs.com/sui/migrations/sui-2.0)

## When to use

- Migrating any `@mysten/*` package to v2.0
- Creating new projects using `@mysten/sui`, `@mysten/dapp-kit-react`, or any Sui SDK
- Working with Sui blockchain clients (gRPC, GraphQL, JSON-RPC)
- Building dApps, wallets, or SDKs on Sui
- Using client extensions (`$extend`) pattern
- Working with transactions, BCS schemas, zkLogin, or GraphQL on Sui

## ESM Migration (All Packages)

All `@mysten/*` packages are now ESM only.

**package.json:**
```json
{
  "type": "module"
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext",
    "module": "NodeNext"
  }
}
```

This enables proper resolution of subpath exports (e.g., `@mysten/sui/client`, `@mysten/sui/transactions`).

## Client Migration (@mysten/sui)

### SuiClient → SuiJsonRpcClient

The `@mysten/sui/client` export path has been removed. JSON-RPC functionality is now in `@mysten/sui/jsonRpc`.

```ts
// OLD
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// NEW (JSON-RPC)
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('mainnet'),
  network: 'mainnet', // Required
});
```

### Recommended: Use gRPC

```ts
import { SuiGrpcClient } from '@mysten/sui/grpc';
const client = new SuiGrpcClient({
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
  network: 'mainnet', // Required
});
```

### GraphQL Client

```ts
import { SuiGraphQLClient } from '@mysten/sui/graphql';
const client = new SuiGraphQLClient({
  url: 'https://sui-mainnet.mystenlabs.com/graphql',
  network: 'mainnet', // Required
});
```

### Network Parameter Required

All client constructors now require an explicit `network` parameter.

### ClientWithCoreApi Interface

Many SDK methods now accept any client implementing `ClientWithCoreApi`, enabling use with JSON-RPC, GraphQL, or gRPC transports interchangeably.

### Removed Exports from `@mysten/sui/client`

| Old | New (from `@mysten/sui/jsonRpc`) |
|-----|------|
| `SuiClient` | `SuiJsonRpcClient` |
| `SuiClientOptions` | `SuiJsonRpcClientOptions` |
| `isSuiClient` | `isSuiJsonRpcClient` |
| `SuiTransport` | `JsonRpcTransport` |
| `SuiHTTPTransport` | `JsonRpcHTTPTransport` |
| `getFullnodeUrl` | `getJsonRpcFullnodeUrl` |


## BCS Schema Changes

### ExecutionStatus

BCS Schema: variant renamed from `Failed` to `Failure`:
```ts
// OLD
effects.status.Failed.error
// NEW
effects.status.Failure.error
```

Core API (gRPC/GraphQL) uses simplified structure:
```ts
const result = await client.core.getTransaction({ digest, include: { effects: true } });
const tx = result.Transaction ?? result.FailedTransaction;
if (tx.effects.status.success) { /* succeeded */ }
else { const error = tx.effects.status.error; }
```

### Object BCS Schema Changes

```ts
// Owner enum variant renamed
// OLD: ConsensusV2: { owner: addr, startVersion: 1 }
// NEW: ConsensusAddressOwner: { startVersion: 1, owner: addr }

// Data enum variant renamed
// OLD: MoveObject: { ... }
// NEW: Move: { ... }

// Schema export renamed
// OLD
import { ObjectBcs } from '@mysten/sui/bcs';
const bytes = ObjectBcs.serialize(obj);
// NEW
import { bcs } from '@mysten/sui/bcs';
const bytes = bcs.Object.serialize(obj);
```

### UnchangedSharedKind → UnchangedConsensusKind

```ts
// OLD: effects.unchangedSharedObjects
// NEW: effects.unchangedConsensusObjects
```

Removed variants: `MutateDeleted`, `ReadDeleted`
New variants: `MutateConsensusStreamEnded`, `ReadConsensusStreamEnded`, `Cancelled`, `PerEpochConfig`

## Experimental Client API Stabilized

Moved from `@mysten/sui/experimental` to `@mysten/sui/client`. All `Experimental_` prefixes removed.

```ts
// OLD
import { Experimental_BaseClient, Experimental_CoreClient, type Experimental_SuiClientTypes } from '@mysten/sui/experimental';

// NEW
import { BaseClient, CoreClient, type SuiClientTypes } from '@mysten/sui/client';
```

| Old | New |
|-----|-----|
| `Experimental_BaseClient` | `BaseClient` |
| `Experimental_CoreClient` | `CoreClient` |
| `Experimental_SuiClientTypes` | `SuiClientTypes` |
| `Experimental_CoreClientOptions` | `CoreClientOptions` |

## Transaction Changes

### Commands → TransactionCommands

```ts
// OLD
import { Commands } from '@mysten/sui/transactions';
const coin = tx.add(Commands.SplitCoins(tx.gas, [tx.pure.u64(100)]));

// NEW
import { TransactionCommands } from '@mysten/sui/transactions';
const coin = tx.add(TransactionCommands.SplitCoins(tx.gas, [tx.pure.u64(100)]));
```

### Transaction Executors

Constructor `client` parameter type changed from `SuiJsonRpcClient` to `ClientWithCoreApi`. Works with any client.

```ts
const result = await executor.executeTransaction(tx);
// OLD: result.data.effects?.status.status
// NEW:
const tx = result.Transaction ?? result.FailedTransaction;
tx.effects.status.success; // boolean

// Include options changed:
// OLD: { showEffects: true, showEvents: true }
// NEW: { effects: true, events: true }
```

### Default Transaction Expiration

Transactions now default expiration to current epoch + 1 using `ValidDuring`. To disable:
```ts
const tx = new Transaction();
tx.setExpiration({ None: true });
```

### Named Packages Plugin Removed

MVR resolution is now built into the core client. No more global plugin registration.

```ts
// OLD
import { Transaction, namedPackagesPlugin } from '@mysten/sui/transactions';
Transaction.registerGlobalSerializationPlugin('namedPackages', namedPackagesPlugin({ url: '...' }));

// NEW - automatic, configure via client
const client = new SuiJsonRpcClient({
  url: '...',
  network: 'mainnet',
  mvr: { overrides: myOverrides },
});
```

## GraphQL Schema

Single unified schema instead of multiple versioned schemas:

```ts
// OLD
import { graphql } from '@mysten/sui/graphql/schemas/latest';
import { graphql } from '@mysten/sui/graphql/schemas/2024.4';

// NEW
import { graphql } from '@mysten/sui/graphql/schema';
```

## zkLogin Changes

`legacyAddress` parameter is now required:

```ts
// OLD → NEW
computeZkLoginAddressFromSeed(seed, iss)        → computeZkLoginAddressFromSeed(seed, iss, true)
jwtToAddress(jwt, userSalt)                      → jwtToAddress(jwt, userSalt, false)
computeZkLoginAddress({ ...opts })               → computeZkLoginAddress({ ...opts, legacyAddress: false })
toZkLoginPublicIdentifier(addressSeed, iss)      → toZkLoginPublicIdentifier(addressSeed, iss, { legacyAddress: false })
```

## dApp Kit Migration (@mysten/dapp-kit → @mysten/dapp-kit-react)

The legacy `@mysten/dapp-kit` only supports JSON-RPC and will not receive further updates. Migrate to `@mysten/dapp-kit-react`.

### Install

```bash
npm uninstall @mysten/dapp-kit
npm i @mysten/dapp-kit-react @mysten/dapp-kit-core @mysten/sui
```

### Create dApp Kit Instance

```ts
// dapp-kit.ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
};

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient(network) {
    return new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] });
  },
});

// Required for type-safe hooks
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
```

### Replace Provider Setup

```tsx
// OLD
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
<SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
  <WalletProvider><App /></WalletProvider>
</SuiClientProvider>

// NEW
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from './dapp-kit.ts';
<DAppKitProvider dAppKit={dAppKit}>
  <App />
</DAppKitProvider>
```

### Hook Changes

Available hooks in new version:
- `useDAppKit()` - Access dAppKit instance for calling actions
- `useCurrentClient()` - Get blockchain client (renamed from `useSuiClient`)
- `useCurrentAccount()` - Get current connected account
- `useCurrentWallet()` - Get current connected wallet
- `useWallets()` - Get list of available wallets
- `useWalletConnection()` - Get wallet connection status
- `useCurrentNetwork()` - Get current network

### Removed Hooks → Direct Actions

All wallet action hooks replaced with `useDAppKit()` direct calls:

| Old Hook | New |
|----------|-----|
| `useConnectWallet` | `dAppKit.connectWallet()` |
| `useDisconnectWallet` | `dAppKit.disconnectWallet()` |
| `useSignTransaction` | `dAppKit.signTransaction()` |
| `useSignAndExecuteTransaction` | `dAppKit.signAndExecuteTransaction()` |
| `useSignPersonalMessage` | `dAppKit.signPersonalMessage()` |
| `useSwitchAccount` | `dAppKit.switchAccount()` |

### Data Fetching (No Built-in Hooks)

```ts
// OLD
import { useSuiClientQuery } from '@mysten/dapp-kit';
const { data } = useSuiClientQuery('getObject', { id: objectId });

// NEW - use TanStack Query
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
const client = useCurrentClient();
const { data } = useQuery({
  queryKey: ['object', objectId],
  queryFn: () => client.core.getObject({ objectId }),
});
```

### Mutation Pattern

```ts
// OLD
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

// NEW - direct promise-based
import { useDAppKit } from '@mysten/dapp-kit-react';
const dAppKit = useDAppKit();
const result = await dAppKit.signAndExecuteTransaction({ transaction });

// Or with TanStack Query
import { useMutation } from '@tanstack/react-query';
const { mutateAsync } = useMutation({
  mutationFn: (tx: Transaction) => dAppKit.signAndExecuteTransaction({ transaction: tx }),
});
```

### chain → network

```ts
// OLD
await signAndExecute({ transaction, chain: 'sui:mainnet' });
// NEW
await dAppKit.signAndExecuteTransaction({ transaction, network: 'mainnet' });
```

### CSS Removed

```ts
// Remove this import - no longer needed
// import '@mysten/dapp-kit/dist/full/index.css';
```

New dApp Kit uses web components with built-in styling. Customize via CSS custom properties:
```css
:root {
  --primary: #4f46e5;
  --primary-foreground: #ffffff;
  --background: #ffffff;
  --foreground: #0f172a;
  --border: #e2e8f0;
  --radius: 0.5rem;
}
```

## Client Extensions Pattern (All Extension Packages)

All `@mysten/*` extension packages now export a client extension function used with `$extend()`.

### @mysten/kiosk

> Note: Kiosk requires `SuiJsonRpcClient` or `SuiGraphQLClient`. Does NOT work with `SuiGrpcClient`.

```ts
// OLD
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { KioskClient, Network } from '@mysten/kiosk';
const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });
const kioskClient = new KioskClient({ client: suiClient, network: Network.MAINNET });
const ownedKiosks = await kioskClient.getOwnedKiosks({ address });

// NEW
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk } from '@mysten/kiosk';
const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('mainnet'),
  network: 'mainnet',
}).$extend(kiosk());
const ownedKiosks = await client.kiosk.getOwnedKiosks({ address });
```

`transactionBlock` parameter renamed to `transaction` in `KioskTransaction` and `TransferPolicyTransaction`.

Low-level helper functions removed — use `KioskTransaction` builder class instead:
- `createKiosk` → `kioskTx.create()`
- `shareKiosk` → `kioskTx.share()`
- `place` → `kioskTx.place()`
- `lock` → `kioskTx.lock()`
- `take` → `kioskTx.take()`
- `list` → `kioskTx.list()`
- `purchase` → `kioskTx.purchase()`
- `placeAndList` → `kioskTx.placeAndList()`

### @mysten/zksend

```ts
// OLD
import { ZkSendLinkBuilder, ZkSendLink } from '@mysten/zksend';

// NEW
import { zksend } from '@mysten/zksend';
const client = new SuiGrpcClient({ baseUrl, network: 'testnet' }).$extend(zksend());

// Create link
const linkBuilder = client.zksend.linkBuilder({ sender: myAddress });
linkBuilder.addSui(1_000_000_000n);
const { tx, link } = await linkBuilder.build();

// Load link
const existingLink = await client.zksend.loadLinkFromUrl(linkUrl);
```

Removed: non-contract links, `isContractLink`, `calculateGas`, `getAssetsFromTransaction`, `isOwner`, `ownedAfterChange`.

### @mysten/suins

```ts
// OLD
import { SuinsClient } from '@mysten/suins';
const suinsClient = new SuinsClient({ client: suiClient, network: 'mainnet' });
const nameRecord = await suinsClient.getNameRecord('example.sui');

// NEW
import { suins } from '@mysten/suins';
const client = new SuiGrpcClient({ baseUrl, network: 'mainnet' }).$extend(suins());
const nameRecord = await client.suins.getNameRecord('example.sui');
```

### @mysten/deepbook-v3

```ts
// OLD
import { DeepBookClient } from '@mysten/deepbook-v3';
const deepBookClient = new DeepBookClient({ client: suiClient, address, env: 'mainnet', balanceManagers: { ... } });

// NEW
import { deepbook } from '@mysten/deepbook-v3';
const client = new SuiGrpcClient({ baseUrl, network: 'mainnet' }).$extend(
  deepbook({ address: myAddress, balanceManagers: { ... } })
);
await client.deepbook.checkManagerBalance(manager, asset);
```

### @mysten/walrus

```ts
// OLD
import { WalrusClient } from '@mysten/walrus';
const walrusClient = new WalrusClient({ suiRpcUrl: '...', network: 'testnet' });

// NEW
import { walrus } from '@mysten/walrus';
const client = new SuiGrpcClient({ baseUrl, network: 'testnet' }).$extend(walrus());
await client.walrus.getBlob(blobId);
```

Network is now inferred from the client. `WalrusClient.experimental_asClientExtension()` removed.

### @mysten/seal

```ts
// OLD
import { SealClient } from '@mysten/seal';
const client = suiClient.$extend(SealClient.asClientExtension());

// NEW
import { seal } from '@mysten/seal';
const client = suiClient.$extend(seal());
```

## SDK Maintainers Guide

### Accept ClientWithCoreApi

```ts
// OLD
import { SuiClient } from '@mysten/sui/client';
export class MySDKClient { client: SuiClient; }

// NEW
import type { ClientWithCoreApi } from '@mysten/sui/client';
export class MySDKClient { client: ClientWithCoreApi; }
```

### Core API Method Renames

| v1.x | v2.0 |
|------|------|
| `client.getObject()` | `client.core.getObject()` |
| `client.getOwnedObjects()` | `client.core.listOwnedObjects()` |
| `client.getDynamicFieldObject()` | `client.core.getDynamicField()` |
| `client.getDynamicFields()` | `client.core.listDynamicFields()` |
| `client.multiGetObjects()` | `client.core.getObjects()` |

### Peer Dependencies

```json
{
  "peerDependencies": { "@mysten/sui": "^2.0.0" },
  "devDependencies": { "@mysten/sui": "^2.0.0" }
}
```

### Client Extension Pattern

```ts
import type { ClientWithCoreApi } from '@mysten/sui/client';

export function mySDK() {
  return {
    name: 'mySDK',
    register: (client: ClientWithCoreApi) => new MySDKClient({ client }),
  };
}

// Usage
const client = new SuiGrpcClient({ ... }).$extend(mySDK());
await client.mySDK.doSomething();
```

## Wallet Builders Guide

### reportTransactionEffects Removed

Remove `sui:reportTransactionEffects` feature from wallet implementations.

### New signAndExecuteTransaction Pattern

```ts
#signAndExecuteTransaction = async ({ transaction, signal }) => {
  const parsedTransaction = Transaction.from(await transaction.toJSON());
  const bytes = await parsedTransaction.build({ client });
  const result = await this.#keypair.signAndExecuteTransaction({
    transaction: parsedTransaction,
    client,
  });
  const tx = result.Transaction ?? result.FailedTransaction;
  return {
    bytes: toBase64(bytes),
    signature: tx.signatures[0],
    digest: tx.digest,
    effects: toBase64(tx.effects.bcs!),
  };
};
```

Key changes:
- Use `signer.signAndExecuteTransaction()` instead of `suiClient.executeTransactionBlock()`
- Response is a union type — unwrap with `result.Transaction ?? result.FailedTransaction`
- BCS effects are in `tx.effects.bcs` (Uint8Array) instead of `rawEffects` (number array)

## Quick Decision Guide

| Scenario | Recommended Client |
|----------|-------------------|
| New project | `SuiGrpcClient` |
| Migrating existing JSON-RPC | `SuiJsonRpcClient` (then migrate to gRPC) |
| Need event queries (Kiosk) | `SuiJsonRpcClient` or `SuiGraphQLClient` |
| Complex queries | `SuiGraphQLClient` |
| Transport-agnostic SDK | Accept `ClientWithCoreApi` |

## Resources

- [Migration Overview](https://sdk.mystenlabs.com/sui/migrations/sui-2.0)
- [@mysten/sui Migration](https://sdk.mystenlabs.com/sui/migrations/sui-2.0/sui)
- [@mysten/dapp-kit Migration](https://sdk.mystenlabs.com/sui/migrations/sui-2.0/dapp-kit)
- [@mysten/kiosk Migration](https://sdk.mystenlabs.com/sui/migrations/sui-2.0/kiosk)
- [SDK Maintainers Guide](https://sdk.mystenlabs.com/sui/migrations/sui-2.0/sdk-maintainers)
- [Wallet Builders Guide](https://sdk.mystenlabs.com/sui/migrations/sui-2.0/wallet-builders)

---

> Content was rephrased for compliance with licensing restrictions. Source: [sdk.mystenlabs.com](https://sdk.mystenlabs.com/sui/migrations/sui-2.0)
