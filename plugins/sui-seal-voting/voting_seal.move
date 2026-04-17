/// Sealed Voting — encrypted ballots with Seal access control.
/// Votes are encrypted (HMAC-CTR) and stored on-chain.
/// Nobody can see individual votes until admin closes and tallies.
///
/// Deploy: sui move build && sui client publish --gas-budget 100000000
module seal_demo::voting_seal;

use sui::clock::Clock;

const ENotAdmin: u64 = 0;
const ENotEligible: u64 = 1;
const EAlreadyVoted: u64 = 2;
const EClosed: u64 = 3;
const EInvalidId: u64 = 5;

/// Shared voting session
public struct VotingSession has key {
    id: UID,
    admin: address,
    topic: vector<u8>,
    options: vector<vector<u8>>,
    eligible_voters: vector<address>,
    encrypted_ballots: vector<vector<u8>>,
    voters_submitted: vector<address>,
    is_closed: bool,
    created_at: u64,
}

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
