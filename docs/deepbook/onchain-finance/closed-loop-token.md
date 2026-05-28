# Closed-Loop Token (CLT)

## Overview

The Closed-Loop Token standard lets you create tokens whose flow is restricted by custom programmable policies. It is defined in the `sui::token` module of the Sui framework. Unlike the open-loop `Coin` standard, a `Token` cannot be wrapped, stored as a dynamic field, or freely transferred unless an explicit policy authorizes it.

## When to use it

- Loyalty points, in-game currencies, gift cards
- Bonus or vesting tokens with redemption rules
- Regulated stablecoins or compliance-restricted tokens
- Any token where the issuer must control where and how it moves

## CLT vs Coin

| Aspect | `Coin<T>` | `Token<T>` |
|--------|-----------|------------|
| Abilities | `key + store` | `key` only |
| Wrappable | Yes | No |
| Stored as dynamic field | Yes | No |
| Free public transfer | Yes | No (gated by policy) |
| Conversion | N/A | `Token ↔ Coin` via `to_coin` / `from_coin` |

```move
struct Coin<phantom T> has key, store { id: UID, balance: Balance<T> }
struct Token<phantom T> has key { id: UID, balance: Balance<T> }
```

The missing `store` ability is what enforces the closed loop. The token cannot leave the system except through a function that produces an `ActionRequest`.

## Public actions (always allowed)

These mirror the `Coin` API but operate on `Token`:

- `token::keep(token, ctx)` — send to transaction sender
- `token::join(a, b)` — merge two tokens
- `token::split(token, amount, ctx)` — split into two
- `token::zero<T>(ctx)` — create empty balance
- `token::destroy_zero(token)` — destroy zero-balance token

## Protected actions (require policy approval)

Each call returns an `ActionRequest` that must be confirmed before the transaction succeeds:

- `token::transfer(token, recipient, ctx)` — transfer to another address
- `token::to_coin(token, ctx)` — convert Token → Coin
- `token::from_coin(coin, ctx)` — convert Coin → Token
- `token::spend(token, ctx)` — spend on a service

## Token policy

A `TokenPolicy<T>` enables protected actions and attaches `Rules`. Each action has its own approval set:

```move
public struct TokenPolicy<phantom T> has key { id: UID, /* ... */ }

// Issuer creates the policy:
let (policy, cap) = token::new_policy<MY_TOKEN>(treasury, ctx);

// Issuer enables transfers and adds rules:
token::add_rule_for_action<MY_TOKEN, KycRule>(&mut policy, &cap, "transfer", ctx);
token::allow<MY_TOKEN>(&mut policy, &cap, "transfer", ctx);

// Share the policy so users can resolve their requests against it:
token::share_policy(policy);
```

## Rules

A `Rule` is a stamp witness that proves an action satisfied a custom check. Examples:

- KYC rule — caller must hold a verified-identity object
- Limit rule — amount must be below per-tx cap
- Whitelist rule — recipient must be in an allowlist
- Time-lock rule — current epoch must exceed a threshold

```move
// Caller's rule package stamps the request:
my_kyc::approve(&kyc_obj, &mut request, ctx);
my_limit::approve(amount, &mut request, ctx);

// Resolution:
token::confirm_request(policy, request, ctx);
```

If any required rule did not stamp, `confirm_request` aborts and the entire transaction rolls back (hot potato semantics).

## ActionRequest hot potato

`ActionRequest` has `key` only, no `drop`, no `store`. It must be resolved before the transaction ends:

1. Created by a protected action (`transfer`, `spend`, etc.)
2. Stamped by zero or more rule packages
3. Resolved by `token::confirm_request(policy, request, ctx)` or by the issuer holding `TreasuryCap`

If unresolved, the Move VM aborts the transaction.

## Resolution paths

| Path | Caller | Description |
|------|--------|-------------|
| `confirm_request` | Anyone | Match approvals against policy |
| `confirm_with_treasury_cap` | Issuer | Bypass policy with treasury cap |
| Custom resolver | Module-defined | Module exposing `confirm_request_*` |

## Compliance pattern (typical flow)

```move
// 1. User calls a protected action
let request = token::transfer(&mut my_token, recipient, ctx);

// 2. KYC contract stamps the request
kyc::stamp_transfer(&kyc_obj, &mut request, ctx);

// 3. Volume-cap contract stamps the request
volume_cap::stamp_transfer(amount, &mut request, ctx);

// 4. Confirm against policy
token::confirm_request(&policy, request, ctx);
```

If the policy requires `[KycRule, VolumeCapRule]` and the request collected exactly those stamps, the transaction succeeds.

## Reading on-chain state

```typescript
// Query token balance via standard SuiClient
const balance = await client.core.getCoins({
  owner: address,
  coinType: '0xPACKAGE::my_token::MY_TOKEN',
})

// TokenPolicy and Rules are regular shared objects:
const policy = await client.core.getObject({ id: POLICY_ID, options: { showContent: true } })
```

## Limitations

- No `store` means tokens cannot live inside arbitrary objects (vaults, NFTs, etc.) — only inside accounts
- Policies are issuer-controlled — users have no veto
- Wrapping is impossible by design
- Conversion to `Coin` requires explicit policy approval

## Related

- [Permissioned Asset Standard](./pas.md) — full account-based asset model that extends CLT concepts
- [Sui framework `sui::token` module](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/token.md)


---

## Tài liệu tham khảo (References)

### Official Sui docs

- [Closed-Loop Token Overview](https://docs.sui.io/onchain-finance/closed-loop-token)
- [Token Policy](https://docs.sui.io/onchain-finance/closed-loop-token/token-policy)
- [Action Request](https://docs.sui.io/onchain-finance/closed-loop-token/action-request)
- [Rules](https://docs.sui.io/onchain-finance/closed-loop-token/rules)
- [Spending](https://docs.sui.io/onchain-finance/closed-loop-token/spending)
- [Currency Standard (open-loop counterpart)](https://docs.sui.io/onchain-finance/fungible-tokens/currency)

### Source

- [`sui::token` module documentation](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/token.md)
- [`sui::token` source](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/token.move)
