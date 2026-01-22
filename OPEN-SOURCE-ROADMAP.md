# Atrion Open-Source Roadmap

> Physics-based concurrency control for Node.js — Apache-2.0

---

## Philosophy

**"Self-host the full engine. Scale with Atrion Cloud when ready."**

Atrion follows the **Sentry/Datadog model**: the complete physics engine is open-source and self-hostable. Atrion Cloud provides managed infrastructure, enhanced observability, and enterprise features.

---

## Current: v1.3.1 ✅

**Pluggable State Architecture** (2026-01-21)

### Core Physics Engine

| Feature              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| **Resistance Model** | `R(t) = R_base + Pressure + Momentum + ScarTissue`    |
| **Momentum**         | Rate-of-change detection (catch problems before peak) |
| **Scar Tissue**      | Historical trauma memory (remember bad routes)        |
| **Check Valve**      | Only positive pressure accumulates trauma             |

### AutoTuner (Zero-Config)

| Feature                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Z-Score Thresholds** | `dynamicBreak = μ + kσ`                              |
| **EMA Learning**       | Exponential moving average baseline                  |
| **Hybrid Limits**      | `minFloor` + `hardCeiling` (Boiling Frog protection) |

### Pluggable State (RFC-0008)

| Provider               | Description              |
| ---------------------- | ------------------------ |
| **InMemoryProvider**   | Default, zero-dependency |
| **RedisStateProvider** | Basic cluster sync       |

### Validation

- ✅ 141 passing tests
- ✅ 13 Wind Tunnel scenarios
- ✅ Flapping: 1 transition vs 49 (standard CB)

---

## Next: v2.0.0 🚧

**Major Release: Performance + Workload Profiles**

### RFC-0009: Rust/WASM Physics Engine ✅ (alpha)

| Feature                    | Status                                 |
| -------------------------- | -------------------------------------- |
| **586M ops/s**             | ✅ Sub-nanosecond physics calculations |
| **2.11ns latency**         | ✅ 1000x faster than TypeScript        |
| **SIMD**                   | ✅ AVX2 (native) + SIMD128 (WASM)      |
| **13.2KB bundle**          | ✅ Minimal overhead                    |
| **TypeScript integration** | ✅ `useWasm` feature flag              |
| **Differential testing**   | ✅ TS/WASM parity verified             |

### RFC-0010: Workload Profiles 🚧 (in progress)

| Feature                            | Status |
| ---------------------------------- | ------ |
| Profile Types (LIGHT → EXTREME)    | 🚧     |
| Profile-aware pressure calculation | 🚧     |
| Lease API                          | 🚧     |
| AbortController integration        | 🚧     |
| AI Swarm support                   | 🚧     |

---

## API Surface

### Current (v1.x)

```typescript
import { Atrion } from 'atrion'

const atrion = new Atrion()
await atrion.connect()

const decision = atrion.route('api/checkout', {
  latencyMs: 45,
  errorRate: 0.01,
})

if (!decision.allow) {
  return res.status(503).json({ error: decision.reason })
}
```

### v2.0.0 (with WASM)

```typescript
import { Atrion } from 'atrion'

const atrion = new Atrion({
  useWasm: true, // 586M ops/s 🚀
})
await atrion.connect()
```

---

## Self-Hosted vs Cloud

| Capability             | Self-Hosted (Free) | Atrion Cloud  |
| ---------------------- | ------------------ | ------------- |
| **Core Physics**       | ✅ Full            | ✅ Full       |
| **Rust/WASM**          | ✅ Full (v2.0+)    | ✅ Full       |
| **AutoTuner**          | ✅ Full            | ✅ Full       |
| **InMemoryProvider**   | ✅                 | ✅            |
| **RedisStateProvider** | ✅ Basic sync      | ✅ Smart sync |
| **Decision Dashboard** | ❌                 | ✅            |
| **VIP Lanes**          | ❌                 | ✅            |
| **HotPatch**           | ❌                 | ✅            |
| **GossipBan**          | ❌                 | ✅            |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
npm install
npm test
npm run build:wasm  # Build Rust/WASM (v2.0)
```

---

## License

Apache-2.0

---

_"Self-host the brains. Let us handle the headaches."_
