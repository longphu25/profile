#[test_only]
module predict_club::exchange_tests {
    use sui::test_scenario;
    use sui::coin;
    use sui::sui::SUI;
    use predict_club::exchange::{Self, ClubEscrowMarket, EscrowOffer};

    const LEADER: address = @0x1;
    const MEMBER: address = @0x2;

    #[test]
    fun test_create_and_fill_offer() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            assert!(offer.offer_amount() == 1000);
            assert!(offer.want_amount() == 500);
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(500, scenario.ctx());
            let (received, change) = exchange::fill_offer(&market, offer, payment, scenario.ctx());
            assert!(received.value() == 1000);
            assert!(change.value() == 0);
            transfer::public_transfer(received, MEMBER);
            change.destroy_zero();
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    fun test_fill_with_overpayment() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(800, scenario.ctx()); // overpay
            let (received, change) = exchange::fill_offer(&market, offer, payment, scenario.ctx());
            assert!(received.value() == 1000);
            assert!(change.value() == 300); // 800 - 500 = 300 change
            transfer::public_transfer(received, MEMBER);
            transfer::public_transfer(change, MEMBER);
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    fun test_cancel_offer() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            let refund = exchange::cancel_offer(&market, offer, scenario.ctx());
            assert!(refund.value() == 1000);
            transfer::public_transfer(refund, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = exchange::EWrongRecipient)]
    fun test_wrong_recipient_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::some(@0x3), option::none(), 5, scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER); // MEMBER != @0x3
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(500, scenario.ctx());
            let (coin, change) = exchange::fill_offer(&market, offer, payment, scenario.ctx());
            transfer::public_transfer(coin, MEMBER);
            change.destroy_zero();
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = exchange::EUnderpayment)]
    fun test_underpayment_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(100, scenario.ctx()); // too little
            let (coin, change) = exchange::fill_offer(&market, offer, payment, scenario.ctx());
            transfer::public_transfer(coin, MEMBER);
            change.destroy_zero();
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = exchange::EMarketPaused)]
    fun test_paused_market_blocks_create() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let mut market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            exchange::set_paused(&mut market, true, scenario.ctx());
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = exchange::ENotMaker)]
    fun test_non_maker_cancel_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x10);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market, offer_coin, 500, option::none(), option::none(), 5, scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let refund = exchange::cancel_offer(&market, offer, scenario.ctx());
            transfer::public_transfer(refund, MEMBER);
            test_scenario::return_shared(market);
        };
        scenario.end();
    }
}
