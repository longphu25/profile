/// Allowlist-based Seal access policy for encrypted Walrus uploads.
/// Admin creates an allowlist, adds/removes members.
/// Only members on the list can decrypt blobs encrypted with this policy.
///
/// Identity format: `id = allowlist_object_id_bytes ++ nonce`
/// The nonce allows multiple blobs per allowlist (each blob has unique identity).
module seal_policy::allowlist;

const ENoAccess: u64 = 0;
const EInvalidId: u64 = 1;
const ENotAdmin: u64 = 2;

/// Shared allowlist — stores admin + member addresses.
public struct Allowlist has key {
    id: UID,
    admin: address,
    name: vector<u8>,
    members: vector<address>,
}

/// Admin capability — proves ownership of an allowlist.
public struct AdminCap has key, store {
    id: UID,
    allowlist_id: ID,
}

// ── Admin functions ──

/// Create a new allowlist. Caller becomes admin.
public fun create(name: vector<u8>, ctx: &mut TxContext) {
    let allowlist = Allowlist {
        id: object::new(ctx),
        admin: ctx.sender(),
        name,
        members: vector[],
    };
    let cap = AdminCap {
        id: object::new(ctx),
        allowlist_id: object::id(&allowlist),
    };
    transfer::share_object(allowlist);
    transfer::transfer(cap, ctx.sender());
}

/// Add a member. Requires AdminCap.
public fun add_member(
    allowlist: &mut Allowlist,
    cap: &AdminCap,
    member: address,
) {
    assert!(cap.allowlist_id == object::id(allowlist), ENotAdmin);
    if (!allowlist.members.contains(&member)) {
        allowlist.members.push_back(member);
    };
}

/// Batch add members.
public fun add_members(
    allowlist: &mut Allowlist,
    cap: &AdminCap,
    members: vector<address>,
) {
    assert!(cap.allowlist_id == object::id(allowlist), ENotAdmin);
    let mut i = 0;
    while (i < members.length()) {
        let m = members[i];
        if (!allowlist.members.contains(&m)) {
            allowlist.members.push_back(m);
        };
        i = i + 1;
    };
}

/// Remove a member.
public fun remove_member(
    allowlist: &mut Allowlist,
    cap: &AdminCap,
    member: address,
) {
    assert!(cap.allowlist_id == object::id(allowlist), ENotAdmin);
    let (found, idx) = allowlist.members.index_of(&member);
    if (found) {
        allowlist.members.remove(idx);
    };
}

// ── Seal integration ──

/// Called by Seal key servers via dry-run.
/// Grants decryption access if caller is on the allowlist.
/// `id` must start with the allowlist's object ID (32 bytes), followed by optional nonce.
entry fun seal_approve(id: vector<u8>, allowlist: &Allowlist, ctx: &TxContext) {
    let allowlist_id_bytes = object::id(allowlist).to_bytes();
    assert!(is_prefix(allowlist_id_bytes, id), EInvalidId);
    assert!(allowlist.members.contains(&ctx.sender()), ENoAccess);
}

// ── View functions ──

/// Check if an address is a member.
public fun is_member(allowlist: &Allowlist, addr: address): bool {
    allowlist.members.contains(&addr)
}

/// Get member count.
public fun member_count(allowlist: &Allowlist): u64 {
    allowlist.members.length()
}

/// Get allowlist name.
public fun name(allowlist: &Allowlist): vector<u8> {
    allowlist.name
}

// ── Internal ──

fun is_prefix(prefix: vector<u8>, data: vector<u8>): bool {
    if (prefix.length() > data.length()) return false;
    let mut i = 0;
    while (i < prefix.length()) {
        if (prefix[i] != data[i]) return false;
        i = i + 1;
    };
    true
}
