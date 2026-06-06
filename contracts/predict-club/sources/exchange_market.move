#[allow(lint(self_transfer, coin_field))]
module predict_club::exchange {
    use sui::coin::Coin;
    use sui::event;

    // === Errors ===
    const ENotMaker: u64 = 100;
    const EOfferExpired: u64 = 101;
    const EWrongRecipient: u64 = 102;
    const EMarketPaused: u64 = 103;
    const EUnderpayment: u64 = 104;
    const EZeroAmount: u64 = 105;
    const EZeroExpiry: u64 = 106;
    const ENotAdmin: u64 = 107;

    // === Types ===

    /// Shared market registry for a club
    public struct ClubEscrowMarket has key {
        id: UID,
        club_id: ID,
        admin: address,
        paused: bool,
    }

    /// P2P offer: maker deposits Coin<OfferT>, wants Coin<WantT>
    public struct EscrowOffer<phantom OfferT, phantom WantT> has key, store {
        id: UID,
        maker: address,
        recipient: Option<address>,
        round_id: Option<ID>,
        offer_amount: u64,
        want_amount: u64,
        expires_at_epoch: u64,
        offer_coin: Coin<OfferT>,
    }

    // === Events ===

    public struct OfferCreated has copy, drop {
        offer_id: ID,
        maker: address,
        offer_amount: u64,
        want_amount: u64,
        expires_at_epoch: u64,
    }

    public struct OfferFilled has copy, drop {
        offer_id: ID,
        maker: address,
        filler: address,
        offer_amount: u64,
        want_amount: u64,
    }

    public struct OfferCancelled has copy, drop {
        offer_id: ID,
        maker: address,
        refunded: u64,
    }

    // === Public Functions ===

    /// Create a shared market for a club
    public fun create_market(club_id: ID, ctx: &mut TxContext) {
        let market = ClubEscrowMarket {
            id: object::new(ctx),
            club_id,
            admin: ctx.sender(),
            paused: false,
        };
        transfer::share_object(market);
    }

    /// Pause/unpause market (admin only)
    public fun set_paused(market: &mut ClubEscrowMarket, paused: bool, ctx: &TxContext) {
        assert!(ctx.sender() == market.admin, ENotAdmin);
        market.paused = paused;
    }

    /// Create a P2P offer
    public fun create_offer<OfferT, WantT>(
        market: &ClubEscrowMarket,
        offer_coin: Coin<OfferT>,
        want_amount: u64,
        recipient: Option<address>,
        round_id: Option<ID>,
        expires_in_epochs: u64,
        ctx: &mut TxContext,
    ): EscrowOffer<OfferT, WantT> {
        assert!(!market.paused, EMarketPaused);
        assert!(offer_coin.value() > 0, EZeroAmount);
        assert!(want_amount > 0, EZeroAmount);
        assert!(expires_in_epochs > 0, EZeroExpiry);

        let maker = ctx.sender();
        let offer_amount = offer_coin.value();
        let expires_at_epoch = ctx.epoch() + expires_in_epochs;

        let offer = EscrowOffer<OfferT, WantT> {
            id: object::new(ctx),
            maker,
            recipient,
            round_id,
            offer_amount,
            want_amount,
            expires_at_epoch,
            offer_coin,
        };

        event::emit(OfferCreated {
            offer_id: object::id(&offer),
            maker,
            offer_amount,
            want_amount,
            expires_at_epoch,
        });

        offer
    }

    /// Fill an offer. Filler pays want_amount, receives the offered coin.
    /// Overpayment returns change to filler.
    public fun fill_offer<OfferT, WantT>(
        market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        mut payment: Coin<WantT>,
        ctx: &mut TxContext,
    ) {
        assert!(!market.paused, EMarketPaused);
        assert!(ctx.epoch() <= offer.expires_at_epoch, EOfferExpired);

        if (offer.recipient.is_some()) {
            assert!(ctx.sender() == *offer.recipient.borrow(), EWrongRecipient);
        };

        assert!(payment.value() >= offer.want_amount, EUnderpayment);

        let offer_id = object::id(&offer);
        let maker = offer.maker;
        let filler = ctx.sender();
        let offer_amount = offer.offer_amount;
        let want_amount = offer.want_amount;

        // Split exact payment for maker
        if (payment.value() > want_amount) {
            let change_amount = payment.value() - want_amount;
            let change = payment.split(change_amount, ctx);
            transfer::public_transfer(change, filler);
        };

        // Destroy offer, extract coin
        let EscrowOffer { id, maker: _, recipient: _, round_id: _, offer_amount: _, want_amount: _, expires_at_epoch: _, offer_coin } = offer;
        object::delete(id);

        transfer::public_transfer(offer_coin, filler);
        transfer::public_transfer(payment, maker);

        event::emit(OfferFilled { offer_id, maker, filler, offer_amount, want_amount });
    }

    /// Cancel an offer. Only maker can cancel.
    public fun cancel_offer<OfferT, WantT>(
        _market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == offer.maker, ENotMaker);

        let offer_id = object::id(&offer);
        let maker = offer.maker;
        let refunded = offer.offer_amount;

        let EscrowOffer { id, maker: _, recipient: _, round_id: _, offer_amount: _, want_amount: _, expires_at_epoch: _, offer_coin } = offer;
        object::delete(id);

        transfer::public_transfer(offer_coin, maker);
        event::emit(OfferCancelled { offer_id, maker, refunded });
    }

    // === View Functions ===

    public fun is_expired<OfferT, WantT>(offer: &EscrowOffer<OfferT, WantT>, current_epoch: u64): bool {
        current_epoch > offer.expires_at_epoch
    }

    public fun can_fill<OfferT, WantT>(offer: &EscrowOffer<OfferT, WantT>, filler: address, current_epoch: u64): bool {
        if (current_epoch > offer.expires_at_epoch) return false;
        if (offer.recipient.is_some()) {
            return filler == *offer.recipient.borrow()
        };
        true
    }

    // === Accessors ===

    public fun market_paused(m: &ClubEscrowMarket): bool { m.paused }
    public fun offer_maker<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): address { o.maker }
    public fun offer_amount<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.offer_amount }
    public fun offer_want_amount<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.want_amount }
    public fun offer_expires_at<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.expires_at_epoch }
}
