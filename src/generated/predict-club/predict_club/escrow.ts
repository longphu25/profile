/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance.ts';
const $moduleName = '@local-pkg/predict-club::escrow';
export const Escrow = new MoveStruct({ name: `${$moduleName}::Escrow<phantom T>`, fields: {
        id: bcs.Address,
        escrow_address: bcs.Address,
        depositor: bcs.Address,
        beneficiary: bcs.Address,
        amount: bcs.u64(),
        locked_until_epoch: bcs.u64(),
        created_at_epoch: bcs.u64(),
        created_at_timestamp: bcs.u64(),
        release_conditions: bcs.u8(),
        approver: bcs.Address,
        approved: bcs.bool(),
        released: bcs.bool(),
        balance: balance.Balance
    } });
export const ApproverCap = new MoveStruct({ name: `${$moduleName}::ApproverCap`, fields: {
        id: bcs.Address,
        escrow_id: bcs.Address
    } });
export const ReleaseReceipt = new MoveStruct({ name: `${$moduleName}::ReleaseReceipt`, fields: {
        id: bcs.Address,
        escrow_id: bcs.Address,
        released_to: bcs.Address,
        amount: bcs.u64(),
        released_at_epoch: bcs.u64(),
        released_at_timestamp: bcs.u64()
    } });
export const EscrowCreated = new MoveStruct({ name: `${$moduleName}::EscrowCreated`, fields: {
        escrow_id: bcs.Address,
        depositor: bcs.Address,
        beneficiary: bcs.Address,
        locked_until_epoch: bcs.u64(),
        release_conditions: bcs.u8()
    } });
export const FundsDeposited = new MoveStruct({ name: `${$moduleName}::FundsDeposited`, fields: {
        escrow_id: bcs.Address,
        amount: bcs.u64(),
        total: bcs.u64()
    } });
export const EscrowApproved = new MoveStruct({ name: `${$moduleName}::EscrowApproved`, fields: {
        escrow_id: bcs.Address,
        approver: bcs.Address
    } });
export const FundsReleased = new MoveStruct({ name: `${$moduleName}::FundsReleased`, fields: {
        escrow_id: bcs.Address,
        beneficiary: bcs.Address,
        amount: bcs.u64(),
        epoch: bcs.u64()
    } });
export const EscrowCancelled = new MoveStruct({ name: `${$moduleName}::EscrowCancelled`, fields: {
        escrow_id: bcs.Address,
        depositor: bcs.Address,
        refunded: bcs.u64()
    } });
export interface CreateEscrowArguments {
    beneficiary: RawTransactionArgument<string>;
    lockDurationEpochs: RawTransactionArgument<number | bigint>;
    releaseConditions: RawTransactionArgument<number>;
    approver: RawTransactionArgument<string>;
}
export interface CreateEscrowOptions {
    package?: string;
    arguments: CreateEscrowArguments | [
        beneficiary: RawTransactionArgument<string>,
        lockDurationEpochs: RawTransactionArgument<number | bigint>,
        releaseConditions: RawTransactionArgument<number>,
        approver: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Create a time-locked escrow for any coin type T. Returns nothing — shares the
 * Escrow object and optionally transfers ApproverCap.
 */
export function createEscrow(options: CreateEscrowOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        'address',
        'u64',
        'u8',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["beneficiary", "lockDurationEpochs", "releaseConditions", "approver"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'create_escrow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositArguments {
    escrow: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositOptions {
    package?: string;
    arguments: DepositArguments | [
        escrow: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Deposit coin into the escrow. Only depositor, before release. */
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ApproveReleaseArguments {
    escrow: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
}
export interface ApproveReleaseOptions {
    package?: string;
    arguments: ApproveReleaseArguments | [
        escrow: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Approve the escrow release. Requires ApproverCap. */
export function approveRelease(options: ApproveReleaseOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow", "cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'approve_release',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReleaseFundsArguments {
    escrow: RawTransactionArgument<string>;
}
export interface ReleaseFundsOptions {
    package?: string;
    arguments: ReleaseFundsArguments | [
        escrow: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Release funds — returns the Coin to the caller (composable). Caller is
 * responsible for transferring to beneficiary.
 */
export function releaseFunds(options: ReleaseFundsOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'release_funds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelEscrowArguments {
    escrow: RawTransactionArgument<string>;
}
export interface CancelEscrowOptions {
    package?: string;
    arguments: CancelEscrowArguments | [
        escrow: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Cancel escrow — returns the Coin to the caller (composable). Depositor must
 * cancel at least 1 epoch before unlock.
 */
export function cancelEscrow(options: CancelEscrowOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'cancel_escrow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReleaseAndTransferArguments {
    escrow: RawTransactionArgument<string>;
}
export interface ReleaseAndTransferOptions {
    package?: string;
    arguments: ReleaseAndTransferArguments | [
        escrow: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Release and transfer to beneficiary in one call. */
export function releaseAndTransfer(options: ReleaseAndTransferOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'release_and_transfer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelAndRefundArguments {
    escrow: RawTransactionArgument<string>;
}
export interface CancelAndRefundOptions {
    package?: string;
    arguments: CancelAndRefundArguments | [
        escrow: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Cancel and return funds to depositor in one call. */
export function cancelAndRefund(options: CancelAndRefundOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["escrow"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'cancel_and_refund',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsReadyToReleaseArguments {
    escrow: RawTransactionArgument<string>;
    currentEpoch: RawTransactionArgument<number | bigint>;
}
export interface IsReadyToReleaseOptions {
    package?: string;
    arguments: IsReadyToReleaseArguments | [
        escrow: RawTransactionArgument<string>,
        currentEpoch: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function isReadyToRelease(options: IsReadyToReleaseOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["escrow", "currentEpoch"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'is_ready_to_release',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EpochsUntilUnlockArguments {
    escrow: RawTransactionArgument<string>;
    currentEpoch: RawTransactionArgument<number | bigint>;
}
export interface EpochsUntilUnlockOptions {
    package?: string;
    arguments: EpochsUntilUnlockArguments | [
        escrow: RawTransactionArgument<string>,
        currentEpoch: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function epochsUntilUnlock(options: EpochsUntilUnlockOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["escrow", "currentEpoch"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'epochs_until_unlock',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EscrowAddressArguments {
    e: RawTransactionArgument<string>;
}
export interface EscrowAddressOptions {
    package?: string;
    arguments: EscrowAddressArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function escrowAddress(options: EscrowAddressOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'escrow_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositorArguments {
    e: RawTransactionArgument<string>;
}
export interface DepositorOptions {
    package?: string;
    arguments: DepositorArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function depositor(options: DepositorOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'depositor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BeneficiaryArguments {
    e: RawTransactionArgument<string>;
}
export interface BeneficiaryOptions {
    package?: string;
    arguments: BeneficiaryArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function beneficiary(options: BeneficiaryOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'beneficiary',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AmountArguments {
    e: RawTransactionArgument<string>;
}
export interface AmountOptions {
    package?: string;
    arguments: AmountArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function amount(options: AmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LockedUntilEpochArguments {
    e: RawTransactionArgument<string>;
}
export interface LockedUntilEpochOptions {
    package?: string;
    arguments: LockedUntilEpochArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function lockedUntilEpoch(options: LockedUntilEpochOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'locked_until_epoch',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReleaseConditionsArguments {
    e: RawTransactionArgument<string>;
}
export interface ReleaseConditionsOptions {
    package?: string;
    arguments: ReleaseConditionsArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function releaseConditions(options: ReleaseConditionsOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'release_conditions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ApproverAddrArguments {
    e: RawTransactionArgument<string>;
}
export interface ApproverAddrOptions {
    package?: string;
    arguments: ApproverAddrArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function approverAddr(options: ApproverAddrOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'approver_addr',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ApprovedArguments {
    e: RawTransactionArgument<string>;
}
export interface ApprovedOptions {
    package?: string;
    arguments: ApprovedArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function approved(options: ApprovedOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'approved',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReleasedArguments {
    e: RawTransactionArgument<string>;
}
export interface ReleasedOptions {
    package?: string;
    arguments: ReleasedArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function released(options: ReleasedOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'released',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceValueArguments {
    e: RawTransactionArgument<string>;
}
export interface BalanceValueOptions {
    package?: string;
    arguments: BalanceValueArguments | [
        e: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function balanceValue(options: BalanceValueOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'balance_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReceiptEscrowIdArguments {
    r: RawTransactionArgument<string>;
}
export interface ReceiptEscrowIdOptions {
    package?: string;
    arguments: ReceiptEscrowIdArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function receiptEscrowId(options: ReceiptEscrowIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'receipt_escrow_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReceiptReleasedToArguments {
    r: RawTransactionArgument<string>;
}
export interface ReceiptReleasedToOptions {
    package?: string;
    arguments: ReceiptReleasedToArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function receiptReleasedTo(options: ReceiptReleasedToOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'receipt_released_to',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReceiptAmountArguments {
    r: RawTransactionArgument<string>;
}
export interface ReceiptAmountOptions {
    package?: string;
    arguments: ReceiptAmountArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function receiptAmount(options: ReceiptAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'receipt_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReceiptReleasedAtEpochArguments {
    r: RawTransactionArgument<string>;
}
export interface ReceiptReleasedAtEpochOptions {
    package?: string;
    arguments: ReceiptReleasedAtEpochArguments | [
        r: RawTransactionArgument<string>
    ];
}
export function receiptReleasedAtEpoch(options: ReceiptReleasedAtEpochOptions) {
    const packageAddress = options.package ?? '@local-pkg/predict-club';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'escrow',
        function: 'receipt_released_at_epoch',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}