---
tags: [seal, voting, onchain-decryption, hmac-ctr]
aliases: [Seal Voting, Sealed Voting]
---

# sui-seal-voting — Technical Design

Encrypted ballot voting with on-chain decryption via Seal HMAC-CTR.

## Overview

Voters submit encrypted ballots on-chain. Nobody can see individual votes until the admin closes voting and triggers on-chain decryption. The tally is verifiable — anyone can re-run the decryption and confirm results.

```
Voter → encrypt(ballot, HMAC-CTR) → submit on-chain
                                          ↓
Admin closes voting → fetch derived keys → on-chain decrypt → tally
```

---

## 1. Move Contract: `voting_seal.move`

### Structs

```move
module seal_demo::voting_seal;

use sui::clock::Clock;

const ENotAdmin: u64 = 0;
const ENotEligible: u64 = 1;
const EAlreadyVoted: u64 = 2;
const EClosed: u64 = 3;
const ENotClosed: u64 = 4;
const EInvalidId: u64 = 5;

/// Shared voting session
struct VotingSession has key {
    id: UID,
    admin: address,
    topic: vector<u8>,                    // UTF-8 topic string
    options: vector<vector<u8>>,          // UTF-8 option labels
    eligible_voters: vector<address>,
    encrypted_ballots: vector<vector<u8>>, // Seal-encrypted votes
    voters_submitted: vector<address>,
    is_closed: bool,
    created_at: u64,                      // clock timestamp
}
```

### Functions

```move
/// Create a new voting session. Caller becomes admin.
public fun create(
    topic: vector<u8>,
    options: vector<vector<u8>>,
    eligible_voters: vector<address>,
    c: &Clock,
    ctx: &mut TxContext,
) {
    let session = VotingSession {
        id: object::new(ctx),
        admin: ctx.sender(),
        topic,
        options,
        eligible_voters,
        encrypted_ballots: vector[],
        voters_submitted: vector[],
        is_closed: false,
        created_at: c.timestamp_ms(),
    };
    transfer::share_object(session);
}

/// Submit an encrypted ballot.
/// Caller must be eligible and not have voted yet.
public fun submit_ballot(
    session: &mut VotingSession,
    encrypted_ballot: vector<u8>,
    ctx: &TxContext,
) {
    assert!(!session.is_closed, EClosed);
    let sender = ctx.sender();
    assert!(session.eligible_voters.contains(&sender), ENotEligible);
    assert!(!session.voters_submitted.contains(&sender), EAlreadyVoted);
    session.encrypted_ballots.push_back(encrypted_ballot);
    session.voters_submitted.push_back(sender);
}

/// Close voting. Only admin.
public fun close(session: &mut VotingSession, ctx: &TxContext) {
    assert!(session.admin == ctx.sender(), ENotAdmin);
    assert!(!session.is_closed, EClosed);
    session.is_closed = true;
}

/// seal_approve — eligible voters can encrypt to this session.
/// id = session_object_id_bytes ++ optional_nonce
entry fun seal_approve(
    id: vector<u8>,
    session: &VotingSession,
    ctx: &TxContext,
) {
    let session_id_bytes = object::id(session).to_bytes();
    assert!(is_prefix(session_id_bytes, id), EInvalidId);
    assert!(session.eligible_voters.contains(&ctx.sender()), ENotEligible);
}

fun is_prefix(prefix: vector<u8>, data: vector<u8>): bool {
    if (prefix.length() > data.length()) return false;
    let mut i = 0;
    while (i < prefix.length()) {
        if (prefix[i] != data[i]) return false;
        i = i + 1;
    };
    true
}
```

### Deployment

```bash
cd move
sui move build
sui client publish --gas-budget 100000000
# → save PACKAGE_ID
```

---

## 2. Encryption: HMAC-CTR (Required)

On-chain decryption only supports HMAC-CTR. Must specify `DemType.Hmac256Ctr`:

```ts
import { DemType } from '@mysten/seal'

// Ballot = single byte (option index)
const ballotData = new Uint8Array([optionIndex])

// Identity = session_object_id ++ random_nonce
const sessionIdBytes = fromHex(sessionObjectId.replace(/^0x/, ''))
const nonce = crypto.getRandomValues(new Uint8Array(5))
const idBytes = new Uint8Array([...sessionIdBytes, ...nonce])
const id = toHex(idBytes)

const { encryptedObject } = await sealClient.encrypt({
  threshold: DEFAULT_THRESHOLD,
  packageId: PACKAGE_ID,
  id,
  data: ballotData,
  demType: DemType.Hmac256Ctr,  // ← required for on-chain decrypt
})
```

Ballot data is 1 byte → HMAC-CTR overhead is acceptable.

---

## 3. On-chain Decryption PTB

This is the most complex part. The admin builds a PTB that decrypts each ballot on-chain.

### Seal Package for On-chain Decryption

```
Testnet: 0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3
Mainnet: 0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7
```

### Step-by-step PTB Construction

```ts
const SEAL_PKG = '0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3'

// For each encrypted ballot:
for (const encryptedBytes of allBallots) {
  const encObj = EncryptedObject.parse(encryptedBytes)

  // 1. Get derived keys from key servers
  const derivedKeys = await sealClient.getDerivedKeys({
    id: encObj.id,
    txBytes: approvalTxBytes,  // seal_approve PTB
    sessionKey,
    threshold: encObj.threshold,
  })

  // 2. Get public keys for the key servers
  const publicKeys = await sealClient.getPublicKeys(
    encObj.services.map(([service]) => service)
  )

  // 3. Build Move calls in the PTB:

  // 3a. Convert public keys to on-chain format
  const pkObjects = publicKeys.map((pk, i) =>
    tx.moveCall({
      target: `${SEAL_PKG}::bf_hmac_encryption::new_public_key`,
      arguments: [
        tx.pure.address(encObj.services[i][0]),
        tx.pure.vector('u8', pk.toBytes()),
      ],
    })
  )

  // 3b. Convert derived keys to G1 elements
  const g1Elements = Array.from(derivedKeys).map(([_, value]) =>
    tx.moveCall({
      target: '0x2::bls12381::g1_from_bytes',
      arguments: [tx.pure.vector('u8', fromHex(value.toString()))],
    })
  )

  // 3c. Verify derived keys
  const verified = tx.moveCall({
    target: `${SEAL_PKG}::bf_hmac_encryption::verify_derived_keys`,
    arguments: [
      tx.makeMoveVec({
        elements: g1Elements,
        type: '0x2::group_ops::Element<0x2::bls12381::G1>',
      }),
      tx.pure.address(encObj.packageId),
      tx.pure.vector('u8', fromHex(encObj.id)),
      tx.makeMoveVec({
        elements: pkObjects,
        type: `${SEAL_PKG}::bf_hmac_encryption::PublicKey`,
      }),
    ],
  })

  // 3d. Parse encrypted object on-chain
  const parsedOnChain = tx.moveCall({
    target: `${SEAL_PKG}::bf_hmac_encryption::parse_encrypted_object`,
    arguments: [tx.pure.vector('u8', encryptedBytes)],
  })

  // 3e. Decrypt
  const decrypted = tx.moveCall({
    target: `${SEAL_PKG}::bf_hmac_encryption::decrypt`,
    arguments: [
      parsedOnChain,
      verified,
      tx.makeMoveVec({
        elements: pkObjects,
        type: `${SEAL_PKG}::bf_hmac_encryption::PublicKey`,
      }),
    ],
  })
  // decrypted is Option<vector<u8>>
}
```

### Batching Strategy

PTB size limit means we can't decrypt all ballots in one transaction:
- Estimate ~5-10 ballots per PTB (depends on key server count)
- Split into multiple transactions if needed
- Aggregate results client-side

---

## 4. Plugin UI

### Tab: Create Session

```
┌─────────────────────────────────────┐
│ Create Voting Session               │
│                                     │
│ Topic: [________________________]   │
│                                     │
│ Options:                            │
│ [Option 1_____] [+ Add]            │
│ [Option 2_____] [x]                │
│                                     │
│ Eligible Voters:                    │
│ [0x... address] [+ Add]            │
│ • 0x1234…abcd  [x]                 │
│ • 0x5678…efgh  [x]                 │
│                                     │
│ [Create Session]                    │
│                                     │
│ Session ID: 0xabcd…1234             │
└─────────────────────────────────────┘
```

### Tab: Vote

```
┌─────────────────────────────────────┐
│ Cast Your Vote                      │
│                                     │
│ Session: [0x... session ID____]     │
│                                     │
│ Topic: "Should we fund Project X?"  │
│ Status: Open (3/5 voted)            │
│                                     │
│ ○ Yes                               │
│ ● No                                │
│ ○ Abstain                           │
│                                     │
│ [Submit Encrypted Vote]             │
│                                     │
│ ✓ Vote submitted! Your ballot is    │
│   encrypted — nobody can see it     │
│   until voting closes.              │
└─────────────────────────────────────┘
```

### Tab: Tally

```
┌─────────────────────────────────────┐
│ Close & Tally                       │
│                                     │
│ Session: 0xabcd…1234                │
│ Status: Open (5/5 voted)            │
│                                     │
│ [Close Voting]                      │
│                                     │
│ Decrypting ballots on-chain…        │
│ ████████████░░░░ 3/5                │
│                                     │
│ Results:                            │
│ Yes     ████████████████  3 (60%)   │
│ No      ████████          2 (40%)   │
│ Abstain                   0 (0%)    │
│                                     │
│ Total: 5 votes                      │
│ Verified on-chain ✓                 │
└─────────────────────────────────────┘
```

---

## 5. Data Flow

```
                    ┌──────────────┐
                    │  Admin       │
                    │  creates     │
                    │  session     │
                    └──────┬───────┘
                           │ create() tx
                           ▼
                    ┌──────────────┐
                    │ VotingSession│ (shared object on Sui)
                    │  topic       │
                    │  options     │
                    │  voters[]    │
                    │  ballots[]   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Voter A  │ │ Voter B  │ │ Voter C  │
        │ encrypt  │ │ encrypt  │ │ encrypt  │
        │ HMAC-CTR │ │ HMAC-CTR │ │ HMAC-CTR │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │             │
             │ submit_ballot() tx        │
             ▼             ▼             ▼
        ┌──────────────────────────────────┐
        │ VotingSession.encrypted_ballots  │
        │ [enc_A, enc_B, enc_C]            │
        └──────────────┬───────────────────┘
                       │
                       │ Admin closes + tally
                       ▼
        ┌──────────────────────────────────┐
        │ On-chain decryption PTB          │
        │                                  │
        │ getDerivedKeys() → key servers   │
        │ bf_hmac_encryption::decrypt()    │
        │ → Option<vector<u8>> per ballot  │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Results: Yes=3, No=2, Abstain=0  │
        │ Verifiable on-chain ✓            │
        └──────────────────────────────────┘
```

---

## 6. Key Technical Decisions

### Ballot Encoding

Single byte — option index:
```
0x00 = Option 0 ("Yes")
0x01 = Option 1 ("No")
0x02 = Option 2 ("Abstain")
```

Small payload → HMAC-CTR overhead acceptable.

### Identity Construction

```
id = session_object_id (32 bytes) ++ random_nonce (5 bytes)
```

Nonce ensures each ballot has a unique identity even for the same session. The `seal_approve` function checks `is_prefix(session_id, id)`.

### On-chain vs Client-side Tally

| Approach | Pros | Cons |
|----------|------|------|
| **On-chain** (chosen) | Verifiable, trustless | Complex PTB, gas cost, HMAC-CTR only |
| Client-side | Simple, fast, AES-GCM | Admin sees votes, not verifiable |

On-chain chosen because vote privacy + verifiability is the whole point.

### Session Key Scope

- Voters need a SessionKey to encrypt (for `seal_approve` dry-run during decrypt)
- Admin needs a SessionKey to call `getDerivedKeys` during tally
- Both scoped to the voting package ID, TTL = 10 min

### Public Key Caching

`getPublicKeys()` should be called once during app init and cached. Same public keys for all ballots in a session (same key servers).

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| PTB too large for many ballots | Tx fails | Batch 5-10 ballots per PTB, aggregate client-side |
| Key server rate limiting | getDerivedKeys fails | Use `fetchKeys()` batch API, pre-fetch all IDs |
| Voter submits invalid ballot | Tally error | `decrypt` returns `None` for invalid — skip in count |
| Admin doesn't close voting | Votes stuck | Add optional deadline in Move (clock-based auto-close) |
| Gas cost for on-chain decrypt | Expensive for many voters | Estimate gas upfront, warn admin |
| HMAC-CTR performance | Slow for large data | Ballot is 1 byte — negligible |

---

## 8. Implementation Checklist

### Move Contract
- [ ] Write `voting_seal.move` (create, submit_ballot, close, seal_approve)
- [ ] Add tally helper or leave tally to PTB-only
- [ ] `sui move test` — unit tests for access control
- [ ] Deploy to testnet, save package ID

### Plugin: Create Tab
- [ ] Form: topic, options (dynamic add/remove), eligible voters
- [ ] `signAndExecuteTransaction` → create session
- [ ] Fetch session object to confirm + display ID

### Plugin: Vote Tab
- [ ] Input session ID → fetch session details (topic, options, status)
- [ ] Radio buttons for options
- [ ] Encrypt with `DemType.Hmac256Ctr`
- [ ] Submit encrypted ballot on-chain
- [ ] Show confirmation

### Plugin: Tally Tab
- [ ] Close voting (admin only)
- [ ] Fetch all encrypted_ballots from session object
- [ ] Build approval PTB for `seal_approve`
- [ ] `getDerivedKeys` + `getPublicKeys` (batch)
- [ ] Build on-chain decryption PTB (per batch)
- [ ] Execute + parse results
- [ ] Count votes per option

### Plugin: Results Display
- [ ] Bar chart (CSS-only, no chart library)
- [ ] Vote counts + percentages
- [ ] "Verified on-chain" indicator

### Integration
- [ ] Register in `vite.config.ts`
- [ ] Register in `SuiWasmDashboard.tsx`
- [ ] CSS file
- [ ] Build + verify

---

## 9. Estimated Effort

| Component | LOC | Time |
|-----------|-----|------|
| `voting_seal.move` | ~120 | 1h |
| Move tests | ~80 | 30min |
| Plugin UI (4 tabs) | ~400 | 2h |
| On-chain decrypt PTB builder | ~150 | 2h |
| Batch logic + error handling | ~80 | 1h |
| CSS | ~80 | 30min |
| Testing + debugging | — | 2h |
| **Total** | **~910** | **~9h** |

The on-chain decryption PTB builder is the highest-risk component — complex type annotations, `makeMoveVec` with generic types, and multi-step Move calls that must be composed correctly.
