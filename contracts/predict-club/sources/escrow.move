#[allow(lint(self_transfer))]
module predict_club::escrow {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;

    // === Errors ===
    const ENotDepositor: u64 = 1;
    const EAlreadyReleased: u64 = 2;
    const ENotApprover: u64 = 3;
    const EAlreadyApproved: u64 = 4;
    const EStillLocked: u64 = 5;
    const ENotApproved: u64 = 6;
    const ETooLateToCancel: u64 = 7;
    const EZeroAmount: u64 = 8;

    // === Types ===

    /// Generic time-locked escrow for any coin type T
    public struct Escrow<phantom T> has key {
        id: UID,
        escrow_address: address,
        depositor: address,
        beneficiary: address,
        amount: u64,
        locked_until_epoch: u64,
        created_at_epoch: u64,
        created_at_timestamp: u64,
        release_conditions: u8, // 0: Time only, 1: Time + Approval
        approver: address,
        approved: bool,
        released: bool,
        balance: Balance<T>,
    }

    /// Audit receipt after release
    public struct ReleaseReceipt has key, store {
        id: UID,
        escrow_id: address,
        released_to: address,
        amount: u64,
        released_at_epoch: u64,
        released_at_timestamp: u64,
    }

    /// Capability for the designated approver
    public struct ApproverCap has key, store {
        id: UID,
        escrow_id: address,
    }

    // === Events ===

    public struct EscrowCreated has copy, drop {
        escrow_id: address,
        depositor: address,
        beneficiary: address,
        locked_until_epoch: u64,
        release_conditions: u8,
    }

    public struct EscrowReleased has copy, drop {
        escrow_id: address,
        beneficiary: address,
        amount: u64,
        epoch: u64,
    }

    public struct EscrowCancelled has copy, drop {
        escrow_id: address,
        depositor: address,
        refunded: u64,
    }

    // === Public Functions ===

    /// Create a time-locked escrow for any coin type T.
    /// release_conditions: 0 = time only, 1 = time + approval
    public fun create_escrow<T>(
        beneficiary: address,
        lock_duration_epochs: u64,
        release_conditions: u8,
        approver: address,
        ctx: &mut TxContext,
    ) {
        let depositor = ctx.sender();
        let current_epoch = ctx.epoch();
        let current_timestamp = ctx.epoch_timestamp_ms();
        let escrow_address = ctx.fresh_object_address();

        let escrow = Escrow<T> {
            id: object::new(ctx),
            escrow_address,
            depositor,
            beneficiary,
            amount: 0,
            locked_until_epoch: current_epoch + lock_duration_epochs,
            created_at_epoch: current_epoch,
            created_at_timestamp: current_timestamp,
            release_conditions,
            approver,
            approved: false,
            released: false,
            balance: balance::zero<T>(),
        };

        event::emit(EscrowCreated {
            escrow_id: escrow_address,
            depositor,
            beneficiary,
            locked_until_epoch: current_epoch + lock_duration_epochs,
            release_conditions,
        });

        if (release_conditions == 1) {
            let cap = ApproverCap { id: object::new(ctx), escrow_id: escrow_address };
            transfer::transfer(cap, approver);
        };

        transfer::share_object(escrow);
    }

    /// Deposit coin into the escrow. Only depositor, before release.
    public fun deposit<T>(
        escrow: &mut Escrow<T>,
        coin: Coin<T>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == escrow.depositor, ENotDepositor);
        assert!(!escrow.released, EAlreadyReleased);
        let value = coin.value();
        assert!(value > 0, EZeroAmount);

        escrow.balance.join(coin.into_balance());
        escrow.amount = escrow.amount + value;
    }

    /// Approve the escrow release. Requires ApproverCap.
    public fun approve_release<T>(
        cap: &ApproverCap,
        escrow: &mut Escrow<T>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == escrow.approver, ENotApprover);
        assert!(cap.escrow_id == escrow.escrow_address, ENotApprover);
        assert!(!escrow.approved, EAlreadyApproved);
        assert!(!escrow.released, EAlreadyReleased);
        escrow.approved = true;
    }

    /// Release funds to beneficiary once conditions are met.
    public fun release_funds<T>(
        escrow: &mut Escrow<T>,
        ctx: &mut TxContext,
    ) {
        let current_epoch = ctx.epoch();
        assert!(!escrow.released, EAlreadyReleased);
        assert!(current_epoch >= escrow.locked_until_epoch, EStillLocked);
        if (escrow.release_conditions == 1) {
            assert!(escrow.approved, ENotApproved);
        };

        let amount = escrow.balance.value();
        let coin = coin::from_balance(escrow.balance.split(amount), ctx);
        escrow.released = true;

        let receipt = ReleaseReceipt {
            id: object::new(ctx),
            escrow_id: escrow.escrow_address,
            released_to: escrow.beneficiary,
            amount,
            released_at_epoch: current_epoch,
            released_at_timestamp: ctx.epoch_timestamp_ms(),
        };

        transfer::public_transfer(coin, escrow.beneficiary);
        transfer::public_transfer(receipt, escrow.beneficiary);

        event::emit(EscrowReleased {
            escrow_id: escrow.escrow_address,
            beneficiary: escrow.beneficiary,
            amount,
            epoch: current_epoch,
        });
    }

    /// Emergency cancellation by depositor (at least 1 epoch before unlock).
    public fun cancel_escrow<T>(
        escrow: &mut Escrow<T>,
        ctx: &mut TxContext,
    ) {
        let current_epoch = ctx.epoch();
        let depositor = ctx.sender();

        assert!(depositor == escrow.depositor, ENotDepositor);
        assert!(!escrow.released, EAlreadyReleased);
        assert!(current_epoch + 1 < escrow.locked_until_epoch, ETooLateToCancel);

        let amount = escrow.balance.value();
        escrow.released = true;

        if (amount > 0) {
            let coin = coin::from_balance(escrow.balance.split(amount), ctx);
            transfer::public_transfer(coin, depositor);
        };

        event::emit(EscrowCancelled { escrow_id: escrow.escrow_address, depositor, refunded: amount });
    }

    // === View Functions ===

    public fun is_ready_to_release<T>(escrow: &Escrow<T>, current_epoch: u64): bool {
        if (escrow.released) return false;
        if (current_epoch < escrow.locked_until_epoch) return false;
        if (escrow.release_conditions == 1 && !escrow.approved) return false;
        true
    }

    public fun epochs_until_unlock<T>(escrow: &Escrow<T>, current_epoch: u64): u64 {
        if (current_epoch >= escrow.locked_until_epoch) 0
        else escrow.locked_until_epoch - current_epoch
    }

    // === Accessors ===

    public fun escrow_address<T>(e: &Escrow<T>): address { e.escrow_address }
    public fun depositor<T>(e: &Escrow<T>): address { e.depositor }
    public fun beneficiary<T>(e: &Escrow<T>): address { e.beneficiary }
    public fun amount<T>(e: &Escrow<T>): u64 { e.amount }
    public fun locked_until_epoch<T>(e: &Escrow<T>): u64 { e.locked_until_epoch }
    public fun release_conditions<T>(e: &Escrow<T>): u8 { e.release_conditions }
    public fun approver_addr<T>(e: &Escrow<T>): address { e.approver }
    public fun approved<T>(e: &Escrow<T>): bool { e.approved }
    public fun released<T>(e: &Escrow<T>): bool { e.released }
    public fun balance_value<T>(e: &Escrow<T>): u64 { e.balance.value() }
    public fun receipt_amount(r: &ReleaseReceipt): u64 { r.amount }
    public fun receipt_released_to(r: &ReleaseReceipt): address { r.released_to }
}
