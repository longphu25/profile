/// Private Seal access policy — only the owner can decrypt.
///
/// Identity format: `id = bcs::to_bytes(&owner_address)`
/// Simplest policy: encrypt for yourself.
module seal_policy::private;

use sui::bcs;

const ENoAccess: u64 = 0;

/// Called by Seal key servers via dry-run.
/// Grants access only if caller == address encoded in `id`.
entry fun seal_approve(id: vector<u8>, ctx: &TxContext) {
    assert!(id == bcs::to_bytes(&ctx.sender()), ENoAccess);
}
