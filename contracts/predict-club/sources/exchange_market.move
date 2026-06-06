#[allow(lint(self_transfer, coin_field))]
module predict_club::exchange {
    use sui::coin::{Self, Coin};
    use sui::event;

    // === Errors ===
    #[error]
    const ENotMaker: vector<u8> = b"Only the offer maker can cancel";
    #[error]
    const EOfferExpired: vector<u8> = b"Offer has expired";
    #[error]
    const EWrongRecipient: vector<u8> = b"Offer is restricted to a specific recipient";
    #[error]
    const EMarketPaused: vector<u8> = b"Market is paused";
    #[error]
    const EUnderpayment: vector<u8> = b"Payment is less than the required want_amount";
    #[error]
    const EZeroAmount: vector<u8> = b"Amount must be greater than zero";
    #[error]
    const EZeroExpiry: vector<u8> = b"Expiry must be at least 1 epoch";
    #[error]
    const ENotAdmin: vector<u8> = b"Only the market admin can perform this action";

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

    // === Events (past tense) ===

    public struct MarketCreated has copy, drop {
        market_id: ID,
        club_id: ID,
        admin: address,
    }

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

    // === Public Composable Functions ===

    /// Create a shared market for a club.
    public fun create_market(club_id: ID, ctx: &mut TxContext) {
        let market = ClubEscrowMarket {
            id: object::new(ctx),
            club_id,
            admin: ctx.sender(),
            paused: false,
        };

        event::emit(MarketCreated {
            market_id: object::id(&market),
            club_id,
            admin: ctx.sender(),
        });

        transfer::share_object(market);
    }

    /// Pause/unpause market (admin only).
    public fun set_paused(
        market: &mut ClubEscrowMarket,
        paused: bool,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == market.admin, ENotAdmin);
        market.paused = paused;
    }

    /// Create a P2P offer — returns the offer object (composable).
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

    /// Fill an offer — returns (offered_coin, change_or_zero) to caller (composable).
    /// Overpayment returns change as second element.
    public fun fill_offer<OfferT, WantT>(
        market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        mut payment: Coin<WantT>,
        ctx: &mut TxContext,
    ): (Coin<OfferT>, Coin<WantT>) {
        assert!(!market.paused, EMarketPaused);
        assert!(ctx.epoch() <= offer.expires_at_epoch, EOfferExpired);

        if (offer.recipient.is_some()) {
            assert!(ctx.sender() == *offer.recipient.borrow(), EWrongRecipient);
        };

        assert!(payment.value() >= offer.want_amount, EUnderpayment);

        let offer_id = object::id(&offer);
        let maker = offer.maker;
        let offer_amount = offer.offer_amount;
        let want_amount = offer.want_amount;

        // Split exact payment for maker, keep change
        let change = if (payment.value() > want_amount) {
            let change_amount = payment.value() - want_amount;
            payment.split(change_amount, ctx)
        } else {
            coin::zero<WantT>(ctx)
        };

        // Destroy offer, extract coin
        let EscrowOffer { id, maker: _, recipient: _, round_id: _, offer_amount: _, want_amount: _, expires_at_epoch: _, offer_coin } = offer;
        id.delete();

        // Transfer payment to maker
        transfer::public_transfer(payment, maker);

        event::emit(OfferFilled {
            offer_id,
            maker,
            filler: ctx.sender(),
            offer_amount,
            want_amount,
        });

        (offer_coin, change)
    }

    /// Cancel an offer — returns the offered coin (composable).
    public fun cancel_offer<OfferT, WantT>(
        _market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        ctx: &TxContext,
    ): Coin<OfferT> {
        assert!(ctx.sender() == offer.maker, ENotMaker);

        let offer_id = object::id(&offer);
        let maker = offer.maker;
        let refunded = offer.offer_amount;

        let EscrowOffer { id, maker: _, recipient: _, round_id: _, offer_amount: _, want_amount: _, expires_at_epoch: _, offer_coin } = offer;
        id.delete();

        event::emit(OfferCancelled { offer_id, maker, refunded });
        offer_coin
    }

    // === Entry Wrappers ===

    /// Fill offer and transfer results to filler/maker.
    entry fun fill_and_transfer<OfferT, WantT>(
        market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        payment: Coin<WantT>,
        ctx: &mut TxContext,
    ) {
        let filler = ctx.sender();
        let (offer_coin, change) = fill_offer(market, offer, payment, ctx);
        transfer::public_transfer(offer_coin, filler);
        if (change.value() > 0) {
            transfer::public_transfer(change, filler);
        } else {
            change.destroy_zero();
        };
    }

    /// Cancel offer and transfer refund to maker.
    entry fun cancel_and_refund<OfferT, WantT>(
        market: &ClubEscrowMarket,
        offer: EscrowOffer<OfferT, WantT>,
        ctx: &TxContext,
    ) {
        let maker = ctx.sender();
        let coin = cancel_offer(market, offer, ctx);
        transfer::public_transfer(coin, maker);
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

    // === Accessors (field name, no get_ prefix) ===

    public fun market_club_id(m: &ClubEscrowMarket): ID { m.club_id }
    public fun market_admin(m: &ClubEscrowMarket): address { m.admin }
    public fun market_paused(m: &ClubEscrowMarket): bool { m.paused }

    public fun maker<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): address { o.maker }
    public fun recipient<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): &Option<address> { &o.recipient }
    public fun offer_amount<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.offer_amount }
    public fun want_amount<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.want_amount }
    public fun expires_at_epoch<OfferT, WantT>(o: &EscrowOffer<OfferT, WantT>): u64 { o.expires_at_epoch }
}
