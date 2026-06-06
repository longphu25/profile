#[test_only]
module predict_club::escrow_tests {
    use sui::test_scenario;
    use sui::coin;
    use sui::sui::SUI;
    use predict_club::escrow::{Self, Escrow, ApproverCap, ReleaseReceipt};

    const DEPOSITOR: address = @0xD;
    const BENEFICIARY: address = @0xB;
    const APPROVER: address = @0xA1;

    #[test]
    fun test_create_escrow_time_only() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 10, 0, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            assert!(e.depositor() == DEPOSITOR);
            assert!(e.beneficiary() == BENEFICIARY);
            assert!(e.locked_until_epoch() == 10);
            assert!(e.release_conditions() == 0);
            assert!(!e.approved());
            assert!(!e.released());
            test_scenario::return_shared(e);
        };
        scenario.end();
    }

    #[test]
    fun test_deposit_and_approve() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 5, 1, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            escrow::deposit(&mut e, coin, scenario.ctx());
            assert!(e.amount() == 1000);
            assert!(e.balance_value() == 1000);
            test_scenario::return_shared(e);
        };
        scenario.next_tx(APPROVER);
        {
            let cap = test_scenario::take_from_address<ApproverCap>(&scenario, APPROVER);
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            escrow::approve_release(&cap, &mut e, scenario.ctx());
            assert!(e.approved());
            test_scenario::return_shared(e);
            test_scenario::return_to_address(APPROVER, cap);
        };
        scenario.end();
    }

    #[test]
    fun test_release_after_timelock() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 2, 1, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(500, scenario.ctx());
            escrow::deposit(&mut e, coin, scenario.ctx());
            test_scenario::return_shared(e);
        };
        scenario.next_tx(APPROVER);
        {
            let cap = test_scenario::take_from_address<ApproverCap>(&scenario, APPROVER);
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            escrow::approve_release(&cap, &mut e, scenario.ctx());
            test_scenario::return_shared(e);
            test_scenario::return_to_address(APPROVER, cap);
        };
        scenario.next_epoch(BENEFICIARY);
        scenario.next_epoch(BENEFICIARY);
        scenario.next_epoch(BENEFICIARY);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            escrow::release_funds(&mut e, scenario.ctx());
            assert!(e.released());
            test_scenario::return_shared(e);
        };
        scenario.next_tx(BENEFICIARY);
        {
            let r = test_scenario::take_from_address<ReleaseReceipt>(&scenario, BENEFICIARY);
            assert!(r.receipt_released_to() == BENEFICIARY);
            assert!(r.receipt_amount() == 500);
            test_scenario::return_to_address(BENEFICIARY, r);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 5)] // EStillLocked
    fun test_early_release_fails() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 10, 0, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(500, scenario.ctx());
            escrow::deposit(&mut e, coin, scenario.ctx());
            test_scenario::return_shared(e);
        };
        scenario.next_tx(BENEFICIARY);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            escrow::release_funds(&mut e, scenario.ctx());
            test_scenario::return_shared(e);
        };
        scenario.end();
    }

    #[test]
    fun test_cancel_returns_funds() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 10, 0, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(800, scenario.ctx());
            escrow::deposit(&mut e, coin, scenario.ctx());
            escrow::cancel_escrow(&mut e, scenario.ctx());
            assert!(e.released());
            assert!(e.balance_value() == 0);
            test_scenario::return_shared(e);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 6)] // ENotApproved
    fun test_release_without_approval_fails() {
        let mut scenario = test_scenario::begin(DEPOSITOR);
        {
            escrow::create_escrow<SUI>(BENEFICIARY, 2, 1, APPROVER, scenario.ctx());
        };
        scenario.next_tx(DEPOSITOR);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            let coin = coin::mint_for_testing<SUI>(100, scenario.ctx());
            escrow::deposit(&mut e, coin, scenario.ctx());
            test_scenario::return_shared(e);
        };
        scenario.next_epoch(BENEFICIARY);
        scenario.next_epoch(BENEFICIARY);
        scenario.next_epoch(BENEFICIARY);
        {
            let mut e = test_scenario::take_shared<Escrow<SUI>>(&scenario);
            escrow::release_funds(&mut e, scenario.ctx());
            test_scenario::return_shared(e);
        };
        scenario.end();
    }
}
