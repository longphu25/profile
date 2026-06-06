/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as coin from './deps/sui/coin.ts';
const $moduleName = '@local-pkg/predict-club::exchange';
export const ClubEscrowMarket = new MoveStruct({ name: `${$moduleName}::ClubEscrowMarket`, fields: {
        id: bcs.Address,
        club_id: bcs.Address,
        admin: bcs.Address,
        paused: bcs.bool()
    } });
export const EscrowOffer = new MoveStruct({ name: `${$moduleName}::EscrowOffer<phantom OfferT, phantom WantT>`, fields: {
        id: bcs.Address,
        maker: bcs.Address,
        recipient: bcs.option(bcs.Address),
        round_id: bcs.option(bcs.Address),
        offer_amount: bcs.u64(),
        want_amount: bcs.u64(),
        expires_at_epoch: bcs.u64(),
        offer_coin: coin.Coin
    } });
export const MarketCreated = new MoveStruct({ name: `${$moduleName}::MarketCreated`, fields: {
        market_id: bcs.Address,
        club_id: bcs.Address,
        admin: bcs.Address
    } });
export const OfferCreated = new MoveStruct({ name: `${$moduleName}::OfferCreated`, fields: {
        offer_id: bcs.Address,
        maker: bcs.Address,
        offer_amount: bcs.u64(),
        want_amount: bcs.u64(),
        expires_at_epoch: bcs.u64()
    } });
export const OfferFilled = new MoveStruct({ name: `${$moduleName}::OfferFilled`, fields: {
        offer_id: bcs.Address,
        maker: bcs.Address,
        filler: bcs.Address,
        offer_amount: bcs.u64(),
        want_amount: bcs.u64()
    } });
export const OfferCancelled = new MoveStruct({ name: `${$moduleName}::OfferCancelled`, fields: {
        offer_id: bcs.Address,
        maker: bcs.Address,
        refunded: bcs.u64()
    } });
export interface CreateMarketArguments {
    clubId: RawTransactionArgument<string>;
}
export interface CreateMarketOptions {
    package?: string;
    arguments: CreateMarketArguments | [
        clubId: RawTransactionArgument<string>
    ];
}
/** Create a shared market for a club. */
export function createMarket(options: CreateMarketOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["clubId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'create_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPausedArguments {
    market: RawTransactionArgument<string>;
    paused: RawTransactionArgument<boolean>;
}
export interface SetPausedOptions {
    package?: string;
    arguments: SetPausedArguments | [
        market: RawTransactionArgument<string>,
        paused: RawTransactionArgument<boolean>
    ];
}
/** Pause/unpause market (admin only). */
export function setPaused(options: SetPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "paused"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'set_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateOfferArguments {
    market: RawTransactionArgument<string>;
    offerCoin: RawTransactionArgument<string>;
    wantAmount: RawTransactionArgument<number | bigint>;
    recipient: RawTransactionArgument<string | null>;
    roundId: RawTransactionArgument<string | null>;
    expiresInEpochs: RawTransactionArgument<number | bigint>;
}
export interface CreateOfferOptions {
    package?: string;
    arguments: CreateOfferArguments | [
        market: RawTransactionArgument<string>,
        offerCoin: RawTransactionArgument<string>,
        wantAmount: RawTransactionArgument<number | bigint>,
        recipient: RawTransactionArgument<string | null>,
        roundId: RawTransactionArgument<string | null>,
        expiresInEpochs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Create a P2P offer — returns the offer object (composable). */
export function createOffer(options: CreateOfferOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null,
        'u64',
        '0x1::option::Option<address>',
        '0x1::option::Option<0x2::object::ID>',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "offerCoin", "wantAmount", "recipient", "roundId", "expiresInEpochs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'create_offer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FillOfferArguments {
    market: RawTransactionArgument<string>;
    offer: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
}
export interface FillOfferOptions {
    package?: string;
    arguments: FillOfferArguments | [
        market: RawTransactionArgument<string>,
        offer: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Fill an offer — returns (offered_coin, change_or_zero) to caller (composable).
 * Overpayment returns change as second element.
 */
export function fillOffer(options: FillOfferOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market", "offer", "payment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'fill_offer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelOfferArguments {
    Market: RawTransactionArgument<string>;
    offer: RawTransactionArgument<string>;
}
export interface CancelOfferOptions {
    package?: string;
    arguments: CancelOfferArguments | [
        Market: RawTransactionArgument<string>,
        offer: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancel an offer — returns the offered coin (composable). */
export function cancelOffer(options: CancelOfferOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Market", "offer"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'cancel_offer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FillAndTransferArguments {
    market: RawTransactionArgument<string>;
    offer: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
}
export interface FillAndTransferOptions {
    package?: string;
    arguments: FillAndTransferArguments | [
        market: RawTransactionArgument<string>,
        offer: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Fill offer and transfer results to filler/maker. */
export function fillAndTransfer(options: FillAndTransferOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market", "offer", "payment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'fill_and_transfer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelAndRefundArguments {
    market: RawTransactionArgument<string>;
    offer: RawTransactionArgument<string>;
}
export interface CancelAndRefundOptions {
    package?: string;
    arguments: CancelAndRefundArguments | [
        market: RawTransactionArgument<string>,
        offer: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancel offer and transfer refund to maker. */
export function cancelAndRefund(options: CancelAndRefundOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market", "offer"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'cancel_and_refund',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsExpiredArguments {
    offer: RawTransactionArgument<string>;
    currentEpoch: RawTransactionArgument<number | bigint>;
}
export interface IsExpiredOptions {
    package?: string;
    arguments: IsExpiredArguments | [
        offer: RawTransactionArgument<string>,
        currentEpoch: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function isExpired(options: IsExpiredOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["offer", "currentEpoch"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'is_expired',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CanFillArguments {
    offer: RawTransactionArgument<string>;
    filler: RawTransactionArgument<string>;
    currentEpoch: RawTransactionArgument<number | bigint>;
}
export interface CanFillOptions {
    package?: string;
    arguments: CanFillArguments | [
        offer: RawTransactionArgument<string>,
        filler: RawTransactionArgument<string>,
        currentEpoch: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function canFill(options: CanFillOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["offer", "filler", "currentEpoch"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'can_fill',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketClubIdArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketClubIdOptions {
    package?: string;
    arguments: MarketClubIdArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketClubId(options: MarketClubIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'market_club_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketAdminArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketAdminOptions {
    package?: string;
    arguments: MarketAdminArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketAdmin(options: MarketAdminOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'market_admin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketPausedArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketPausedOptions {
    package?: string;
    arguments: MarketPausedArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketPaused(options: MarketPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'market_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MakerArguments {
    o: RawTransactionArgument<string>;
}
export interface MakerOptions {
    package?: string;
    arguments: MakerArguments | [
        o: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function maker(options: MakerOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'maker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RecipientArguments {
    o: RawTransactionArgument<string>;
}
export interface RecipientOptions {
    package?: string;
    arguments: RecipientArguments | [
        o: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function recipient(options: RecipientOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'recipient',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OfferAmountArguments {
    o: RawTransactionArgument<string>;
}
export interface OfferAmountOptions {
    package?: string;
    arguments: OfferAmountArguments | [
        o: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function offerAmount(options: OfferAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'offer_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WantAmountArguments {
    o: RawTransactionArgument<string>;
}
export interface WantAmountOptions {
    package?: string;
    arguments: WantAmountArguments | [
        o: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function wantAmount(options: WantAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'want_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExpiresAtEpochArguments {
    o: RawTransactionArgument<string>;
}
export interface ExpiresAtEpochOptions {
    package?: string;
    arguments: ExpiresAtEpochArguments | [
        o: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function expiresAtEpoch(options: ExpiresAtEpochOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'exchange',
        function: 'expires_at_epoch',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}