# Research: zkLogin session keys & object-centric vs account-based order books on Sui

> Deep-research report (2026). 16 primary sources, 25 claims adversarially verified
> (3-vote), all confirmed 3-0. Confidence uniformly high. See Caveats before coding
> against exact endpoint paths or SDK method names.

Two parts:
- **Part A** zkLogin session key management in production Sui dApps.
- **Part B** Sui Move object-centric storage vs account/ledger models for on-chain order books (CLOBs).

---

## Part A: zkLogin session key management

### Session lifecycle

A session starts by generating a fresh ephemeral Ed25519 key pair. Its public key, a
`max_epoch` expiry, and a `jwt_randomness` value are committed into the OAuth `nonce`
via a Poseidon BN254 hash. Because the OAuth provider then signs a JWT containing that
nonce, the provider-signed JWT is cryptographically bound to that exact ephemeral key
for that exact expiry window. [1]

```
nonce = Poseidon_BN254(eph_pk, max_epoch, jwt_randomness)

// dapp-kit / zkLogin SDK
const maxEpoch = Number(epoch) + 2
generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness)
```

### Expiry is epoch-based, not a wall-clock timer

`max_epoch` is a `u64` set at session creation, typically current epoch + 2 (a
documented example, not a hard rule). One ZK proof derived from the JWT is cached and
reused for every transaction in the session until the chain's current epoch crosses
`max_epoch`. After that, both the proof and the ephemeral key are invalid. [2]

### No incremental key rotation

There is no key rotation primitive. A single proof signs all transactions; it is only
regenerated when the ephemeral key expires. Extending a session requires a full fresh
cycle: new ephemeral key, new nonce, new OAuth login, new JWT, new proof. There is no
built-in silent refresh token.

Losing the ephemeral key does not lose funds. Re-authenticating restores control,
because the zkLogin address derives from `salt + JWT claims`, not the ephemeral key. [3]

### Secure storage of ephemeral keys

Official guidance: store the ephemeral key pair and the ZK proof in browser
`sessionStorage`, not `localStorage`. `sessionStorage` clears when the browser session
ends, bounding the exposure window. Treat the ephemeral key as a secret on par with a
wallet private key. [4]

Note for this repo: a `localStorage` position-hint (such as the studio minted-marker)
is fine because it holds no secret, but the ephemeral key and proof must never go there.

### Why a leaked credential is not game over

zkLogin is a 2-of-2 multisig: the OAuth credential and the per-user salt.
- Compromised OAuth account alone cannot access the address (salt missing).
- Leaked JWT alone does not lose funds (still need the ephemeral private key + valid proof).
- The salt decouples OAuth identity from the fund-holding address. [5]

### Enoki (production infra path)

Enoki productizes two things you would otherwise build:

1. **Per-app salt management.** Enoki derives the address with a per-app salt, so the
   same user gets different Sui addresses across different Enoki-powered apps. [7]

2. **Sponsored transactions.** Users transact with zero SUI (dApp pays gas), via a
   strict 4-step flow: [6]

```
1. Client builds tx-kind-only bytes:  build({ onlyTransactionKind: true })
2. Backend -> POST /v1/transaction-blocks/sponsor   (header: zklogin-jwt)
                                     -> returns { bytes, digest }
3. Client signs the returned bytes
4. Backend -> POST /v1/transaction-blocks/sponsor/:digest   (the signature)
```

Sponsorship requires private API keys that must stay backend-only, and is bounded by
builder-configured `allowedMoveCallTargets` / `allowedAddresses` allowlists. So "fully
sponsor all transactions" really means "all transactions matching your allowlist." [6]

---

## Part B: object-centric vs account/ledger order books

### Core tradeoff: ownership decides parallelism

| Aspect | Address-owned objects | Shared objects |
|---|---|---|
| Access | Single owner | Any address |
| Sequencing | Consensus-free fastpath (validator quorum directly) | Must go through consensus (Mysticeti) |
| Parallelism | Parallel when uncontended | Serialized per object |
| Order-book role | Per-user balances, receipts | The order book itself |

The central fact of CLOB design on Sui: a single shared-object order book is the
fundamental contention bottleneck, because every order mutating it must be sequenced
through consensus. You cannot parallelize writes to one shared book. [8]

This is the key difference from an account/ledger model: on an account-based chain,
every order touches a global ledger and contention is implicit and total. Sui's object
model lets you partition what must be shared from what can be owned and parallel, but
only if you design for it.

### Dynamic fields escape object-size limits

Sui objects have an upper bound on size when they wrap other objects, so you cannot
stuff an entire book into one struct. Dynamic fields attach to an object's `UID` and
only incur gas when accessed, letting you build sparse, unboundedly large collections
(like a book) without paying for untouched entries. [9]

```move
// gas charged only on the entries you actually touch
dynamic_field::borrow_mut(&mut book.id, price_key)
```

### DeepBook v3 reference design

DeepBook v3 is the canonical answer and worth copying structurally. It revolves around
three shared objects: [10]

- **`Pool`** one market plus its order book.
- **`PoolRegistry`** dedup (prevents duplicate pools) plus package versioning at creation.
- **`BalanceManager`** a single funds source reusable across all pools, so a trader's
  capital is not fragmented per-market.

Orders (bids/asks) live in a `BigVector`, an on-chain B+ Tree with near-constant-time
ops (`log base max_fan_out`), whose nodes are stored as dynamic fields. That is the
size-limit and gas escape applied directly to the book. [10]

Settlement uses an explicit settled/owed accounting model: every transaction resets the
user's settled and owed balances, reconciled by the Vault against the BalanceManager per
asset in `(base, quote, DEEP)` format. This is the account/ledger idea reintroduced
inside the object model, not as a global ledger but as per-transaction reconciliation. [10]

### Implications for predict-club

Predict markets here mint individual owned positions (Quick Predict / studio mint)
rather than matching against a shared book, which is the good path for parallelism:
owned-object mints take the fastpath and parallelize naturally. If a true CLOB is ever
added (matching engine, resting orders), the DeepBook v3 shape is the blueprint: shared
`Pool` per market, a `BalanceManager`-style funds object reusable across markets, a
B+ Tree book in dynamic fields, and per-transaction settled/owed reconciliation. The
thing to avoid is a single hot shared object that every trade serializes through.

---

## Caveats

- High confidence overall. All 10 findings rest on primary Sui/Mysten/Enoki docs,
  unanimous 3-0 verification.
- Time-sensitive. Enoki and DeepBook v3 are actively evolving. One originally cited
  Enoki URL (`.../ts-sdk/zklogin`) already 404s, though its substance was confirmed
  elsewhere. Verify exact endpoint paths and SDK method names against current docs
  before coding.
- Not benchmarked. The contention/parallelism claims are documented design rationale,
  not independent throughput numbers. `max_epoch + 2` is an example value. "Fastpath"
  is the ownership-docs term; the consensus page does not use it literally.

## Open questions

1. Real latency/throughput of DeepBook v3 under contention, and how much multi-pool
   sharding actually buys versus a single pool.
2. How production dApps mask the forced full re-auth at `max_epoch` mid-trading-session
   (background re-proving, silent OAuth refresh).
3. Enoki's rate limits, gas-station top-up mechanics, and cost model at scale.
4. Non-Enoki patterns (self-hosted salt/proving services, alternative proving backends)
   and their storage/security tradeoffs.

## Sources

- [1] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin), [zkLogin integration](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- [2] above + [developer-account](https://docs.sui.io/guides/developer/cryptography/zklogin-integration/developer-account)
- [3] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin), [integration](https://docs.sui.io/guides/developer/cryptography/zklogin-integration), [developer-account](https://docs.sui.io/guides/developer/cryptography/zklogin-integration/developer-account)
- [4] [zkLogin integration guide](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- [5] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin)
- [6] [Enoki docs](https://docs.enoki.mystenlabs.com/), [sponsored transactions](https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions), [OpenAPI](https://docs.enoki.mystenlabs.com/http-api/openapi)
- [7] [Enoki TS SDK](https://docs.enoki.mystenlabs.com/ts-sdk)
- [8] [Object ownership](https://docs.sui.io/concepts/object-ownership)
- [9] [Dynamic fields](https://docs.sui.io/concepts/dynamic-fields)
- [10] [DeepBook v3 design](https://docs.sui.io/standards/deepbookv3/design)
