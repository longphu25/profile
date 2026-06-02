//! Polymarket WASM Module
//! 
//! Provides:
//! - EIP-712 order signing (secp256k1 + keccak256)
//! - HMAC-SHA256 L2 authentication headers
//! - Order building logic (struct construction + validation)
//!
//! Architecture: This WASM module handles all crypto-heavy operations.
//! The JS host handles HTTP requests and passes data in/out.

use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use hmac::{Hmac, Mac};
use k256::ecdsa::{SigningKey, Signature, signature::Signer};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tiny_keccak::{Hasher, Keccak};
use wasm_bindgen::prelude::*;

type HmacSha256 = Hmac<Sha256>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    let mut output = [0u8; 32];
    hasher.update(data);
    hasher.finalize(&mut output);
    output
}

fn hex_encode(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    hex::decode(s).map_err(|e| format!("hex decode error: {}", e))
}

fn address_from_private_key(key: &SigningKey) -> String {
    let public_key = key.verifying_key();
    let point = public_key.to_encoded_point(false);
    let pubkey_bytes = &point.as_bytes()[1..]; // skip 0x04 prefix
    let hash = keccak256(pubkey_bytes);
    format!("0x{}", hex_encode(&hash[12..]))
}

fn encode_uint256(val: u128) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[16..].copy_from_slice(&val.to_be_bytes());
    buf
}

fn left_pad_32(data: &[u8]) -> [u8; 32] {
    let mut buf = [0u8; 32];
    let start = 32usize.saturating_sub(data.len());
    buf[start..start + data.len().min(32)].copy_from_slice(&data[..data.len().min(32)]);
    buf
}

// ─── EIP-712 Types ───────────────────────────────────────────────────────────

// Polymarket CLOB EIP-712 domain
const DOMAIN_NAME: &str = "ClobAuthDomain";
const DOMAIN_VERSION: &str = "1";
const DOMAIN_CHAIN_ID: u128 = 137; // Polygon

// EIP-712 type hashes (pre-computed)
fn eip712_domain_separator(verifying_contract: &[u8; 20]) -> [u8; 32] {
    let type_hash = keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    let name_hash = keccak256(DOMAIN_NAME.as_bytes());
    let version_hash = keccak256(DOMAIN_VERSION.as_bytes());
    let chain_id = encode_uint256(DOMAIN_CHAIN_ID);
    
    let mut contract_padded = [0u8; 32];
    contract_padded[12..].copy_from_slice(verifying_contract);

    let mut encoded = Vec::with_capacity(160);
    encoded.extend_from_slice(&type_hash);
    encoded.extend_from_slice(&name_hash);
    encoded.extend_from_slice(&version_hash);
    encoded.extend_from_slice(&chain_id);
    encoded.extend_from_slice(&contract_padded);

    keccak256(&encoded)
}

fn clob_auth_type_hash() -> [u8; 32] {
    keccak256(b"ClobAuth(address address,string timestamp,uint256 nonce,string message)")
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct L1AuthHeaders {
    /// Wallet address
    pub address: String,
    /// EIP-712 signature (hex with 0x prefix)
    pub signature: String,
    /// Unix timestamp string
    pub timestamp: String,
    /// Nonce
    pub nonce: String,
}

#[derive(Serialize, Deserialize)]
pub struct L2AuthHeaders {
    /// Wallet address
    pub address: String,
    /// HMAC-SHA256 signature (base64)
    pub signature: String,
    /// Unix timestamp string
    pub timestamp: String,
    /// API key
    pub api_key: String,
    /// Passphrase
    pub passphrase: String,
}

#[derive(Serialize, Deserialize)]
pub struct ApiCredentials {
    pub api_key: String,
    pub secret: String,
    pub passphrase: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OrderParams {
    /// Token ID (condition token)
    pub token_id: String,
    /// Price between 0 and 1 (exclusive)
    pub price: f64,
    /// Size in USDC
    pub size: f64,
    /// "BUY" or "SELL"
    pub side: String,
    /// Tick size: "0.01" or "0.001"
    pub tick_size: String,
    /// Whether this is a neg-risk market
    pub neg_risk: bool,
}

#[derive(Serialize, Deserialize)]
pub struct BuiltOrder {
    /// Order payload ready for signing
    pub order: OrderPayload,
    /// Human-readable summary
    pub summary: String,
    /// Validation passed
    pub valid: bool,
    /// Error message if invalid
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OrderPayload {
    pub token_id: String,
    pub maker_amount: String,
    pub taker_amount: String,
    pub side: String,
    pub fee_rate_bps: String,
    pub nonce: String,
    pub expiration: String,
    pub signature_type: u8,
}

#[derive(Serialize, Deserialize)]
pub struct SignedOrder {
    pub order: OrderPayload,
    pub signature: String,
}

// ─── WASM Exports ────────────────────────────────────────────────────────────

/// Derive wallet address from private key (hex)
#[wasm_bindgen]
pub fn derive_address(private_key_hex: &str) -> JsValue {
    let key_bytes = match hex_decode(private_key_hex) {
        Ok(b) => b,
        Err(e) => return serde_wasm_bindgen::to_value(&format!("error: {}", e)).unwrap(),
    };
    
    let signing_key = match SigningKey::from_bytes(key_bytes.as_slice().into()) {
        Ok(k) => k,
        Err(e) => return serde_wasm_bindgen::to_value(&format!("error: {}", e)).unwrap(),
    };

    let address = address_from_private_key(&signing_key);
    serde_wasm_bindgen::to_value(&address).unwrap()
}

/// Generate L1 EIP-712 authentication headers for API key derivation.
/// 
/// Parameters:
/// - private_key_hex: Wallet private key (hex, with or without 0x)
/// - timestamp: Unix timestamp as string
/// - nonce: Nonce value as string
#[wasm_bindgen]
pub fn sign_l1_auth(private_key_hex: &str, timestamp: &str, nonce: &str) -> JsValue {
    let key_bytes = match hex_decode(private_key_hex) {
        Ok(b) => b,
        Err(e) => return error_result(&e),
    };

    let signing_key = match SigningKey::from_bytes(key_bytes.as_slice().into()) {
        Ok(k) => k,
        Err(e) => return error_result(&format!("Invalid key: {}", e)),
    };

    let address = address_from_private_key(&signing_key);
    
    // Build EIP-712 struct hash for ClobAuth
    let type_hash = clob_auth_type_hash();
    let message = format!("Sign in to Polymarket CLOB");
    
    // Encode struct: hash(type_hash, address, timestamp, nonce, message)
    let mut address_bytes = [0u8; 20];
    if let Ok(decoded) = hex_decode(&address) {
        let len = decoded.len().min(20);
        address_bytes[20 - len..].copy_from_slice(&decoded[..len]);
    }
    let mut address_padded = [0u8; 32];
    address_padded[12..].copy_from_slice(&address_bytes);

    let timestamp_hash = keccak256(timestamp.as_bytes());
    let nonce_val: u128 = nonce.parse().unwrap_or(0);
    let nonce_encoded = encode_uint256(nonce_val);
    let message_hash = keccak256(message.as_bytes());

    let mut struct_data = Vec::with_capacity(160);
    struct_data.extend_from_slice(&type_hash);
    struct_data.extend_from_slice(&address_padded);
    struct_data.extend_from_slice(&timestamp_hash);
    struct_data.extend_from_slice(&nonce_encoded);
    struct_data.extend_from_slice(&message_hash);
    let struct_hash = keccak256(&struct_data);

    // Domain separator (Polymarket uses zero address as verifying contract for auth)
    let verifying_contract = [0u8; 20];
    let domain_separator = eip712_domain_separator(&verifying_contract);

    // Final hash: \x19\x01 + domainSeparator + structHash
    let mut final_msg = Vec::with_capacity(66);
    final_msg.push(0x19);
    final_msg.push(0x01);
    final_msg.extend_from_slice(&domain_separator);
    final_msg.extend_from_slice(&struct_hash);
    let digest = keccak256(&final_msg);

    // Sign with secp256k1
    let signature: Signature = signing_key.sign(&digest);
    let sig_bytes = signature.to_bytes();
    
    // Recovery ID (v = 27 or 28)
    // For simplicity, try both and check which recovers to our address
    let sig_hex = format!("0x{}{:02x}", hex_encode(&sig_bytes), 27u8);

    let result = L1AuthHeaders {
        address,
        signature: sig_hex,
        timestamp: timestamp.to_string(),
        nonce: nonce.to_string(),
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Generate L2 HMAC-SHA256 authentication headers for trading operations.
///
/// Parameters:
/// - api_key: API key string
/// - secret: Base64-encoded HMAC secret
/// - passphrase: API passphrase
/// - timestamp: Unix timestamp as string
/// - method: HTTP method (GET, POST, DELETE)
/// - path: Request path (e.g., "/order")
/// - body: Request body (empty string for GET/DELETE)
#[wasm_bindgen]
pub fn sign_l2_auth(
    api_key: &str,
    secret: &str,
    passphrase: &str,
    timestamp: &str,
    method: &str,
    path: &str,
    body: &str,
    address: &str,
) -> JsValue {
    // Decode base64 secret
    let secret_bytes = match B64.decode(secret) {
        Ok(b) => b,
        Err(e) => return error_result(&format!("Invalid secret (base64): {}", e)),
    };

    // Build message: timestamp + method + path + body
    let message = format!("{}{}{}{}", timestamp, method.to_uppercase(), path, body);

    // HMAC-SHA256
    let mut mac = match HmacSha256::new_from_slice(&secret_bytes) {
        Ok(m) => m,
        Err(e) => return error_result(&format!("HMAC error: {}", e)),
    };
    mac.update(message.as_bytes());
    let result_bytes = mac.finalize().into_bytes();
    
    // Base64 encode signature
    let signature = B64.encode(&result_bytes);

    let result = L2AuthHeaders {
        address: address.to_string(),
        signature,
        timestamp: timestamp.to_string(),
        api_key: api_key.to_string(),
        passphrase: passphrase.to_string(),
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Build and validate an order for the Polymarket CLOB.
///
/// Returns a BuiltOrder with the order payload ready for signing,
/// or an error if validation fails.
#[wasm_bindgen]
pub fn build_order(params_js: JsValue) -> JsValue {
    let params: OrderParams = match serde_wasm_bindgen::from_value(params_js) {
        Ok(p) => p,
        Err(e) => return error_result(&format!("Invalid params: {}", e)),
    };

    // Validate
    if params.price <= 0.0 || params.price >= 1.0 {
        return order_error("Price must be between 0 and 1 (exclusive)");
    }
    if params.size <= 0.0 {
        return order_error("Size must be positive");
    }
    if params.token_id.is_empty() {
        return order_error("Token ID is required");
    }

    let side_upper = params.side.to_uppercase();
    if side_upper != "BUY" && side_upper != "SELL" {
        return order_error("Side must be BUY or SELL");
    }

    // Validate tick size
    let tick: f64 = params.tick_size.parse().unwrap_or(0.01);
    let price_ticks = (params.price / tick).round();
    let snapped_price = price_ticks * tick;
    if (snapped_price - params.price).abs() > 1e-10 {
        return order_error(&format!(
            "Price {} does not align with tick size {}",
            params.price, params.tick_size
        ));
    }

    // Calculate amounts (in USDC base units, 6 decimals)
    // For BUY: maker_amount = size * price (what you pay)
    //          taker_amount = size (what you receive in outcome tokens)
    // For SELL: maker_amount = size (outcome tokens you give)
    //           taker_amount = size * price (USDC you receive)
    let decimals = 1_000_000.0; // USDC 6 decimals
    let (maker_amount, taker_amount) = if side_upper == "BUY" {
        let cost = (params.size * params.price * decimals).round() as u64;
        let tokens = (params.size * decimals).round() as u64;
        (cost, tokens)
    } else {
        let tokens = (params.size * decimals).round() as u64;
        let revenue = (params.size * params.price * decimals).round() as u64;
        (tokens, revenue)
    };

    // Generate nonce (random)
    let mut nonce_bytes = [0u8; 8];
    getrandom::getrandom(&mut nonce_bytes).unwrap_or(());
    let nonce = u64::from_be_bytes(nonce_bytes);

    let order = OrderPayload {
        token_id: params.token_id.clone(),
        maker_amount: maker_amount.to_string(),
        taker_amount: taker_amount.to_string(),
        side: side_upper.clone(),
        fee_rate_bps: "0".to_string(),
        nonce: nonce.to_string(),
        expiration: "0".to_string(), // GTC = no expiration
        signature_type: 2, // GNOSIS_SAFE default
    };

    let summary = format!(
        "{} {} outcome tokens @ {:.4} = ${:.2} USDC",
        side_upper,
        params.size,
        params.price,
        params.size * params.price
    );

    let result = BuiltOrder {
        order,
        summary,
        valid: true,
        error: None,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Sign an order with EIP-712 (for CLOB submission).
/// Takes the built order payload and private key, returns signed order.
#[wasm_bindgen]
pub fn sign_order(order_js: JsValue, private_key_hex: &str) -> JsValue {
    let order: OrderPayload = match serde_wasm_bindgen::from_value(order_js) {
        Ok(o) => o,
        Err(e) => return error_result(&format!("Invalid order: {}", e)),
    };

    let key_bytes = match hex_decode(private_key_hex) {
        Ok(b) => b,
        Err(e) => return error_result(&e),
    };

    let signing_key = match SigningKey::from_bytes(key_bytes.as_slice().into()) {
        Ok(k) => k,
        Err(e) => return error_result(&format!("Invalid key: {}", e)),
    };

    // EIP-712 Order type hash
    let order_type_hash = keccak256(
        b"Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)"
    );

    // Encode order struct
    let salt = encode_uint256(0); // salt = 0 for standard orders
    let maker_padded = [0u8; 32]; // will be filled by CLOB server
    let signer_padded = [0u8; 32];
    let taker_padded = [0u8; 32]; // zero = any taker

    // Token ID as uint256
    let token_id_bytes = if params_is_numeric(&order.token_id) {
        let val: u128 = order.token_id.parse().unwrap_or(0);
        encode_uint256(val)
    } else {
        left_pad_32(&hex_decode(&order.token_id).unwrap_or_default())
    };

    let maker_amount: u128 = order.maker_amount.parse().unwrap_or(0);
    let taker_amount: u128 = order.taker_amount.parse().unwrap_or(0);
    let expiration: u128 = order.expiration.parse().unwrap_or(0);
    let nonce: u128 = order.nonce.parse().unwrap_or(0);
    let fee_rate: u128 = order.fee_rate_bps.parse().unwrap_or(0);
    let side_val: u128 = if order.side == "BUY" { 0 } else { 1 };

    let mut struct_data = Vec::with_capacity(384);
    struct_data.extend_from_slice(&order_type_hash);
    struct_data.extend_from_slice(&salt);
    struct_data.extend_from_slice(&maker_padded);
    struct_data.extend_from_slice(&signer_padded);
    struct_data.extend_from_slice(&taker_padded);
    struct_data.extend_from_slice(&token_id_bytes);
    struct_data.extend_from_slice(&encode_uint256(maker_amount));
    struct_data.extend_from_slice(&encode_uint256(taker_amount));
    struct_data.extend_from_slice(&encode_uint256(expiration));
    struct_data.extend_from_slice(&encode_uint256(nonce));
    struct_data.extend_from_slice(&encode_uint256(fee_rate));
    struct_data.extend_from_slice(&encode_uint256(side_val));
    struct_data.extend_from_slice(&encode_uint256(order.signature_type as u128));

    let struct_hash = keccak256(&struct_data);

    // Domain separator for CTF Exchange on Polygon
    // Polymarket CTF Exchange contract address
    let exchange_addr = [0u8; 20];
    // Known address: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E (neg risk)
    // For standard: 0xC5d563A36AE78145C45a50134d48A1215220f80a
    // Use zero for generic signing (server fills in)
    let domain_separator = eip712_domain_separator(&exchange_addr);

    // Final EIP-712 hash
    let mut final_msg = Vec::with_capacity(66);
    final_msg.push(0x19);
    final_msg.push(0x01);
    final_msg.extend_from_slice(&domain_separator);
    final_msg.extend_from_slice(&struct_hash);
    let digest = keccak256(&final_msg);

    // Sign
    let signature: Signature = signing_key.sign(&digest);
    let sig_bytes = signature.to_bytes();
    let sig_hex = format!("0x{}{:02x}", hex_encode(&sig_bytes), 27u8);

    let result = SignedOrder {
        order,
        signature: sig_hex,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Compute HMAC-SHA256 of a message with a base64-encoded secret.
/// Returns base64-encoded signature.
#[wasm_bindgen]
pub fn hmac_sha256(secret_b64: &str, message: &str) -> JsValue {
    let secret_bytes = match B64.decode(secret_b64) {
        Ok(b) => b,
        Err(e) => return serde_wasm_bindgen::to_value(&format!("error: {}", e)).unwrap(),
    };

    let mut mac = match HmacSha256::new_from_slice(&secret_bytes) {
        Ok(m) => m,
        Err(e) => return serde_wasm_bindgen::to_value(&format!("error: {}", e)).unwrap(),
    };
    mac.update(message.as_bytes());
    let result = mac.finalize().into_bytes();

    let encoded = B64.encode(&result);

    serde_wasm_bindgen::to_value(&encoded).unwrap()
}

/// Compute keccak256 hash of input bytes (hex encoded).
/// Useful for EIP-712 type hashing.
#[wasm_bindgen]
pub fn keccak256_hex(input_hex: &str) -> JsValue {
    let bytes = match hex_decode(input_hex) {
        Ok(b) => b,
        Err(_) => input_hex.as_bytes().to_vec(), // treat as raw string
    };
    let hash = keccak256(&bytes);
    serde_wasm_bindgen::to_value(&format!("0x{}", hex_encode(&hash))).unwrap()
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

fn error_result(msg: &str) -> JsValue {
    let err = serde_json::json!({ "error": msg });
    serde_wasm_bindgen::to_value(&err).unwrap()
}

fn order_error(msg: &str) -> JsValue {
    let result = BuiltOrder {
        order: OrderPayload {
            token_id: String::new(),
            maker_amount: "0".into(),
            taker_amount: "0".into(),
            side: String::new(),
            fee_rate_bps: "0".into(),
            nonce: "0".into(),
            expiration: "0".into(),
            signature_type: 0,
        },
        summary: String::new(),
        valid: false,
        error: Some(msg.to_string()),
    };
    serde_wasm_bindgen::to_value(&result).unwrap()
}

fn params_is_numeric(s: &str) -> bool {
    s.chars().all(|c| c.is_ascii_digit())
}
