#!/bin/bash
# Build WASM module for btc-chart plugin.
# Requires: cargo, wasm-pack, rust wasm32-unknown-unknown target.
# Output: ../pkg/ (served by vite at /plugins/btc-chart/pkg/)

set -e
echo "🔨 Building btc-chart WASM module..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true
cargo test --release
wasm-pack build --target web --release --out-dir ../pkg
echo "✓ WASM built → plugins/btc-chart/pkg/"
echo "  Size: $(du -h ../pkg/btc_chart_wasm_bg.wasm | cut -f1)"
