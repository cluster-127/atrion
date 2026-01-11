# Atrion ⚡

> Physics-based concurrency control for Node.js. Replaces static rate limits with Z-Score auto-tuning, deterministic backpressure, and priority-based load shedding.

[![CI](https://github.com/laphilosophia/atrion/actions/workflows/ci.yml/badge.svg)](https://github.com/laphilosophia/atrion/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-114%20passing-brightgreen)]()
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

## Quick Start

```bash
npm install atrion
```

```typescript
import { AtrionGuard } from 'atrion'

const guard = new AtrionGuard()

// Before request
if (!guard.canAccept('api/checkout')) {
  return res.status(503).json({ error: 'Service busy' })
}

// After request
guard.reportOutcome('api/checkout', {
  latencyMs: 45,
  isError: false,
  saturation: 0.3,
})
```

---

## Key Features (v1.2.0)

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
