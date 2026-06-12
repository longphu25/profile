#!/bin/bash
# Build WASM module for sui-swap plugin.
# Requires: cargo, wasm-pack, rust wasm32-unknown-unknown target.
# Output: ../pkg/ (served by vite at /plugins/sui-swap/pkg/)

set -e
echo "🔨 Building sui-swap WASM module..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true
cargo test --release
wasm-pack build --target web --release --out-dir ../pkg
echo "✓ WASM built → plugins/sui-swap/pkg/"
echo "  Size: $(du -h ../pkg/sui_swap_bg.wasm | cut -f1)"
