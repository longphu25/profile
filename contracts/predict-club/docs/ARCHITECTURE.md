# Predict Club Smart Contracts — Technical Documentation

## Package Overview

`predict_club` là Move package trên Sui cung cấp hai module chính:

1. **`escrow`** — Time-locked escrow generic cho bất kỳ coin type nào (SUI, USDC, DUSDC, v.v.)
2. **`exchange`** — P2P exchange market cho phép swap giữa hai coin types bất kỳ

## Architecture

```
contracts/predict-club/
├── Move.toml
├── sources/
│   ├── escrow.move            # Generic time-locked escrow
│   └── exchange_market.move   # P2P offer/fill exchange
├── tests/
│   ├── escrow_tests.move
│   └── exchange_tests.move
└── docs/
    └── ARCHITECTURE.md        (this file)
```

---

## Module 1: `predict_club::escrow`

### Purpose

Giữ coin (bất kỳ type T) trong escrow với time-lock theo epoch. Hỗ trợ
optional approval bởi bên thứ ba trước khi release.

### Type Parameters

`Escrow<T>` — T là phantom type của coin được escrow. Ví dụ:
- `Escrow<SUI>` — escrow SUI
- `Escrow<USDC>` — escrow USDC
- `Escrow<DUSDC>` — escrow DUSDC

### Object Diagram

```
┌─────────────────────────────────┐
│         Escrow<T>               │
│  (shared object)                │
├─────────────────────────────────┤
│  id: UID                        │
│  escrow_address: address        │
│  depositor: address             │
│  beneficiary: address           │
│  amount: u64                    │
│  locked_until_epoch: u64        │
│  created_at_epoch: u64          │
│  created_at_timestamp: u64      │
│  release_conditions: u8         │
│  approver: address              │
│  approved: bool                 │
│  released: bool                 │
│  balance: Balance<T>            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│        ApproverCap              │
│  (owned by approver)            │
├─────────────────────────────────┤
│  id: UID                        │
│  escrow_id: address             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│       ReleaseReceipt            │
│  (owned by beneficiary)         │
├─────────────────────────────────┤
│  id: UID                        │
│  escrow_id: address             │
│  released_to: address           │
│  amount: u64                    │
│  released_at_epoch: u64         │
│  released_at_timestamp: u64     │
└─────────────────────────────────┘
```

### State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
┌─────────┐   create    ┌─────────┐   deposit   ┌─────────┐  │
│  (nil)  │ ──────────► │ Created │ ──────────► │ Funded  │  │
└─────────┘             └─────────┘             └────┬────┘  │
                              │                      │        │
                              │ cancel               │        │
                              ▼                      │        │
                        ┌───────────┐                │        │
                        │ Cancelled │◄───────────────┤        │
                        └───────────┘    cancel      │        │
                                         (early)     │        │
                                                     │        │
                              ┌───────────────────────┤        │
                              │                       │        │
                              │ (conditions == 1)     │ (conditions == 0)
                              ▼                       │        │
                        ┌───────────┐                 │        │
                        │ Approved  │                 │        │
                        └─────┬─────┘                 │        │
                              │                       │        │
                              │ epoch >= unlock       │ epoch >= unlock
                              ▼                       ▼        │
                        ┌───────────────────────────────┐      │
                        │         Releasable            │      │
                        └──────────────┬────────────────┘      │
                                       │                       │
                                       │ release_funds         │
                                       ▼                       │
                                 ┌───────────┐                 │
                                 │ Released  │─────────────────┘
                                 └───────────┘
```

### Function Signatures

```move
// Create escrow for any coin type
public fun create_escrow<T>(
    beneficiary: address,
    lock_duration_epochs: u64,
    release_conditions: u8,   // 0 = time only, 1 = time + approval
    approver: address,
    ctx: &mut TxContext,
)

// Deposit coins (depositor only, before release)
public fun deposit<T>(
    escrow: &mut Escrow<T>,
    coin: Coin<T>,
    ctx: &TxContext,
)

// Approve release (object first, cap second — per Sui param ordering)
public fun approve_release<T>(
    escrow: &mut Escrow<T>,
    cap: &ApproverCap,
    ctx: &TxContext,
)

// Release — COMPOSABLE: returns (Coin<T>, ReleaseReceipt)
public fun release_funds<T>(
    escrow: &mut Escrow<T>,
    ctx: &mut TxContext,
): (Coin<T>, ReleaseReceipt)

// Cancel — COMPOSABLE: returns Coin<T>
public fun cancel_escrow<T>(
    escrow: &mut Escrow<T>,
    ctx: &mut TxContext,
): Coin<T>

// Entry wrappers for CLI convenience:
entry fun release_and_transfer<T>(escrow, ctx)
entry fun cancel_and_refund<T>(escrow, ctx)
```

### Sequence Diagram: Full Lifecycle

```
  Depositor              Sui Network              Approver            Beneficiary
     │                       │                       │                     │
     │── create_escrow<T> ──►│                       │                     │
     │                       │── ApproverCap ───────►│                     │
     │                       │── share Escrow<T> ───►│ (visible to all)    │
     │                       │                       │                     │
     │── deposit(coin) ─────►│                       │                     │
     │                       │                       │                     │
     │                       │◄── approve_release ───│                     │
     │                       │                       │                     │
     │                       │        ... epochs pass ...                  │
     │                       │                       │                     │
     │                       │◄──────────────── release_funds ─────────────│
     │                       │── Coin<T> ──────────────────────────────────►│
     │                       │── ReleaseReceipt ───────────────────────────►│
     │                       │                       │                     │
```

### Error Codes

| Code | Name | Trigger |
|------|------|---------|
| 1 | ENotDepositor | Non-depositor tries to deposit or cancel |
| 2 | EAlreadyReleased | Action on already-released escrow |
| 3 | ENotApprover | Wrong approver or invalid cap |
| 4 | EAlreadyApproved | Double approval attempt |
| 5 | EStillLocked | Release before unlock epoch |
| 6 | ENotApproved | Release without required approval |
| 7 | ETooLateToCancel | Cancel within last epoch before unlock |
| 8 | EZeroAmount | Deposit zero-value coin |

### Events

| Event | Emitted When |
|-------|-------------|
| `EscrowCreated` | New escrow is created |
| `EscrowReleased` | Funds released to beneficiary |
| `EscrowCancelled` | Escrow cancelled, funds refunded |

---

## Module 2: `predict_club::exchange`

### Purpose

P2P exchange market cho phép maker tạo offer swap giữa hai coin types bất kỳ.
Dùng cho USDC ↔ DUSDC funding trong Predict Club.

### Type Parameters

`EscrowOffer<OfferT, WantT>` — OfferT là coin maker gửi, WantT là coin maker muốn nhận.

Ví dụ:
- `EscrowOffer<DUSDC, USDC>` — Leader offer DUSDC, muốn nhận USDC
- `EscrowOffer<USDC, DUSDC>` — Member offer USDC, muốn nhận DUSDC
- `EscrowOffer<SUI, DUSDC>` — Member dùng SUI mua DUSDC

### Object Diagram

```
┌─────────────────────────────────┐
│       ClubEscrowMarket          │
│  (shared object)                │
├─────────────────────────────────┤
│  id: UID                        │
│  club_id: ID                    │
│  admin: address                 │
│  paused: bool                   │
└─────────────────────────────────┘

┌─────────────────────────────────────┐
│  EscrowOffer<OfferT, WantT>         │
│  (owned or transferred)             │
├─────────────────────────────────────┤
│  id: UID                            │
│  maker: address                     │
│  recipient: Option<address>         │
│  round_id: Option<ID>              │
│  offer_amount: u64                  │
│  want_amount: u64                   │
│  expires_at_epoch: u64              │
│  offer_coin: Coin<OfferT>          │
└─────────────────────────────────────┘
```

### Exchange Flow

```
   Maker                    ClubEscrowMarket                   Filler
     │                            │                              │
     │── create_offer ───────────►│                              │
     │   (deposit Coin<OfferT>)   │                              │
     │◄── EscrowOffer ────────────│                              │
     │                            │                              │
     │                            │◄──────── fill_offer ─────────│
     │                            │          (pay Coin<WantT>)   │
     │◄── Coin<WantT> ───────────│                              │
     │                            │── Coin<OfferT> ─────────────►│
     │                            │                              │
```

### Alternative: Cancel Flow

```
   Maker                    ClubEscrowMarket
     │                            │
     │── cancel_offer ───────────►│
     │◄── Coin<OfferT> (refund) ──│
     │                            │
```

### Function Signatures

```move
// Create shared market for a club
public fun create_market(club_id: ID, ctx: &mut TxContext)

// Pause/unpause (admin only)
public fun set_paused(market: &mut ClubEscrowMarket, paused: bool, ctx: &TxContext)

// Create P2P offer — COMPOSABLE: returns EscrowOffer
public fun create_offer<OfferT, WantT>(
    market: &ClubEscrowMarket,
    offer_coin: Coin<OfferT>,
    want_amount: u64,
    recipient: Option<address>,    // None = anyone can fill
    round_id: Option<ID>,          // link to prediction round
    expires_in_epochs: u64,
    ctx: &mut TxContext,
): EscrowOffer<OfferT, WantT>

// Fill — COMPOSABLE: returns (Coin<OfferT>, Coin<WantT> change)
public fun fill_offer<OfferT, WantT>(
    market: &ClubEscrowMarket,
    offer: EscrowOffer<OfferT, WantT>,
    payment: Coin<WantT>,
    ctx: &mut TxContext,
): (Coin<OfferT>, Coin<WantT>)

// Cancel — COMPOSABLE: returns Coin<OfferT>
public fun cancel_offer<OfferT, WantT>(
    market: &ClubEscrowMarket,
    offer: EscrowOffer<OfferT, WantT>,
    ctx: &TxContext,
): Coin<OfferT>

// Entry wrappers for CLI convenience:
entry fun fill_and_transfer<OfferT, WantT>(market, offer, payment, ctx)
entry fun cancel_and_refund<OfferT, WantT>(market, offer, ctx)
```

### Error Codes

| Code | Name | Trigger |
|------|------|---------|
| 100 | ENotMaker | Non-maker tries to cancel |
| 101 | EOfferExpired | Fill after expiry epoch |
| 102 | EWrongRecipient | Restricted offer filled by wrong address |
| 103 | EMarketPaused | Create/fill while market paused |
| 104 | EUnderpayment | Payment less than want_amount |
| 105 | EZeroAmount | Offer or want amount is 0 |
| 106 | EZeroExpiry | expires_in_epochs is 0 |
| 107 | ENotAdmin | Non-admin tries to pause |

### Events

| Event | Emitted When |
|-------|-------------|
| `OfferCreated` | New offer deposited |
| `OfferFilled` | Offer successfully filled |
| `OfferCancelled` | Offer cancelled by maker |

---

## System Architecture: Combined Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Predict Club System                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │   Time-Locked Escrow  │         │     P2P Exchange Market        │  │
│  │   (escrow module)     │         │     (exchange module)          │  │
│  │                       │         │                                │  │
│  │  Escrow<SUI>          │         │  ClubEscrowMarket              │  │
│  │  Escrow<USDC>         │         │    ├── EscrowOffer<DUSDC,USDC> │  │
│  │  Escrow<DUSDC>        │         │    ├── EscrowOffer<USDC,DUSDC> │  │
│  │                       │         │    ├── EscrowOffer<SUI,DUSDC>  │  │
│  │  Use cases:           │         │    └── EscrowOffer<USDC,SUI>   │  │
│  │  - Payment holds      │         │                                │  │
│  │  - Commitment locks   │         │  Use cases:                    │  │
│  │  - Dispute resolution │         │  - USDC → DUSDC funding        │  │
│  │                       │         │  - Leader reserve quotes        │  │
│  └───────────────────────┘         │  - Peer-to-peer swaps          │  │
│                                    └────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Frontend (predict-club.html)                    │  │
│  │  - Wallet signing via dApp Kit                                    │  │
│  │  - PTB construction for multi-step flows                          │  │
│  │  - Event subscription for real-time updates                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Funding Router Integration

```
  Member (has SUI only)
      │
      ├─── [DeepBook swap SUI→USDC] ───┐
      │                                  │
      │    OR                            ▼
      │                            ┌──────────┐
      ├─── [Scallop borrow USDC] ─►│  USDC    │
      │                            └────┬─────┘
      │    OR                           │
      │                                  │ fill_offer<DUSDC, USDC>
      ├─── [Bridge assets] ─────────────┤
      │                                  ▼
      │                            ┌──────────┐
      └── (already has DUSDC) ────►│  DUSDC   │
                                   └────┬─────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ PredictManager│
                                 │   deposit     │
                                 └──────────────┘
```

---

## Supported Coin Types

| Coin | Type Path | Usage |
|------|-----------|-------|
| SUI | `0x2::sui::SUI` | Gas, collateral, escrow |
| USDC | Testnet/Mainnet USDC type | Intermediate funding |
| DUSDC | DeepBook Predict DUSDC type | Predict trading asset |

Cả hai module đều **generic** — có thể dùng với bất kỳ coin type nào trên Sui
mà không cần sửa contract.

---

## Security Considerations

1. **Epoch-based time lock** — Không dùng timestamp (dễ bị manipulate), dùng epoch (consensus-verified).
2. **Separate ApproverCap** — Approval require possession of capability object, không chỉ address check.
3. **Cancel deadline** — Depositor phải cancel ít nhất 1 epoch trước unlock để tránh race condition.
4. **Overpayment handling** — Fill offer với số dư lớn hơn want_amount sẽ trả change lại filler.
5. **Market pause** — Admin có thể pause market trong trường hợp khẩn cấp.
6. **Recipient restriction** — Offer có thể giới hạn cho một address cụ thể.

---

## Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| escrow | 6 | create, deposit, approve, release, early-release-fail, cancel, no-approval-fail |
| exchange | 6 | create+fill, cancel, wrong-recipient, underpayment, paused-market, non-maker-cancel |

Run tests:
```bash
sui move test
```

Build:
```bash
sui move build
```

---

## Future Extensions (V2)

- `club_vault.move` — Pooled DUSDC vault with LeaderCap policy guard
- Multi-sig approval (release_conditions == 2)
- Partial fill for exchange offers
- Fee collection on exchange fills
- Oracle-price-linked exchange rates

---

## Applied Sui Skills (docs.sui.io/skills)

| Skill | What was applied |
|-------|-----------------|
| **modern-move-syntax** | Method syntax (`coin.value()`, `ctx.sender()`, `id.delete()`), vector/option macros |
| **naming-conventions** | `#[error]` attributes with messages, past-tense events (`FundsReleased`), `Cap` suffix, field-name getters |
| **composable-move-functions** | Public functions return values (not transfer internally), separate `entry` wrappers, object-first param order |
| **object-model** | `key` without `store` on Escrow (custom transfer rules), `key + store` on ApproverCap/Receipt (freely transferable) |
