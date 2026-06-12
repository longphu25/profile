#!/bin/bash
# Build WASM module for sui-swap plugin
# Requires: cargo, wasm-pack, rust wasm32-unknown-unknown target
#
# Usage: ./build.sh
# Output: pkg/ directory with .wasm + JS bindings

set -e

echo "🔨 Building sui-swap WASM module..."

# Ensure target is installed
rustup target add wasm32-unknown-unknown 2>/dev/null || true

# Build with wasm-pack (web target for browser usage)
wasm-pack build --target web --release --out-dir pkg

# Copy to plugin's public assets for serving
DEST="$(dirname "$0")/../../../public/plugins/sui-swap/wasm/pkg"
mkdir -p "$DEST"
cp pkg/sui_swap_wasm_bg.wasm "$DEST/"
cp pkg/sui_swap_wasm.js "$DEST/"

echo "✓ WASM built and copied to public/plugins/sui-swap/wasm/pkg/"
echo "  Size: $(du -h pkg/sui_swap_wasm_bg.wasm | cut -f1)"
