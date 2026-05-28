# Permissioned Asset Standard (PAS)

> **Testnet only** — PAS is not yet live on Mainnet.

## Overview

PAS enforces a closed-loop ownership model for managed assets on Sui. Instead of holding `Coin` or `Balance` directly, a wallet's assets are proxied through an `Account` shared object. Every movement is gated by **programmable approval logic** that the issuer defines in a `Policy`.

This is conceptually a generalization of the [Closed-Loop Token](./closed-loop-token.md) standard — instead of restricting a single token type, PAS restricts **any** asset that flows through a Namespace.

## When to use it

- Tokenized real-world assets (RWA) with KYC/jurisdiction rules
- Issuer-controlled stablecoins with claw-back
- Securities where the issuer must approve every transfer
- Closed ecosystems (in-game assets, loyalty programs)
- Any asset where issuer policy must be enforced at the protocol layer

## Core concepts

### Namespace

The root shared singleton object. It deterministically derives addresses for every Account, Policy, and Template under it. Holds:

- `Versioning` — emergency version blocking
- `UpgradeCap` UID — gates admin operations

### Account

A shared object derived from `(namespace_id, AccountKey(owner_addr))`. Holds the user's managed assets:

- Permissionless creation — anyone can create an Account for any address
- Wallet-owned (via `tx.sender()`) or object-owned (via `UID`)
- Stores `Balance<C>` via `balance::send_funds(balance, account_addr)` (Address Balances)
- Stores arbitrary `T` directly on the Account UID

### Policy

`Policy<T>` defines required approvals for each action on type `T`:

```
Policy<Balance<MY_COIN>>:
  send_funds:     [TransferApproval]
  unlock_funds:   [WithdrawalApproval]
  clawback_funds: [ClawbackApproval]  // only if clawback_allowed = true
```

Created via `policy::new_for_currency(&mut namespace, &mut treasury_cap, clawback_allowed)`. The caller must hold `TreasuryCap<C>`.

### PolicyCap

The capability to manage a Policy. Derived 1-to-1 from the Policy UID. Used to:

- Set/update required approvals per action
- Remove approvals (effectively disabling that action)

### Auth

A proof of ownership held momentarily during a transaction:

```move
// Wallet-owned Account
let auth = account::new_auth(ctx);

// Object-owned Account
let auth = account::new_auth_as_object(&mut my_object_uid);
```

## The request pattern

Every state-changing action follows the **hot-potato request** pattern:

```
1. Create Request    → empty approval set
2. Approve (1..N)    → stamp with witness types
3. Resolve           → match approvals → execute or abort
```

### Step 1: Create

An Account method wraps data into a request:

```move
let request: Request<SendFunds<Balance<MY_COIN>>> = account::send_funds(
  &mut account, &auth, balance, recipient_addr, ctx
);
```

### Step 2: Approve

Each approval is a **type-level proof** stamped by an external package:

```move
// Your KYC contract:
public fun approve_transfer(kyc: &KycCert, request: &mut Request<Action<T>>) {
  request.approve(TransferApproval {});
}

// In the transaction:
my_kyc::approve_transfer(&kyc_obj, &mut request);
my_compliance::stamp(&mut request);
```

Approvals are matched by `TypeName` — you cannot forge an approval from a different package.

### Step 3: Resolve

```move
account::confirm_send(&mut request, &policy);
// Verifies: request.approvals == policy.required_approvals (exact match)
// If mismatch → abort
// If match → execute the action and destroy the request
```

The request is a hot potato — no `drop`, no `store`. If it survives the transaction, the VM aborts.

## Request types

| Type | Purpose | Initiated by |
|------|---------|--------------|
| `Request<SendFunds<T>>` | Transfer between Accounts | Account owner |
| `Request<UnlockFunds<T>>` | Withdraw out of the system | Account owner |
| `Request<ClawbackFunds<T>>` | Issuer claw-back | Issuer (PolicyCap holder) |

## Approval matching rules

Approvals are matched by exact set equality on `TypeName`:

| Required | Provided | Result |
|----------|----------|--------|
| `{TransferApproval}` | `{TransferApproval}` | ✅ resolve |
| `{TransferApproval}` | `{TransferApproval, ExtraApproval}` | ❌ count mismatch |
| `{TransferApproval}` | `{WrongApproval}` | ❌ type mismatch |
| `{TransferApproval}` | `{}` | ❌ empty |

> Current version supports a single approval witness per action. Multi-approval (multiple independent contracts) is planned.

## Object hierarchy

```
Namespace (shared singleton)
├── Account (@0xAlice)             ← derived from (namespace_id, AccountKey(alice))
├── Account (@0xBob)               ← derived from (namespace_id, AccountKey(bob))
├── Policy<Balance<MY_COIN>>       ← derived from (namespace_id, PolicyKey<Balance<MY_COIN>>)
│   └── PolicyCap<Balance<MY_COIN>> ← derived from (policy_id, PolicyCapKey)
└── Templates                      ← derived from (namespace_id, TemplateKey)
```

All addresses are deterministic — you can compute them off-chain:

```typescript
// Off-chain address derivation
const accountAddr = namespace.account_address(aliceAddr)
const policyAddr = namespace.policy_address<Balance<MY_COIN>>()
```

## Balance flow

Balances are NOT stored as Account fields. They use Sui's [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances):

```
Deposit (permissionless):
  balance::send_funds(balance, account_obj_address)

Withdrawal (gated):
  Account.withdraw_funds_from_object(amount)
  → only callable by PAS modules
  → only through a resolved Request
```

This means **anyone can deposit** into anyone's Account, but only the Account owner (with Auth) can initiate a withdrawal.

## Security model

PAS guarantees:

- **Closed loop** — managed assets cannot leave without a resolved request
- **Type-safe approvals** — `TypeName` matching prevents forgery across packages
- **Atomic resolution** — hot-potato semantics force same-tx resolution
- **Deterministic addressing** — no hidden state, all derived addresses

PAS does NOT enforce:

- Who can transfer (your contract decides via approval witnesses)
- Compliance rules (your contract implements before stamping)
- Account creation gating (anyone can create any Account)

## Trust boundaries

| Capability | Holder | Power |
|------------|--------|-------|
| `PolicyCap<T>` | Policy admin | Change approval requirements for `T` |
| `TreasuryCap<C>` | Currency issuer | Create the policy (one-time) |
| `Auth` | Account owner | Initiate `send_funds` / `unlock_funds` |
| (none) | Anyone | Create Accounts, deposit, sync versioning |

## TypeScript SDK

```typescript
import { /* PAS exports */ } from '@mysten/pas'

// 1. Get account address for an owner
const accountAddr = await pas.getAccountAddress(namespaceId, ownerAddr)

// 2. Build a transfer transaction (issuer's frontend stamps the approvals)
const tx = new Transaction()
const request = pas.createSendRequest(tx, { account, balance, recipient })
yourPackage.approve(tx, { request, kycCert })
pas.confirmSend(tx, { request, policy })

await client.signAndExecute({ transaction: tx, signer })
```

## Limitations vs CLT

| Feature | CLT | PAS |
|---------|-----|-----|
| Asset scope | Single token type | Any type via Namespace |
| Storage | Direct ownership | Account-mediated |
| Approval model | Per-action `Rule`s | Witness-based on Request |
| Multi-asset | One policy per token | One Namespace, many Policies |
| Live network | Mainnet | Testnet only |

## Related

- [Closed-Loop Token](./closed-loop-token.md) — single-token equivalent
- [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances)
- [GitHub: MystenLabs/pas](https://github.com/MystenLabs/pas)
- [npm: @mysten/pas](https://www.npmjs.com/package/@mysten/pas)


---

## Tài liệu tham khảo (References)

### Official Sui docs

- [PAS Overview](https://docs.sui.io/onchain-finance/pas/)
- [Architecture](https://docs.sui.io/onchain-finance/pas/pas-architecture)
- [Workflows / Actions](https://docs.sui.io/onchain-finance/pas/pas-workflows)
- [Integration](https://docs.sui.io/onchain-finance/pas/integrating-pas)
- [Querying Assets](https://docs.sui.io/onchain-finance/pas/querying-assets)
- [Address Balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances)

### Source & SDK

- [GitHub: MystenLabs/pas](https://github.com/MystenLabs/pas)
- [npm: @mysten/pas](https://www.npmjs.com/package/@mysten/pas)
