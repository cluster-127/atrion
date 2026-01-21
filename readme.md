# Atrion ⚡

> Physics-based concurrency control for Node.js. Replaces static rate limits with Z-Score auto-tuning, deterministic backpressure, and priority-based load shedding.

[![Atrion](.github/assets/banner.jpg)](https://github.com/cluster127/atrion)
[![CI](https://github.com/cluster127/atrion/actions/workflows/ci.yml/badge.svg)](https://github.com/cluster127/atrion/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-141%20passing-brightgreen)]()
[![npm](https://img.shields.io/npm/v/atrion)](https://www.npmjs.com/package/atrion)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

---

## The Problem

Traditional circuit breakers fail in three ways:

| Problem               | Symptom                                                  |
| --------------------- | -------------------------------------------------------- |
| **Binary thinking**   | ON/OFF flapping during recovery                          |
| **Static thresholds** | Night traffic triggers alerts, peak traffic gets blocked |
| **No memory**         | Same route fails 100x, system keeps trying               |

## The Solution: Physics

Atrion models your system as an **electrical circuit**. Each route has _resistance_ that changes based on telemetry:

```
R(t) = R_base + Pressure + Momentum + ScarTissue
```

| Component       | What it does                                         |
| --------------- | ---------------------------------------------------- |
| **Pressure**    | Current load (latency, errors, saturation)           |
| **Momentum**    | Rate of change (detects problems _before_ they peak) |
| **Scar Tissue** | Historical trauma (remembers bad routes)             |

---

## Theory of Operation

> **Why physics instead of heuristics?**

Traditional circuit breakers and rate limiters introduce complex behavior that often leads to complex failures. Atrion takes a different approach: instead of arbitrary static limits, we model traffic as a physical system with predictable, mathematically guaranteed behavior.

### Mathematical Foundation

Atrion is built on **Control Theory** principles (specifically PID-like feedback loops without integral windup) and **Fluid Dynamics**.

```
Traffic ≈ Fluid with Pressure, Resistance, and Momentum
```

The system ensures stability via a **Critical Damping** approach. We calculate a 'Scar Tissue' metric that accumulates based on failure severity and decays over time. This creates a _mathematically guaranteed hysteresis loop_, preventing the 'flapping' (rapid open/close) that plagues standard circuit breakers.

### Gray Failure Detection

> "Dead services are easy. Zombie services are the killers."

Standard health checks fail when a service is _technically alive but behaviorally broken_—responding slowly, returning garbage, or stuck in cleanup loops. Atrion doesn't just count requests; it measures **Service Resistance**.

Consider this scenario:

1. A processing node receives a complex request
2. It takes longer than expected → upstream times out
3. The cancellation triggers cleanup that also takes too long
4. Meanwhile, upstream retries, but the node is still "cleaning up"
5. Requests queue, the original gets resent, and... cascade failure

A standard rate limiter fails here because RPS might be low, but **concurrency saturation is high**.

Atrion detects this through:

| Metric         | What It Catches                     |
| -------------- | ----------------------------------- |
| **Pressure**   | Current concurrency/latency stress  |
| **Resistance** | Degraded responses (slow ≠ healthy) |
| **Momentum**   | Rate of degradation (early warning) |

Even if the node is responding (but slowly/wrongly), the resistance spikes. This triggers protective measures _before_ the cascade begins.

### Momentum-Based Retry Storm Prevention

The "stuck cleanup" scenario has another killer: retry storms. Atrion implements **Momentum-based throttling**:

```
If a node is stuck cleaning up, its 'momentum' remains high
even if current RPS is zero.
```

This physically prevents upstream systems from dumping new retries into a node that hasn't "cooled down" yet, **regardless of timeout settings**. The physics model remembers recent stress even when instantaneous load looks normal.

### Auto-Tuning: Eliminating Magic Numbers

> "Idiots misconfiguring it" is a valid fear.

That's why Atrion uses **Z-Score analysis** instead of hardcoded thresholds:

```
dynamicBreak = μ(R) + 3σ(R)
```

The system calculates baseline latency (μ) and deviation (σ) in real-time. If behavior falls outside 3σ, it clamps down. This removes the "magic number guessing" that leads to misconfiguration:

| Scenario                          | Traditional               | Atrion                     |
| --------------------------------- | ------------------------- | -------------------------- |
| Night traffic (low volume)        | Fixed threshold too loose | Tight threshold (low μ)    |
| Peak hours (high volume)          | Fixed threshold too tight | Relaxed threshold (high μ) |
| New deployment (unknown baseline) | Guess and pray            | Learns within minutes      |

### What This Means in Production

| Failure Mode               | Traditional CB       | Atrion                  |
| -------------------------- | -------------------- | ----------------------- |
| Flapping during recovery   | 49+ transitions      | 1 transition            |
| Zombie service detection   | Miss (still "alive") | Catch (high resistance) |
| Retry storm amplification  | Passthrough          | Momentum blocks         |
| Threshold misconfiguration | Silent failures      | Self-adjusting          |

---

## Quick Start

```bash
npm install atrion
```

### v2.0 API (Recommended)

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

### v1.x API (Still Supported)

```typescript
import { AtrionGuard } from 'atrion'

const guard = new AtrionGuard()

if (!guard.canAccept('api/checkout')) {
  return res.status(503).json({ error: 'Service busy' })
}

guard.reportOutcome('api/checkout', {
  latencyMs: 45,
  isError: false,
  saturation: 0.3,
})
```

---

## Key Features (v2.0)

### 🔌 Pluggable State Architecture (RFC-0008)

Swappable state backends for different deployment scenarios:

```typescript
import { Atrion, InMemoryProvider } from 'atrion'

const atrion = new Atrion({
  provider: new InMemoryProvider(), // Default
  autoTuner: true, // Adaptive thresholds
})
```

| Provider             | Use Case                        |
| -------------------- | ------------------------------- |
| `InMemoryProvider`   | Single-node, development        |
| `RedisStateProvider` | Multi-node cluster (basic sync) |
| Atrion Cloud         | Smart sync, VIP Lanes, HotPatch |

### 🔮 Adaptive Thresholds (RFC-0007)

No more manual tuning. Atrion learns your baseline:

```
dynamicBreak = μ(R) + 3σ(R)
```

Night traffic (low μ) → tight threshold. Peak hours (high μ) → relaxed threshold.

### 🛡️ Priority Load Shedding

Different SLOs for different routes. Protect checkout, shed search:

```typescript
const checkoutGuard = new AtrionGuard({
  config: { scarFactor: 2 }, // Stubborn VIP
})

const searchGuard = new AtrionGuard({
  config: { scarFactor: 20 }, // Expendable
})
```

**Result:** 84% revenue efficiency during Black Friday stress test.

### 🔌 Circuit Breaker That Heals

Standard CB stays open until timeout. Atrion exits when resistance drops:

```
R < 50Ω → Exit CB automatically
```

---

## Validated Results

| Test              | Metric                      | Result                |
| ----------------- | --------------------------- | --------------------- |
| Flapping          | Transitions during recovery | 1 vs 49 (standard CB) |
| LOD Degradation   | Time to quality switch      | 41 ticks (was 91)     |
| CB Recovery       | Exit from circuit breaker   | ✅ at R=49.7Ω         |
| Priority Shedding | Revenue protected           | 84% efficiency        |

---

## Documentation

| RFC                                                                      | Topic               |
| ------------------------------------------------------------------------ | ------------------- |
| [RFC-0001](./documentation/rfc/RFC-0001-core-mathematical-model.md)      | Core Math Model     |
| [RFC-0007](./documentation/rfc/RFC-0007-adaptive-thresholds.md)          | Adaptive Thresholds |
| [RFC-0008](./documentation/rfc/RFC-0008-pluggable-state-architecture.md) | Pluggable State     |

Full index: [documentation/rfc/README.md](./documentation/rfc/README.md)

---

## Wind Tunnel (Lab)

Real-world scenario simulations:

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

## License

Apache-2.0
