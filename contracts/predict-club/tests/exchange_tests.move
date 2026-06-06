#[test_only]
module predict_club::exchange_tests {
    use sui::test_scenario;
    use sui::coin;
    use sui::sui::SUI;
    use predict_club::exchange::{Self, ClubEscrowMarket, EscrowOffer};

    // Use SUI as both OfferT and WantT for testing (in prod these would be USDC/DUSDC)
    const LEADER: address = @0x1;
    const MEMBER: address = @0x2;

    #[test]
    fun test_create_and_fill_offer() {
        let mut scenario = test_scenario::begin(LEADER);
        // Create market
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        // Create offer
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::none(),
                option::none(),
                5,
                scenario.ctx(),
            );
            assert!(offer.offer_amount() == 1000);
            assert!(offer.offer_want_amount() == 500);
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        // Fill offer
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(500, scenario.ctx());
            exchange::fill_offer(&market, offer, payment, scenario.ctx());
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    fun test_cancel_offer() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::none(),
                option::none(),
                5,
                scenario.ctx(),
            );
            exchange::cancel_offer(&market, offer, scenario.ctx());
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 102)] // EWrongRecipient
    fun test_wrong_recipient_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        let specific_recipient = @0x3;
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::some(specific_recipient),
                option::none(),
                5,
                scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        // Wrong person tries to fill
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(500, scenario.ctx());
            exchange::fill_offer(&market, offer, payment, scenario.ctx());
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 104)] // EUnderpayment
    fun test_underpayment_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::none(),
                option::none(),
                5,
                scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            let payment = coin::mint_for_testing<SUI>(100, scenario.ctx()); // too little
            exchange::fill_offer(&market, offer, payment, scenario.ctx());
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 103)] // EMarketPaused
    fun test_paused_market_blocks_create() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let mut market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            exchange::set_paused(&mut market, true, scenario.ctx());
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::none(),
                option::none(),
                5,
                scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = 100)] // ENotMaker
    fun test_non_maker_cancel_fails() {
        let mut scenario = test_scenario::begin(LEADER);
        {
            let club_id = object::id_from_address(@0x1);
            exchange::create_market(club_id, scenario.ctx());
        };
        scenario.next_tx(LEADER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer_coin = coin::mint_for_testing<SUI>(1000, scenario.ctx());
            let offer = exchange::create_offer<SUI, SUI>(
                &market,
                offer_coin,
                500,
                option::none(),
                option::none(),
                5,
                scenario.ctx(),
            );
            transfer::public_transfer(offer, LEADER);
            test_scenario::return_shared(market);
        };
        // Non-maker tries to cancel
        scenario.next_tx(MEMBER);
        {
            let market = test_scenario::take_shared<ClubEscrowMarket>(&scenario);
            let offer = test_scenario::take_from_address<EscrowOffer<SUI, SUI>>(&scenario, LEADER);
            exchange::cancel_offer(&market, offer, scenario.ctx());
            test_scenario::return_shared(market);
        };
        scenario.end();
    }
}
