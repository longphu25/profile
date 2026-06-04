/// Token-gated Seal access policy for encrypted Walrus uploads.
/// Only holders of a specific coin type (NFT, token) can decrypt.
///
/// Identity format: `id = gate_object_id_bytes ++ nonce`
/// Admin creates a Gate specifying the required coin type.
/// Decryptor must present a coin of that type to prove ownership.
module seal_policy::token_gate;

use sui::coin::Coin;

const ENoAccess: u64 = 0;
const EInvalidId: u64 = 1;
const EInsufficientBalance: u64 = 2;

/// Shared gate object — defines which coin type grants access.
public struct Gate<phantom T> has key {
    id: UID,
    admin: address,
    name: vector<u8>,
    /// Minimum balance required (0 = just hold any amount)
    min_balance: u64,
}

/// Create a token gate. Anyone holding coin type T with >= min_balance can decrypt.
public fun create<T>(name: vector<u8>, min_balance: u64, ctx: &mut TxContext) {
    let gate = Gate<T> {
        id: object::new(ctx),
        admin: ctx.sender(),
        name,
        min_balance,
    };
    transfer::share_object(gate);
}

/// Called by Seal key servers via dry-run.
/// Grants access if caller holds a coin of type T with sufficient balance.
/// `id` must start with the gate's object ID.
entry fun seal_approve<T>(id: vector<u8>, gate: &Gate<T>, coin: &Coin<T>) {
    let gate_id_bytes = object::id(gate).to_bytes();
    assert!(is_prefix(gate_id_bytes, id), EInvalidId);
    assert!(coin.value() >= gate.min_balance, EInsufficientBalance);
}

/// Get minimum balance required.
public fun min_balance<T>(gate: &Gate<T>): u64 {
    gate.min_balance
}

/// Update minimum balance (admin only).
public fun set_min_balance<T>(gate: &mut Gate<T>, new_min: u64, ctx: &TxContext) {
    assert!(gate.admin == ctx.sender(), ENoAccess);
    gate.min_balance = new_min;
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
