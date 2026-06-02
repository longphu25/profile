use ark_bn254::Fr;
use ark_ff::{BigInteger256, PrimeField};
use getrandom::fill;
use light_poseidon::{Poseidon, PoseidonHasher};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ── BN254 Field Helpers ──

const BN254_MODULUS: &str =
    "21888242871839275222246405745257275088548364400416034343698204186575808495617";

fn fr_from_bytes_be(bytes: &[u8; 32]) -> Fr {
    // Convert big-endian bytes to ark Fr (little-endian internal)
    let mut le = *bytes;
    le.reverse();
    Fr::from_le_bytes_mod_order(&le)
}

fn fr_to_bytes_le(f: &Fr) -> [u8; 32] {
    let bigint: BigInteger256 = f.into_bigint();
    let mut out = [0u8; 32];
    for (i, limb) in bigint.0.iter().enumerate() {
        out[i * 8..(i + 1) * 8].copy_from_slice(&limb.to_le_bytes());
    }
    out
}

fn fr_to_bytes_be(f: &Fr) -> [u8; 32] {
    let mut le = fr_to_bytes_le(f);
    le.reverse();
    le
}

fn fr_to_hex(f: &Fr) -> String {
    hex_encode(&fr_to_bytes_be(f))
}

fn fr_to_decimal(f: &Fr) -> String {
    let bigint: BigInteger256 = f.into_bigint();
    // Convert limbs to decimal string
    let mut val = [0u64; 4];
    val.copy_from_slice(&bigint.0);
    // Use ark's Display
    format!("{}", f.into_bigint())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Vec<u8> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    (0..s.len())
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

// ── Poseidon Hash (BN254) ──

fn poseidon_hash2(a: &Fr, b: &Fr) -> Fr {
    let mut hasher = Poseidon::<Fr>::new_circom(2).unwrap();
    hasher.hash(&[*a, *b]).unwrap()
}

fn poseidon_hash3(a: &Fr, b: &Fr, c: &Fr) -> Fr {
    let mut hasher = Poseidon::<Fr>::new_circom(3).unwrap();
    hasher.hash(&[*a, *b, *c]).unwrap()
}

fn poseidon_hash4(a: &Fr, b: &Fr, c: &Fr, d: &Fr) -> Fr {
    let mut hasher = Poseidon::<Fr>::new_circom(4).unwrap();
    hasher.hash(&[*a, *b, *c, *d]).unwrap()
}

// ── Merkle Tree (Poseidon) ──

fn hash_node(left: &Fr, right: &Fr) -> Fr {
    // Sorted: canonical ordering for deterministic tree
    if fr_to_bytes_be(left) <= fr_to_bytes_be(right) {
        poseidon_hash2(left, right)
    } else {
        poseidon_hash2(right, left)
    }
}

fn build_tree(leaves: &[Fr]) -> Vec<Vec<Fr>> {
    if leaves.is_empty() {
        return vec![vec![]];
    }
    let mut layers: Vec<Vec<Fr>> = vec![leaves.to_vec()];
    let mut current = leaves.to_vec();
    while current.len() > 1 {
        if current.len() % 2 != 0 {
            current.push(*current.last().unwrap());
        }
        let next: Vec<Fr> = current.chunks(2).map(|p| hash_node(&p[0], &p[1])).collect();
        layers.push(next.clone());
        current = next;
    }
    layers
}

fn get_proof(layers: &[Vec<Fr>], index: usize) -> Vec<MerklePathNode> {
    let mut proof = Vec::new();
    let mut idx = index;
    for layer in &layers[..layers.len().saturating_sub(1)] {
        let sib_idx = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
        let sibling = if sib_idx < layer.len() {
            layer[sib_idx]
        } else {
            layer[idx]
        };
        proof.push(MerklePathNode {
            hash: fr_to_hex(&sibling),
            hash_le: hex_encode(&fr_to_bytes_le(&sibling)),
            position: if idx % 2 == 0 { "right" } else { "left" }.into(),
        });
        idx /= 2;
    }
    proof
}

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
pub struct MerklePathNode {
    /// Sibling hash (big-endian hex)
    pub hash: String,
    /// Sibling hash (little-endian hex, for sui::groth16 public_proof_inputs)
    pub hash_le: String,
    /// "left" or "right"
    pub position: String,
}

#[derive(Serialize, Deserialize)]
pub struct Groth16PublicInputs {
    /// merkle_root as 32-byte LE hex (for public_proof_inputs_from_bytes)
    pub merkle_root_le: String,
    /// nullifier_hash as 32-byte LE hex
    pub nullifier_hash_le: String,
    /// signal_hash as 32-byte LE hex
    pub signal_hash_le: String,
    /// external_nullifier as 32-byte LE hex
    pub external_nullifier_le: String,
    /// Concatenated 128 bytes (4 × 32) ready for sui::groth16::public_proof_inputs_from_bytes
    pub concatenated_le: String,
    /// Decimal representations for sui::poseidon verification
    pub merkle_root_decimal: String,
    pub nullifier_hash_decimal: String,
}

#[derive(Serialize, Deserialize)]
pub struct IdentityBlob {
    /// Random 32-byte secret (BN254 field element, hex BE)
    pub identity_secret: String,
    /// Poseidon(identity_secret) — the identity nullifier
    pub identity_nullifier: String,
    /// Poseidon(identity_nullifier, identity_secret) — the identity commitment (leaf)
    pub identity_commitment: String,
    /// Wallet address
    pub address: String,
    /// Merkle root (hex BE)
    pub merkle_root: String,
    /// Sibling path from leaf to root
    pub merkle_path: Vec<MerklePathNode>,
    /// Leaf index
    pub leaf_index: u32,
    /// Merkle tree depth
    pub tree_depth: u32,
    /// Poll/group metadata
    pub poll_info: PollInfo,
    /// Groth16-ready public inputs for on-chain verification
    pub groth16_inputs: Groth16PublicInputs,
    /// BN254 field modulus (for reference)
    pub bn254_modulus: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PollInfo {
    pub poll_id: String,
    pub title: String,
    pub total_members: u32,
}

#[derive(Serialize, Deserialize)]
pub struct MerkleResult {
    pub root: String,
    pub root_le: String,
    pub root_decimal: String,
    pub leaf_count: u32,
    pub tree_depth: u32,
    pub commitments: Vec<String>,
    pub identities: Vec<IdentityBlob>,
}

// ── WASM Exports ──

/// Build Poseidon Merkle tree from addresses.
/// Generates Semaphore-compatible identity blobs with Groth16 public inputs.
#[wasm_bindgen]
pub fn build_merkle_tree(
    addresses_js: JsValue,
    poll_id: &str,
    poll_title: &str,
    signal: &str,
) -> JsValue {
    let addresses: Vec<String> = serde_wasm_bindgen::from_value(addresses_js).unwrap_or_default();
    if addresses.is_empty() {
        return serde_wasm_bindgen::to_value(&MerkleResult {
            root: String::new(),
            root_le: String::new(),
            root_decimal: String::new(),
            leaf_count: 0,
            tree_depth: 0,
            commitments: vec![],
            identities: vec![],
        })
        .unwrap();
    }

    let poll_info = PollInfo {
        poll_id: poll_id.into(),
        title: poll_title.into(),
        total_members: addresses.len() as u32,
    };

    // external_nullifier = Poseidon(poll_id as field element)
    let poll_id_bytes = poll_id.as_bytes();
    let mut poll_field_bytes = [0u8; 32];
    let copy_len = poll_id_bytes.len().min(31); // keep < modulus
    poll_field_bytes[32 - copy_len..].copy_from_slice(&poll_id_bytes[..copy_len]);
    let external_nullifier_field = fr_from_bytes_be(&poll_field_bytes);
    let external_nullifier = poseidon_hash2(&external_nullifier_field, &Fr::from(0u64));

    // signal_hash = Poseidon(signal as field element)
    let sig_bytes = signal.as_bytes();
    let mut sig_field_bytes = [0u8; 32];
    let sig_len = sig_bytes.len().min(31);
    sig_field_bytes[32 - sig_len..].copy_from_slice(&sig_bytes[..sig_len]);
    let signal_field = fr_from_bytes_be(&sig_field_bytes);
    let signal_hash = poseidon_hash2(&signal_field, &Fr::from(0u64));

    // Generate identity for each address
    // Semaphore identity: secret → nullifier = Poseidon(secret), commitment = Poseidon(nullifier, secret)
    let mut secrets: Vec<Fr> = Vec::new();
    let mut nullifiers: Vec<Fr> = Vec::new();
    let mut commitments: Vec<Fr> = Vec::new();

    for _addr in &addresses {
        let mut secret_bytes = [0u8; 32];
        fill(&mut secret_bytes).unwrap();
        // Reduce mod BN254 to ensure valid field element
        let secret = fr_from_bytes_be(&secret_bytes);
        let nullifier = poseidon_hash2(&secret, &Fr::from(0u64));
        let commitment = poseidon_hash2(&nullifier, &secret);
        secrets.push(secret);
        nullifiers.push(nullifier);
        commitments.push(commitment);
    }

    // Build Poseidon Merkle tree
    let layers = build_tree(&commitments);
    let root = layers
        .last()
        .and_then(|l| l.first())
        .copied()
        .unwrap_or(Fr::from(0u64));
    let tree_depth = layers.len().saturating_sub(1) as u32;

    // Generate identity blobs
    let identities: Vec<IdentityBlob> = addresses
        .iter()
        .enumerate()
        .map(|(i, addr)| {
            let proof = get_proof(&layers, i);

            // nullifier_hash = Poseidon(external_nullifier, identity_nullifier)
            let nullifier_hash = poseidon_hash2(&external_nullifier, &nullifiers[i]);

            // Groth16 public inputs: 4 × 32-byte LE scalars concatenated
            let root_le = fr_to_bytes_le(&root);
            let null_hash_le = fr_to_bytes_le(&nullifier_hash);
            let signal_hash_le = fr_to_bytes_le(&signal_hash);
            let ext_null_le = fr_to_bytes_le(&external_nullifier);

            let mut concat = Vec::with_capacity(128);
            concat.extend_from_slice(&root_le);
            concat.extend_from_slice(&null_hash_le);
            concat.extend_from_slice(&signal_hash_le);
            concat.extend_from_slice(&ext_null_le);

            IdentityBlob {
                identity_secret: fr_to_hex(&secrets[i]),
                identity_nullifier: fr_to_hex(&nullifiers[i]),
                identity_commitment: fr_to_hex(&commitments[i]),
                address: addr.clone(),
                merkle_root: fr_to_hex(&root),
                merkle_path: proof,
                leaf_index: i as u32,
                tree_depth,
                poll_info: poll_info.clone(),
                groth16_inputs: Groth16PublicInputs {
                    merkle_root_le: hex_encode(&root_le),
                    nullifier_hash_le: hex_encode(&null_hash_le),
                    signal_hash_le: hex_encode(&signal_hash_le),
                    external_nullifier_le: hex_encode(&ext_null_le),
                    concatenated_le: hex_encode(&concat),
                    merkle_root_decimal: fr_to_decimal(&root),
                    nullifier_hash_decimal: fr_to_decimal(&nullifier_hash),
                },
                bn254_modulus: BN254_MODULUS.into(),
            }
        })
        .collect();

    let result = MerkleResult {
        root: fr_to_hex(&root),
        root_le: hex_encode(&fr_to_bytes_le(&root)),
        root_decimal: fr_to_decimal(&root),
        leaf_count: addresses.len() as u32,
        tree_depth,
        commitments: commitments.iter().map(|c| fr_to_hex(c)).collect(),
        identities,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Verify Merkle proof: recompute root from commitment + path using Poseidon.
#[wasm_bindgen]
pub fn verify_proof(commitment_hex: &str, proof_js: JsValue, expected_root: &str) -> bool {
    let proof: Vec<MerklePathNode> = serde_wasm_bindgen::from_value(proof_js).unwrap_or_default();
    let commit_bytes = hex_decode(commitment_hex);
    if commit_bytes.len() != 32 {
        return false;
    }
    let mut bytes32 = [0u8; 32];
    bytes32.copy_from_slice(&commit_bytes);
    let mut current = fr_from_bytes_be(&bytes32);

    for node in &proof {
        let sib_bytes = hex_decode(&node.hash);
        if sib_bytes.len() != 32 {
            return false;
        }
        let mut sib32 = [0u8; 32];
        sib32.copy_from_slice(&sib_bytes);
        let sibling = fr_from_bytes_be(&sib32);
        current = hash_node(&current, &sibling);
    }

    fr_to_hex(&current) == expected_root
}
