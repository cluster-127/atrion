# RFC-0009: Performance Layer Architecture

**Status:** Endorsed ✅
**Author:** Atrion Team
**Created:** 2026-01-21
**Target:** v2.0+
**Recommendation:** Skip Tier 1-2, proceed directly to **Tier 3 (Rust/WASM)**

---

## Abstract

This RFC proposes a tiered performance optimization strategy for Atrion, culminating in a **Rust/WASM physics core** that can achieve 10-50x throughput improvements while maintaining the TypeScript API surface.

---

## Motivation

Current TypeScript implementation is:

- ✅ Correct
- ✅ Readable
- ✅ Production-ready
- ⚠️ Not optimized for extreme scale (>100k ops/s)

**Target Use Cases:**

1. Edge computing (Cloudflare Workers, Vercel Edge)
2. High-frequency trading admission control
3. Real-time gaming server protection
4. Browser-side client simulation

---

## Performance Tiers

### Tier 1: TypeScript Micro-Optimizations

**Effort:** Low | **Impact:** 2-3x

| Optimization     | Description                  | Benefit                 |
| ---------------- | ---------------------------- | ----------------------- |
| Object Pooling   | Reuse RouteState objects     | Reduce GC pressure      |
| Lookup Tables    | Pre-computed tanh/exp values | Avoid Math.tanh() calls |
| Typed Arrays     | Float64Array for vectors     | Cache-friendly          |
| Inline Functions | Manual inlining of hot paths | Reduce call overhead    |

```typescript
// Before
const magnitude = VectorMath.magnitude(pressure)

// After (inlined)
const magnitude = Math.sqrt(pressure.latency ** 2 + pressure.error ** 2 + pressure.saturation ** 2)
```

---

### Tier 2: Node.js Native Addons (N-API)

**Effort:** Medium | **Impact:** 5-10x

C++ implementation with N-API bindings:

```
┌──────────────────────────────────┐
│  TypeScript (Atrion, Manager)    │
├──────────────────────────────────┤
│  N-API Bridge                    │
├──────────────────────────────────┤
│  C++ Physics Core                │
│  - SIMD vector operations        │
│  - Custom memory allocator       │
└──────────────────────────────────┘
```

**Pros:**

- Direct V8 integration
- No serialization overhead
- SIMD support

**Cons:**

- Platform-specific builds
- Complex build pipeline
- Not browser-compatible

---

### Tier 3: Rust + WASM (Recommended) 🦀

**Effort:** Medium-High | **Impact:** 10-50x

```
┌──────────────────────────────────────────────────┐
│  TypeScript API Layer                            │
│  - Atrion class                                  │
│  - StateProvider interface                       │
│  - Telemetry/RouteDecision types                 │
├──────────────────────────────────────────────────┤
│  WASM Bridge (wasm-bindgen)                      │
│  - Zero-copy TypedArray transfer                 │
│  - Serde for complex types                       │
├──────────────────────────────────────────────────┤
│  Rust Physics Core (atrion-physics)              │
│  - PhysicsEngine struct                          │
│  - update_physics()                              │
│  - calculate_resistance()                        │
│  - VectorMath (SIMD)                             │
└──────────────────────────────────────────────────┘
```

#### Rust Crate Structure

```
atrion-physics/
├── Cargo.toml
├── src/
│   ├── lib.rs           # WASM exports
│   ├── engine.rs        # PhysicsEngine
│   ├── vector.rs        # VectorMath (SIMD)
│   ├── resistance.rs    # Ohm's Law
│   ├── scar.rs          # Trauma accumulation
│   └── types.rs         # Branded types
└── tests/
```

#### Key Rust Implementations

```rust
// types.rs
#[derive(Copy, Clone)]
pub struct Ohms(f64);

#[derive(Copy, Clone)]
pub struct Scar(f64);

#[repr(C)]
pub struct PressureVector {
    pub latency: f64,
    pub error: f64,
    pub saturation: f64,
}

// vector.rs (SIMD)
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

pub fn magnitude_simd(v: &PressureVector) -> f64 {
    unsafe {
        let vec = _mm256_set_pd(0.0, v.saturation, v.error, v.latency);
        let squared = _mm256_mul_pd(vec, vec);
        // horizontal sum...
    }
}

// resistance.rs
pub fn calculate_resistance(
    pressure: &PressureVector,
    momentum: f64,
    scar: Scar,
    weights: &SensitivityWeights,
    config: &PhysicsConfig,
    staleness: f64,
) -> Ohms {
    let weighted = pressure.latency * weights.w_latency
        + pressure.error * weights.w_error
        + pressure.saturation * weights.w_saturation;

    let damping = config.damping_factor * momentum;
    let total = config.base_resistance + weighted + damping + scar.0 + staleness;

    Ohms(total.max(config.base_resistance))
}
```

#### TypeScript Integration

```typescript
// After WASM integration
import { PhysicsEngine } from 'atrion-physics'

const engine = new PhysicsEngine(config)

// Hot path - calls into WASM
const resistance = engine.updatePhysics(routeId, pressure, deltaT)
```

---

## Benchmark Targets

| Metric                    | Current (TS) | Tier 1  | Tier 2 | Tier 3 (WASM) |
| ------------------------- | ------------ | ------- | ------ | ------------- |
| `updatePhysics()` latency | ~50μs        | ~20μs   | ~5μs   | **<2μs**      |
| Throughput (ops/s)        | 20k          | 50k     | 200k   | **500k+**     |
| Memory per route          | 500B         | 400B    | 200B   | **128B**      |
| GC pauses                 | Yes          | Reduced | None   | **None**      |
| Browser support           | ❌           | ❌      | ❌     | **✅**        |

---

## Implementation Phases

### Phase 1: Hybrid Architecture (v2.0)

1. Create `atrion-physics` Rust crate
2. Implement core physics functions
3. WASM build pipeline (wasm-pack)
4. Optional import in TypeScript
5. Feature flag: `ATRION_USE_WASM=true`

### Phase 2: Full Integration (v2.1)

1. WASM as default physics engine
2. TypeScript fallback for compatibility
3. Streaming state updates (SharedArrayBuffer)
4. Worker thread offloading

### Phase 3: Extended Platform Support (v2.2)

1. Cloudflare Workers compatibility
2. Deno support
3. Browser-side simulation
4. React/Vue devtools integration

---

## Trade-offs

| Aspect                   | TypeScript   | Rust/WASM               |
| ------------------------ | ------------ | ----------------------- |
| **Build complexity**     | Simple       | +wasm-pack, +Cargo      |
| **Bundle size**          | 0            | +50-100KB gzipped       |
| **Debugging**            | Easy         | Source maps needed      |
| **Contribution barrier** | Low          | Higher (Rust knowledge) |
| **Performance**          | Baseline     | 10-50x faster           |
| **Determinism**          | GC dependent | Fully deterministic     |

---

## Alternatives Considered

### AssemblyScript

- **Pros:** TypeScript-like syntax
- **Cons:** Less mature, fewer optimizations
- **Verdict:** Rust ecosystem more robust

### Go + WASM

- **Pros:** Familiar to some
- **Cons:** Large runtime, GC in WASM
- **Verdict:** Defeats purpose

### Zig

- **Pros:** No hidden control flow
- **Cons:** Less mature ecosystem
- **Verdict:** Future consideration

---

## Success Criteria

- [ ] `updatePhysics()` < 2μs (p99)
- [ ] 500k+ ops/s on single thread
- [ ] Zero GC pauses during physics
- [ ] Browser demo running real-time
- [ ] All 141+ tests pass with WASM backend

---

## Appendix: Quick Start (Future)

```bash
# Install with WASM support
npm install atrion atrion-physics

# Enable WASM backend
export ATRION_USE_WASM=true

# Or programmatically
import { Atrion } from 'atrion'
import { createWasmEngine } from 'atrion-physics'

const atrion = new Atrion({
  engine: await createWasmEngine(),
})
```

---

**Status:** Awaiting feedback before RFC finalization.
