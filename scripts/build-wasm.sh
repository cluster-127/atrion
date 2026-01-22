#!/bin/bash
#
# Build WASM Physics Engine
#
# Compiles Rust physics core to WASM and copies to src/core/wasm
#

set -e

echo "🦀 Building Rust/WASM physics engine..."

cd atrion-physics

# Build WASM with wasm-pack
wasm-pack build --target web --out-dir pkg

echo "✅ WASM build complete"
echo "📦 Bundle size:"
ls -lh pkg/atrion_physics_bg.wasm | awk '{print $5}'

# TODO: wasm-opt optimization (when bulk memory flags resolved)
# wasm-opt pkg/atrion_physics_bg.wasm -O3 -o pkg/atrion_physics_bg.wasm

cd ..

echo "🎉 WASM physics engine ready!"
