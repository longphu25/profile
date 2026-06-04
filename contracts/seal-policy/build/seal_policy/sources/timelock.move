/// Time-lock Seal access policy for encrypted Walrus uploads.
/// Data can only be decrypted after a specified timestamp.
///
/// Identity format: `id = bcs::to_bytes(&unlock_timestamp_ms)`
/// Encrypt with a future timestamp → blob is locked until that time.
module seal_policy::timelock;

use sui::bcs;
use sui::clock::Clock;

const ETooEarly: u64 = 0;
const EInvalidId: u64 = 1;

/// Called by Seal key servers via dry-run.
/// Grants access only if current time >= unlock time encoded in `id`.
entry fun seal_approve(id: vector<u8>, clock: &Clock) {
    let mut prepared = bcs::new(id);
    let unlock_time = prepared.peel_u64();
    let leftover = prepared.into_remainder_bytes();
    assert!(leftover.length() == 0, EInvalidId);
    assert!(clock.timestamp_ms() >= unlock_time, ETooEarly);
}
