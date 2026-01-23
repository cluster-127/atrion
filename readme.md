# Atrion

> Physics-based concurrency control for Node.js. Replaces static rate limits with adaptive thresholds, deterministic backpressure, and priority-based load shedding.

[![Atrion](.github/assets/banner.jpg)](https://github.com/cluster-127/atrion)
[![CI](https://github.com/cluster-127/atrion/actions/workflows/ci.yml/badge.svg)](https://github.com/cluster-127/atrion/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-184%20passing-brightgreen)](https://github.com/cluster-127/atrion/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/atrion)](https://www.npmjs.com/package/atrion)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

---

## Philosophy

> **"Don't forbid wrong behavior. Make it physically unsustainable."**

Atrion models your system as an **electrical circuit**. Each route has _resistance_ that changes based on telemetry:

```
R(t) = R_base + Pressure + Momentum + ScarTissue
```

| Component       | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Pressure**    | Current load (latency, errors, saturation)           |
| **Momentum**    | Rate of change (detects problems _before_ they peak) |
| **Scar Tissue** | Historical trauma (remembers bad routes)             |

This is **Conditioned Deterministic Orchestration (CDO)** — traffic routing as flow through impedance networks, where erroneous paths become physically inaccessible rather than explicitly forbidden.

---

## The Problem

Traditional fault tolerance mechanisms fail in predictable ways:

| Mechanism       | Failure Mode                                            |
| --------------- | ------------------------------------------------------- |
| Circuit Breaker | Binary ON/OFF flapping during recovery                  |
| Rate Limiting   | Static thresholds: night traffic triggers, peak blocked |
| Retry Backoff   | Reactive, wastes resources on doomed requests           |
| Health Checks   | Misses "zombie" services (alive but broken)             |

### Gray Failure Detection

Standard health checks fail when a service is _technically alive but behaviorally broken_. Atrion measures **Service Resistance** — even if a node responds (but slowly or incorrectly), resistance spikes and triggers protective measures _before_ cascade begins.

---

## Quick Start

```bash
npm install atrion
```

### Basic Usage

```typescript
import { Atrion } from 'atrion'

const atrion = new Atrion()
await atrion.connect()

// Make routing decision
const decision = atrion.route('api/checkout', {
  latencyMs: 45,
  errorRate: 0.01,
  saturation: 0.3,
})

if (!decision.allow) {
  return res.status(503).json({ error: decision.reason })
}

// decision.resistance = current Ω
// decision.mode = 'BOOTSTRAP' | 'OPERATIONAL' | 'CIRCUIT_BREAKER'
```

### Workload Profiles

Different baselines for different workloads — a 30-minute ML job should not trigger circuit breaker:

```typescript
// Short-lived API (default)
atrion.route('api/users', telemetry)

// Heavy computation
atrion.route('ml/inference', telemetry, { profile: 'HEAVY' })

// Long-running task with lease
const lease = await atrion.startTask('genom/sequence', {
  profile: 'EXTREME',
  abortController: controller, // Required for HEAVY/EXTREME
})

lease.heartbeat({ progress: 0.5 })
await lease.release()
```

| Profile    | Baseline Latency | Use Case                  |
| ---------- | ---------------- | ------------------------- |
| `LIGHT`    | 10ms             | Health checks, pings      |
| `STANDARD` | 100ms            | REST APIs                 |
| `HEAVY`    | 5s               | Video transcode, ML       |
| `EXTREME`  | 60s              | Genome sequencing, Swarms |

---

## Performance

### Rust/WASM Physics Engine

Atrion v2.0 ships with an optional Rust-powered physics core compiled to WebAssembly:

```typescript
const atrion = new Atrion({
  engine: 'auto', // Default: tries WASM, falls back to TypeScript
  // engine: 'wasm'  // Force WASM (throws if unavailable)
  // engine: 'ts'    // Force TypeScript
})
```

#### Benchmark Results

| Metric                | TypeScript | Rust/WASM      | Improvement  |
| --------------------- | ---------- | -------------- | ------------ |
| `calculateResistance` | ~50μs      | 2.11 ns        | ~25,000x     |
| Throughput            | ~20k ops/s | 586M ops/s     | ~29,000x     |
| GC Pauses             | Yes        | None           | Deterministic|

WASM bundle size: 13.2KB gzipped. SIMD support: AVX2 (native), SIMD128 (WASM).

See [RFC-0009](./documentation/rfc/RFC-0009-performance-layer.md) for technical details.

---

## Key Features

### Adaptive Thresholds

Atrion eliminates manual threshold configuration through Z-Score based auto-tuning:

```
dynamicBreak = μ(R) + 3σ(R)
```

| Scenario         | Static Thresholds     | Atrion                   |
| ---------------- | --------------------- | ------------------------ |
| Low traffic      | Threshold too loose   | Tight threshold (low μ)  |
| Peak traffic     | Threshold too tight   | Relaxed threshold (high μ)|
| New deployment   | Manual configuration  | Learns within minutes    |

### Pluggable State Architecture

Swappable backends for different deployment scenarios:

```typescript
import { Atrion, InMemoryProvider, RedisStateProvider } from 'atrion'

const atrion = new Atrion({
  provider: new InMemoryProvider(), // Default: single-node
  // provider: new RedisStateProvider(redis) // Multi-node cluster
})
```

| Provider             | Use Case                        |
| -------------------- | ------------------------------- |
| `InMemoryProvider`   | Single-node, development        |
| `RedisStateProvider` | Multi-node cluster (basic sync) |

### Priority Load Shedding

Configure different SLOs per route. Protect revenue-critical paths while shedding non-essential traffic:

```typescript
atrion.setRouteProfile('api/checkout', { scarFactor: 2 })  // High priority
atrion.setRouteProfile('api/search', { scarFactor: 20 })   // Lower priority
```

Validated result: 84% revenue efficiency during Black Friday stress simulation.

### Self-Healing Circuit Breaker

Standard circuit breakers remain open until timeout. Atrion exits circuit breaker state automatically when resistance drops below threshold:

```
R < 50Ω → Exit circuit breaker
```

---

## Validated Results

| Test              | Metric                    | Result                |
| ----------------- | ------------------------- | --------------------- |
| Flapping          | Transitions during stress | 1 vs 49 (standard CB) |
| Gray Failure      | Zombie detection          | Detected via R spike  |
| CB Recovery       | Exit from circuit breaker | At R=49.7Ω            |
| Priority Shedding | Revenue protected         | 84% efficiency        |
| WASM Parity       | TS vs Rust differential   | 9/9 tests passing     |

---

## Documentation

| RFC                                                                      | Topic                   | Status      |
| ------------------------------------------------------------------------ | ----------------------- | ----------- |
| [RFC-0001](./documentation/rfc/RFC-0001-core-mathematical-model.md)      | Core Mathematical Model | Implemented |
| [RFC-0007](./documentation/rfc/RFC-0007-adaptive-thresholds.md)          | Adaptive Thresholds     | Implemented |
| [RFC-0008](./documentation/rfc/RFC-0008-pluggable-state-architecture.md) | Pluggable State         | Implemented |
| [RFC-0009](./documentation/rfc/RFC-0009-performance-layer.md)            | Rust/WASM Performance   | Implemented |
| [RFC-0010](./documentation/rfc/RFC-0010-workload-profiles.md)            | Workload Profiles       | Implemented |

Full RFC index: [documentation/rfc/README.md](./documentation/rfc/README.md)

---

## Wind Tunnel

Real-world scenario simulations in the `lab/` directory:

```bash
# E-Commerce: VIP priority during DB stress
npx tsx lab/ecommerce/ecommerce-server.ts
npx tsx lab/ecommerce/blackfriday-client.ts

# Circuit Breaker: Recovery validation
npx tsx lab/cb-recovery/cb-server.ts
npx tsx lab/cb-recovery/recovery-client.ts
```

See [lab/README.md](./lab/README.md) for all scenarios.

---

## Roadmap

| Version | Status      | Highlights                      |
| ------- | ----------- | ------------------------------- |
| v2.0.0  | Released    | WASM default, Workload Profiles |
| v2.1.0  | In Progress | AI Swarm, Dynamic Profiles      |
| v3.x    | Planned     | Dashboard, Prometheus, OpenTel  |

See [ROADMAP.md](./ROADMAP.md) for details.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0
