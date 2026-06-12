#!/bin/bash
# Build WASM module for predict-club indicator signals.
# Requires: cargo, wasm-pack, rust wasm32-unknown-unknown target.
# Output: ../pkg/ (served by vite at /plugins/predict-club/pkg/)

set -e
echo "🔨 Building predict-club WASM module..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true
cargo test --release
wasm-pack build --target web --release --out-dir ../pkg
echo "✓ WASM built → plugins/predict-club/pkg/"
echo "  Size: $(du -h ../pkg/predict_club_wasm_bg.wasm | cut -f1)"
