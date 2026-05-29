# ZK Merkle Identity — Technical Reference

> Poseidon BN254 Merkle tree + Semaphore-style identity blobs. Groth16-compatible output cho `sui::groth16` on-chain verification.
>
> Source: `plugins/sui-zk-merkle/` · WASM: `plugins/sui-zk-merkle/wasm/` (Rust, 155KB)

---

## Mục đích

Tạo anonymous membership proof: chứng minh "tôi thuộc nhóm này" mà không reveal identity. Dùng cho:
- Anonymous voting (DAO governance)
- Airdrop claim (chứng minh eligible mà không reveal address)
- Allowlist verification (private group membership)

---

## Kiến trúc

```
Browser (plugin.tsx)
    │
    ├── Input: danh sách addresses + poll_id + signal
    │
    ├── WASM (Rust, 155KB)
    │   ├── Generate identity: secret → nullifier → commitment
    │   ├── Build Poseidon Merkle tree
    │   ├── Extract proof path per leaf
    │   └── Compute Groth16 public inputs (4 × 32-byte LE)
    │
    ├── Output: identity.json per address
    │
    └── On-chain verification (Move):
        ├── sui::groth16::verify_groth16_proof()  ← Groth16 proof
        └── sui::poseidon::poseidon_bn254()       ← Merkle root check
```

---

## Semaphore Identity Model

```
secret (random 32 bytes, BN254 field element)
    │
    ├── identity_nullifier = Poseidon(secret, 0)
    │       │
    │       └── nullifier_hash = Poseidon(external_nullifier, identity_nullifier)
    │           → prevents double-signaling (same person can't vote twice)
    │
    └── identity_commitment = Poseidon(identity_nullifier, secret)
            → Merkle tree leaf
```

### Merkle Tree (Poseidon BN254)

```
                    ┌─────────┐
                    │  Root   │  ← Poseidon(L, R) sorted
                    └────┬────┘
               ┌─────────┴─────────┐
          ┌────┴────┐         ┌────┴────┐
          │ Node 01 │         │ Node 23 │
          └────┬────┘         └────┬────┘
        ┌──────┴──────┐     ┌──────┴──────┐
   commitment_0  commitment_1  commitment_2  (dup)
```

- Leaf = commitment (already a Poseidon hash)
- Node = `Poseidon(min(L,R), max(L,R))` — sorted for canonical ordering
- Odd layers: duplicate last leaf

---

## Groth16 Public Inputs

4 scalars, mỗi scalar 32 bytes **little-endian**, concatenated = 128 bytes:

| # | Field | Ý nghĩa |
|---|-------|---------|
| 1 | `merkle_root` | Root của commitment tree |
| 2 | `nullifier_hash` | `Poseidon(external_nullifier, identity_nullifier)` — chống double-signal |
| 3 | `signal_hash` | `Poseidon(signal, 0)` — vote value / action |
| 4 | `external_nullifier` | `Poseidon(poll_id, 0)` — scope of the signal |

### Move verification

```move
use sui::groth16;

// 1. Prepare verifying key (from trusted setup, done once)
let curve = groth16::bn254();
let pvk = groth16::prepare_verifying_key(&curve, &vk_bytes);

// 2. Public inputs from identity.json → groth16_inputs.concatenated_le
let public_inputs = groth16::public_proof_inputs_from_bytes(
    x"f34f3d8b...0e00d"  // 128 bytes LE from identity.json
);

// 3. Proof points from Groth16 prover (snarkjs / circom)
let proof = groth16::proof_points_from_bytes(proof_bytes);

// 4. Verify
assert!(groth16::verify_groth16_proof(&curve, &pvk, &public_inputs, &proof));
```

### Nullifier check (prevent double-voting)

```move
// On-chain: store used nullifier_hashes in a Table
let nullifier_hash = /* from public_inputs bytes 32..64 */;
assert!(!table::contains(&used_nullifiers, nullifier_hash));
table::add(&mut used_nullifiers, nullifier_hash, true);
```

---

## Identity Blob Format (`identity.json`)

```json
{
  "identity_secret": "05f794...",
  "identity_nullifier": "23dedb...",
  "identity_commitment": "23bd3b...",
  "address": "0xde03f5...",
  "merkle_root": "11951d...",
  "merkle_path": [
    { "hash": "a1b2c3...", "hash_le": "c3b2a1...", "position": "right" },
    { "hash": "d4e5f6...", "hash_le": "f6e5d4...", "position": "left" }
  ],
  "leaf_index": 0,
  "tree_depth": 2,
  "poll_info": {
    "poll_id": "dao_vote_001",
    "title": "DAO Vote #1",
    "total_members": 3
  },
  "groth16_inputs": {
    "merkle_root_le": "f34f3d...",
    "nullifier_hash_le": "5e4ad6...",
    "signal_hash_le": "10c782...",
    "external_nullifier_le": "0a852e...",
    "concatenated_le": "f34f3d...0e00d"
  },
  "bn254_modulus": "21888242871839275222246405745257275088548364400416034343698204186575808495617"
}
```

**Security:** `identity_secret` là bí mật — ai có file này có thể tạo proof. Không share.

---

## Rust WASM Crate

### Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `light-poseidon` | 0.2 | Poseidon hash (Circom-compatible) |
| `ark-bn254` | 0.4 | BN254 field arithmetic |
| `ark-ff` | 0.4 | Field element operations |
| `getrandom` | 0.3 + `wasm_js` | Cryptographic randomness in WASM |
| `serde` + `serde-wasm-bindgen` | — | JS ↔ Rust serialization |

### Exported Functions

| Function | Input | Output |
|----------|-------|--------|
| `build_merkle_tree(addresses, poll_id, title, signal)` | JS array + strings | `MerkleResult` with identities |
| `verify_proof(commitment_hex, proof, root)` | hex strings + JS array | `boolean` |

### Build

```bash
cd plugins/sui-zk-merkle/wasm
wasm-pack build --target web --release --out-dir ../pkg
# Output: 155KB .wasm
```

---

## Tại sao Poseidon thay vì SHA-256?

| | SHA-256 | Poseidon BN254 |
|---|---------|----------------|
| Groth16 circuit | ~25,000 constraints per hash | ~250 constraints per hash |
| On-chain verify | Không có `sui::sha256_merkle` | `sui::poseidon::poseidon_bn254()` native |
| Circom/snarkjs | Không tương thích | Tương thích trực tiếp |
| Field | Arbitrary bytes | BN254 scalar field (< modulus) |

Poseidon được thiết kế cho ZK circuits — 100x ít constraints hơn SHA-256, và Sui có native support.

---

## Full Pipeline: Off-chain → On-chain

```
1. Admin: nhập addresses → plugin build Merkle tree → publish root on-chain
2. Admin: distribute identity.json cho mỗi member (private)
3. Member: load identity.json → generate Groth16 proof (snarkjs/circom)
4. Member: submit proof + public_inputs on-chain
5. Contract: groth16::verify_groth16_proof() + check nullifier not used
6. Contract: execute action (vote, claim, etc.)
```

Step 3 (Groth16 proof generation) cần Circom circuit — nằm ngoài scope plugin này. Plugin chỉ handle step 1-2 (tree building + identity generation).
