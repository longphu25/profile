# Sui TypeScript SDK — Technical Reference (`@mysten/sui` 2.18.0)

> Implementation reference for the core Sui SDK as used in this project. Every API
> signature below was verified against the installed `node_modules/@mysten/sui@2.18.0`
> source, not from memory. Read [Caveats](#caveats) before relying on exact paths.
>
> Companion deep-research note: [[research/mysten-sdk-update-2026-06]].
> Pricing/devInspect specifics: [[deepbook/predict-club-devinspect-pricing]].

This is the foundation every SUI integration in the repo sits on: pick a client, build
a PTB, scale units, run a read-only pre-flight, sign. The predict-club gateway
(`plugins/predict-club/infrastructure/suiPredictGateway.ts`) is the reference
implementation.

---

## Subpath exports

The SDK ships as subpath exports — import from the specific path, never the package root.

```ts
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'   // JSON-RPC client
import { SuiGrpcClient }    from '@mysten/sui/grpc'      // gRPC client (newer transport)
import { Transaction, coinWithBalance } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import {
  parseToUnits, parseToMist, MIST_PER_SUI, SUI_DECIMALS,
  SUI_CLOCK_OBJECT_ID, normalizeSuiObjectId, isValidSuiAddress,
} from '@mysten/sui/utils'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
```

Available exports: `bcs`, `client`, `cryptography`, `faucet`, `graphql`, `grpc`,
`jsonRpc`, `keypairs/{ed25519,secp256k1,secp256r1,passkey}`, `multisig`, `transactions`,
`utils`, `verify`, `zklogin`.

---

## Choosing a client

There are two production clients. **This is the most common decision point.**

| Client | Import | When |
|---|---|---|
| `SuiJsonRpcClient` | `@mysten/sui/jsonRpc` | Stable JSON-RPC fullnode. Has `devInspectTransactionBlock`, `getDynamicFields`, `getObject`, `getCoins`, `getBalance`. The predict gateway + pricing service use this. |
| `SuiGrpcClient` | `@mysten/sui/grpc` | Newer gRPC transport. Has `simulateTransaction` (the modern dry-run with `include`-controlled `commandResults`). The funding gateway uses this. |

> **Naming:** the legacy monolithic `SuiClient` from `@mysten/sui/client` still exists for
> back-compat but the project uses the explicit `SuiJsonRpcClient` / `SuiGrpcClient` names.
> Do not regress to bare `SuiClient`.

```ts
// JSON-RPC (this project's predict-club gateway)
const client = new SuiJsonRpcClient({ url: TESTNET_RPC_URL, network: 'testnet' })

// gRPC (this project's funding gateway)
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: RPC_URL })
```

`getJsonRpcFullnodeUrl('testnet')` (from `@mysten/sui/client`) returns the public
fullnode URL if you don't pin your own.

---

## Building transactions (PTBs)

A `Transaction` is a programmable transaction block: a sequence of commands where each
command's result can feed the next.

```ts
const tx = new Transaction()
tx.setSender(walletAddress)        // required for devInspect / coin sourcing

const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountRaw)])
tx.moveCall({
  target: `${PKG}::module::function`,
  typeArguments: [COIN_TYPE],
  arguments: [tx.object(objectId), coin, tx.pure.u64(value), tx.object.clock()],
})
```

### Argument helpers

| Helper | Use |
|---|---|
| `tx.pure.u64(n)`, `tx.pure.id(addr)`, `tx.pure.address(a)`, `tx.pure.bool(b)` | Pure (BCS-encoded) values |
| `tx.object(id)` | Reference an on-chain object by ID |
| `tx.object.clock()` | The shared `0x6` Clock — shorthand for `tx.object(SUI_CLOCK_OBJECT_ID)` |
| `tx.gas` | The gas coin (for splitting native SUI) |
| `tx.moveCall({ target, typeArguments, arguments })` | Call a Move entry/public function |
| `tx.splitCoins(coin, [amounts])` | Split a coin into new coins |
| `tx.mergeCoins(primary, [coins])` | Merge coins into one |

### `coinWithBalance` intent — drop manual coin selection

**Verified signature (2.18.0):**

```ts
declare function coinWithBalance({
  type,           // string? — coin type; omit for native SUI
  balance,        // bigint | number — amount in base units
  useGasCoin,     // boolean? — allow drawing from the gas coin
}): (tx: Transaction) => TransactionResult
```

This replaces the hand-rolled "fetch coins → merge → split" dance. The intent resolves at
build time: it sources from the address balance when available, falling back to owned
coins, merging and splitting as needed.

```ts
import { coinWithBalance } from '@mysten/sui/transactions'

// Instead of fetchDusdcCoins() + mergeCoins() + splitCoins():
const depositCoin = tx.add(coinWithBalance({ type: DUSDC_TYPE, balance: amountRaw }))
tx.moveCall({
  target: `${PKG}::predict_manager::deposit`,
  typeArguments: [DUSDC_TYPE],
  arguments: [tx.object(managerId), depositCoin],
})
```

`tx.coin({ type, balance, useGasCoin })` and `tx.balance({ type, balance, useGasCoin })`
are method forms on the `Transaction` instance (same signature shape) — `coin` yields a
`Coin<T>`, `balance` yields a `Balance<T>`.

> **In this repo:** `suiPredictGateway.ts` still uses the manual
> `fetchDusdcCoins` + `mergeDusdcAndSplit` (lines ~118-140, ~219-225, ~327-333). That
> predates the intent and is a candidate to replace — same resulting PTB, less surface
> for a `coins[0]` empty-array crash.

---

## Unit scaling — never use float math

On-chain amounts are base-unit integers (`u64`). Converting a human amount must use
**bigint arithmetic**, not JS floats. `0.07 * 1e6` can land at `69999.99…`; truncating
that silently underpays.

**Verified signatures (2.16.0+, present in 2.18.0):**

```ts
declare function parseToUnits(amount: string, decimals: number): bigint
declare function parseToMist(amount: string): bigint   // decimals = 9 (SUI)
```

```ts
import { parseToUnits, parseToMist } from '@mysten/sui/utils'

const dusdcRaw = parseToUnits('0.07', 6)   // → 70000n, exact
const suiRaw   = parseToMist('1.5')        // → 1500000000n
```

> **In this repo:** `suiPredictGateway.ts:217,324` and `walletBalanceService.ts:35,37`
> still scale with `Math.floor(amount * 10 ** decimals)` / `raw / 10 ** decimals`. These
> are real correctness risks on the money path and should move to `parseToUnits`. Note
> `parseToUnits` takes a **string** — pass the raw input string, don't pre-convert to a
> `number` (that reintroduces the float error you're trying to avoid).

Useful constants from `@mysten/sui/utils`: `MIST_PER_SUI`, `SUI_DECIMALS` (9),
`SUI_CLOCK_OBJECT_ID` (`0x6`), `SUI_TYPE_ARG`, `SUI_FRAMEWORK_ADDRESS`.

---

## Read-only pre-flight (devInspect / simulate)

The single most valuable pattern for a trading UI: **run the real PTB read-only before
asking the user to sign.** Zero gas, no wallet prompt, and the contract trips the same
guards a live execution would.

### JSON-RPC: `devInspectTransactionBlock`

This is what the predict gateway uses for both mint and claim pre-flight.

```ts
const inspected = await client.devInspectTransactionBlock({
  sender: walletAddress,
  transactionBlock: tx,
})
if (inspected.error) {
  // contract aborted — map to a friendly reason, do NOT sign
  return { ok: false, reason: sanitizeError(inspected.error) }
}
return { ok: true }
```

**The trust property:** build the PTB through a single `compose*Tx` function that both the
real path (`build*Tx` → sign) and the pre-flight (`simulate*` → devInspect) call. The
simulated transaction is then byte-for-byte the one the wallet signs — only
devInspect-vs-execute differs. See `composeClaimTx` / `composeBinaryMintTx` in
`suiPredictGateway.ts` for the reference shape.

### gRPC: `simulateTransaction` (the modern path)

For `SuiGrpcClient`, the dry-run is `simulateTransaction` with an `include` parameter:

```ts
const result = await client.simulateTransaction({
  transaction: tx,
  include: { effects: true, balanceChanges: true, commandResults: true },
})
if (result.$kind === 'FailedTransaction') { /* aborted */ }
// commandResults (returnValues + mutatedReferences as BCS bytes) is simulation-only —
// it does NOT exist on executeTransaction. Decode returnValues with bcs to read a
// Move function's output (e.g. a quote) without spending gas.
```

`commandResults` is unique to simulation. Use it to read a `view`-style Move function's
return value (decode the BCS bytes) — this is how a contract-priced quote is read without
an on-chain write.

### 2.16.3 simulate-only `ValidDuring` fix

PTBs whose only inputs are shared objects or pure args (common here — a quote read touches
only the shared oracle/registry) used to fail gas-budget simulation with
*"Transactions must either have address-owned inputs, or a ValidDuring expiration"*. As of
2.16.3 the resolver auto-injects a simulate-only `ValidDuring` expiration when it computes
the gas budget and none is set — scoped to the simulate request, the final signed tx is
unchanged. You no longer need to set a dummy expiration to dry-run a read-only PTB.

---

## Signing & execution

In the dApp (browser) the project does **not** hold keys — it builds the `tx` and hands it
to the wallet via the host bridge (`host.signAndExecuteTransaction(tx)`), which routes
through dApp Kit. See [[deepbook/predict-club-data-contract]] and the dapp-kit section of
[[research/mysten-sdk-update-2026-06]].

For server/script signing with a local keypair:

```ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
const keypair = Ed25519Keypair.fromSecretKey(secret)
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true, showObjectChanges: true },
})
```

---

## Reading on-chain state

```ts
// Single object
const obj = await client.getObject({ id, options: { showContent: true } })

// Dynamic fields (how PredictManager positions are enumerated — see pricing service)
const { data, nextCursor, hasNextPage } =
  await client.getDynamicFields({ parentId, cursor })

// Coins of a type owned by an address
const { data } = await client.getCoins({ owner, coinType: DUSDC_TYPE })

// Aggregate balance
const bal = await client.getBalance({ owner, coinType: PLP_TYPE })
```

Paginate dynamic fields with the `cursor` / `hasNextPage` loop — a manager with many
positions spans multiple pages. The predict pricing service
(`deepbookPredictPricingService.ts`) wraps this in `fetchManagerSnapshot`.

---

## BCS encode/decode

`@mysten/sui/bcs` decodes Move return values (from `devInspect` / `simulateTransaction`)
and encodes complex pure arguments.

```ts
import { bcs } from '@mysten/sui/bcs'

// Decode a u64 returned by a view function in devInspect results
const [bytes] = inspected.results![0].returnValues![0]
const value = bcs.u64().parse(Uint8Array.from(bytes))
```

---

## Caveats

- **Version pin.** Signatures verified against `@mysten/sui@2.18.0` as installed. The SDK
  moves fast; re-check `node_modules` types before depending on an exact shape.
- **`commandResults` is gRPC-only.** It lives on `SuiGrpcClient.simulateTransaction`, not
  on `SuiJsonRpcClient.devInspectTransactionBlock` (which returns `results` /
  `returnValues` in the JSON-RPC shape). Decode pattern differs between the two clients.
- **`parseToUnits` takes a string.** Passing a pre-divided `number` reintroduces float
  error. Thread the original input string through.
- **Pre-flight is not a guarantee.** devInspect runs against current chain state; state
  can change between pre-flight and signing. It catches the common doomed-tx cases (bad
  strike, unsettled claim, lost position), not a race at the boundary.

## Open questions

1. Does this project's `SuiJsonRpcClient` devInspect path want to migrate to
   `SuiGrpcClient.simulateTransaction` for the quote read, to use `commandResults`
   directly instead of the JSON-RPC `returnValues` shape?
2. Is there a case in the claim/mint pre-flight where the 2.16.3 simulate-only
   `ValidDuring` override does **not** cover a payment-less PTB and an explicit expiration
   is still needed?

## Sources

- Installed `node_modules/@mysten/sui@2.18.0` type declarations (`transactions`, `utils`,
  `jsonRpc`, `grpc`, `bcs` subpaths) — primary, verified in-repo.
- [Sui SDK — Transaction basics](https://sdk.mystenlabs.com/sui/transactions/basics)
- [Sui SDK — Signing & execution](https://sdk.mystenlabs.com/sui/transactions/signing-and-execution)
- [Sui SDK — gRPC](https://sdk.mystenlabs.com/sui/grpc)
- [ts-sdks CHANGELOG (`packages/typescript`)](https://github.com/MystenLabs/ts-sdks/blob/main/packages/typescript/CHANGELOG.md)
