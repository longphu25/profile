#!/bin/bash
# Build WASM module for btc-chart SMC overlay
# Requires: cargo, wasm-pack, rust wasm32-unknown-unknown target
#
# Usage: ./build.sh
# Output: pkg/ + copies to public/plugins/btc-chart/wasm/pkg/

set -e

echo "🔨 Building btc-chart SMC WASM module..."

rustup target add wasm32-unknown-unknown 2>/dev/null || true

# Run Rust tests first
cargo test --release

# Build with wasm-pack (web target)
wasm-pack build --target web --release --out-dir pkg

# Copy to public assets for serving
DEST="$(dirname "$0")/../../../public/plugins/btc-chart/wasm/pkg"
mkdir -p "$DEST"
cp pkg/btc_chart_wasm_bg.wasm "$DEST/"
cp pkg/btc_chart_wasm.js "$DEST/"

echo "✓ WASM built and copied to public/plugins/btc-chart/wasm/pkg/"
echo "  Size: $(du -h pkg/btc_chart_wasm_bg.wasm | cut -f1)"
