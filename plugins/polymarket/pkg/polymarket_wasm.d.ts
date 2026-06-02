/* tslint:disable */
/* eslint-disable */

/**
 * Build and validate an order for the Polymarket CLOB.
 *
 * Returns a BuiltOrder with the order payload ready for signing,
 * or an error if validation fails.
 */
export function build_order(params_js: any): any

/**
 * Derive wallet address from private key (hex)
 */
export function derive_address(private_key_hex: string): any

/**
 * Compute HMAC-SHA256 of a message with a base64-encoded secret.
 * Returns base64-encoded signature.
 */
export function hmac_sha256(secret_b64: string, message: string): any

/**
 * Compute keccak256 hash of input bytes (hex encoded).
 * Useful for EIP-712 type hashing.
 */
export function keccak256_hex(input_hex: string): any

/**
 * Generate L1 EIP-712 authentication headers for API key derivation.
 *
 * Parameters:
 * - private_key_hex: Wallet private key (hex, with or without 0x)
 * - timestamp: Unix timestamp as string
 * - nonce: Nonce value as string
 */
export function sign_l1_auth(private_key_hex: string, timestamp: string, nonce: string): any

/**
 * Generate L2 HMAC-SHA256 authentication headers for trading operations.
 *
 * Parameters:
 * - api_key: API key string
 * - secret: Base64-encoded HMAC secret
 * - passphrase: API passphrase
 * - timestamp: Unix timestamp as string
 * - method: HTTP method (GET, POST, DELETE)
 * - path: Request path (e.g., "/order")
 * - body: Request body (empty string for GET/DELETE)
 */
export function sign_l2_auth(
  api_key: string,
  secret: string,
  passphrase: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
  address: string,
): any

/**
 * Sign an order with EIP-712 (for CLOB submission).
 * Takes the built order payload and private key, returns signed order.
 */
export function sign_order(order_js: any, private_key_hex: string): any

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module

export interface InitOutput {
  readonly memory: WebAssembly.Memory
  readonly build_order: (a: number) => number
  readonly derive_address: (a: number, b: number) => number
  readonly hmac_sha256: (a: number, b: number, c: number, d: number) => number
  readonly keccak256_hex: (a: number, b: number) => number
  readonly sign_l1_auth: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => number
  readonly sign_l2_auth: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
    j: number,
    k: number,
    l: number,
    m: number,
    n: number,
    o: number,
    p: number,
  ) => number
  readonly sign_order: (a: number, b: number, c: number) => number
  readonly __wbindgen_export: (a: number, b: number) => number
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number
  readonly __wbindgen_export3: (a: number) => void
}

export type SyncInitInput = BufferSource | WebAssembly.Module

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>
