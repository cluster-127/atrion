# Atrion ⚡

> Deterministic Physics Engine for Adaptive Traffic Orchestration

[![CI](https://github.com/laphilosophia/atrion/actions/workflows/ci.yml/badge.svg)](https://github.com/laphilosophia/atrion/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-104%20passing-brightgreen)]()
[![Stability](https://img.shields.io/badge/stability-90.2%25-blue)]()
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

> **"Atrion doesn't just break circuits; it heals them."**

---

## Why Atrion?

Unlike binary Circuit Breakers (Open/Closed), Atrion uses a **Physics Engine** to model system health as analog states.

| Feature      | Standard Circuit Breaker  | Atrion CDO               |
| :----------- | :------------------------ | :----------------------- |
| **State**    | Binary (Open/Closed)      | Analog (0Ω → ∞Ω)         |
| **Recovery** | Flapping (49 transitions) | Damped (1 transition)    |
| **Memory**   | Stateless                 | Scar Tissue (Hysteresis) |
| **Routing**  | Manual Failover           | Auto (69% traffic shift) |

---

## Abstract

**Atrion** reimagines fault tolerance in distributed systems. Instead of rule-based policy enforcement, CDO models traffic routing as a **fluid dynamics problem** where erroneous paths become physically inaccessible due to rising impedance.

> **"Don't forbid wrong behavior. Make it physically unsustainable."**

---

## Quick Start

```bash
npm install atrion
```

```typescript
import {
  updatePhysics,
  deriveBaselines,
  createPhysicsConfig,
  type PhysicsState,
  type SLOConfig,
} from 'atrion'

// 1. Define your SLO (Service Level Objectives)
const slo: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01,
  criticality: { latency: 5, error: 10, saturation: 5 },
}

// 2. Create physics configuration
const config = createPhysicsConfig(slo)
const baselines = deriveBaselines(slo)

// 3. Initialize state
let state: PhysicsState = {
  resistance: config.baseResistance,
  momentum: { latency: 0, error: 0, saturation: 0 },
  scar: 0,
  lastPressure: { latency: 0, error: 0, saturation: 0 },
}

// 4. Update on each telemetry tick
const telemetry = { latency: 75, error: 0.02, saturation: 0.3 }
state = updatePhysics(state, telemetry, baselines, config, 100, Date.now())

// 5. Use resistance for routing decisions
const shouldRoute = state.resistance < config.baseResistance * 5
console.log(`Resistance: ${state.resistance}Ω, Route: ${shouldRoute}`)
```

---

## Core Philosophy

| Traditional Approach        | CDO Approach                   |
| --------------------------- | ------------------------------ |
| Binary decisions (ON/OFF)   | Analog resistance (0 → ∞)      |
| Reactive (wait for failure) | Proactive (momentum-based)     |
| Stateless (no memory)       | Hysteresis (scar tissue)       |
| Explicit rejection          | Natural shedding via impedance |

---

## The Four Axioms

1. **Decision → Flow:** Routing is potential energy (Voltage) overcoming dynamic resistance (Impedance)
2. **Constraint → Dynamic Resistance:** Limits are variable forces, not static walls
3. **Memory → Scar Tissue:** Past failures leave topological traces that decay over time
4. **Rejection → Impedance:** Requests are shed when voltage cannot overcome resistance

---

## Mathematical Foundation

### Pressure Vector

$$
\vec{P}(t) = \begin{bmatrix} p_{\text{lat}} \\ p_{\text{err}} \\ p_{\text{sat}} \end{bmatrix} \in [-1, 1]^3
$$

Normalized via $\tanh$ for gradient preservation at bounds.

### Momentum (Proactive Control)

$$
\vec{M}(t) = \frac{\vec{P}(t) - \vec{P}(t-1)}{\Delta t}
$$

The system brakes **before** hitting the wall, not after.

### Law of Impedance

$$
\boxed{R(t) = R_{\text{base}} + (\vec{P}^T \mathbf{W}) + \mu\|\vec{M}\| + S(t)}
$$

| Term                   | Role                                 |
| ---------------------- | ------------------------------------ |
| $R_{\text{base}}$      | Static topological cost              |
| $\vec{P}^T \mathbf{W}$ | Weighted pressure contribution       |
| $\mu\|\vec{M}\|$       | Momentum damping (proactive braking) |
| $S(t)$                 | Scar tissue (historical trauma)      |

### Flow Decision

$$
\text{Flow} = \begin{cases} 1 & V > R \\ 0 & V \leq R \end{cases}
$$

---

## Documentation

Comprehensive RFC documentation is available:

| RFC                                                                      | Title                     | Description                             |
| ------------------------------------------------------------------------ | ------------------------- | --------------------------------------- |
| [RFC-0001](./documentation/rfc/RFC-0001-core-mathematical-model.md)      | Core Mathematical Model   | State space, impedance law, stability   |
| [RFC-0002](./documentation/rfc/RFC-0002-theoretical-extensions.md)       | Theoretical Extensions    | SLO weights, tanh, multi-rate sampling  |
| [RFC-0003](./documentation/rfc/RFC-0003-stability-analysis.md)           | Stability Analysis        | Lyapunov, failure modes, validation     |
| [RFC-0004](./documentation/rfc/RFC-0004-implementation-guidelines.md)    | Implementation Guidelines | Mental models, invariants, contracts    |
| [RFC-0005](./documentation/rfc/RFC-0005-research-roadmap.md)             | Research Roadmap          | Open questions, bibliography            |
| [RFC-0006](./documentation/rfc/RFC-0006-visual-metaphors.md)             | Visual Metaphors          | Mermaid diagrams, hydraulic analogy     |
| [RFC-0007](./documentation/rfc/RFC-0007-adaptive-thresholds.md)          | Adaptive Thresholds       | AutoTuner, μ+kσ, neuroplasticity        |
| [RFC-0008](./documentation/rfc/RFC-0008-pluggable-state-architecture.md) | Pluggable State (v2)      | StateProvider, cluster sync, commercial |

**Start here:** [RFC Index](./documentation/rfc/README.md) | [Glossary](./documentation/rfc/GLOSSARY.md)

---

## Project Status

| Phase                       | Status                      |
| --------------------------- | --------------------------- |
| Theoretical Foundation      | ✅ Complete (6 RFCs)        |
| Core Physics Implementation | ✅ Complete (80 unit tests) |
| Simulation Infrastructure   | ✅ Complete                 |
| Hypothesis Validation       | ✅ Complete (H1, H2, H3)    |
| Stability Mapping           | ✅ Complete (90.2%)         |
| NPM Published               | ✅ v1.0.0                   |

**Test Coverage:** 104/104 ✅

---

## Project Structure

```
atrion/
├── documentation/
│   └── rfc/                    # Request for Comments (6 documents)
│       ├── README.md           # Index and quick reference
│       ├── GLOSSARY.md         # Terminology
│       ├── RFC-0001-*.md       # Core Model
│       ├── RFC-0002-*.md       # Extensions
│       ├── RFC-0003-*.md       # Stability
│       ├── RFC-0004-*.md       # Implementation
│       ├── RFC-0005-*.md       # Research
│       └── RFC-0006-*.md       # Diagrams
├── src/                        # (Planned) Implementation
│   ├── core/                   # Pure physics functions
│   └── simulation/             # Validation environment
├── tests/                      # (Planned) Hypothesis validation
└── readme.md                   # This file
```

---

## Research Hypotheses (Validated ✅)

All three core hypotheses have been scientifically validated:

| Hypothesis         | Claim                                                                               | Result                 |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------- |
| **H1: Momentum**   | Derivative-based resistance eliminates flapping observed in binary circuit breakers | ✅ 1 vs 49 transitions |
| **H2: Entropy**    | Mathematical decay prevents deadlocks without explicit health checks                | ✅ Half-Life: 4 ticks  |
| **H3: Remodeling** | Scar tissue routes traffic away from unstable nodes without manual intervention     | ✅ 69% traffic shift   |

---

## Key Innovations

### 1. Analog vs Binary

Traditional circuit breakers oscillate (open/close). CDO provides smooth, proportional resistance.

### 2. Proactive Damping

Momentum ($\frac{dP}{dt}$) triggers resistance increase **before** crisis peaks.

### 3. Structural Memory

Scar tissue creates hysteresis — the system "remembers" and "distrusts" historically problematic routes.

### 4. Physics-Based Load Balancing

Traffic naturally flows to lowest-resistance paths via Softmax selection:

$$
\Pr(\text{route}_j) = \frac{e^{-\beta R_j}}{\sum_k e^{-\beta R_k}}
$$

---

## Theoretical Constraints Addressed

| Constraint                  | Solution                   | RFC           |
| --------------------------- | -------------------------- | ------------- |
| Weight Matrix determination | SLO-driven derivation      | RFC-0002 §1.1 |
| Lyapunov stability          | Numerical validation suite | RFC-0003 §1   |
| Cold start problem          | Bootstrap protocol         | RFC-0002 §3.3 |
| Cascade failure             | Hybrid safety valve        | RFC-0002 §4.1 |
| Telemetry delay             | Predictive extrapolation   | RFC-0002 §3.2 |
| Normalization bounds        | tanh soft-bounding         | RFC-0002 §2.1 |

---

## Stability

> ✅ **Production Ready (v1.0.0)**
>
> This physics engine has been validated through:
>
> - **104 passing tests** (unit, integration, hypothesis)
> - **90.2% stability** across 100 parameter configurations
> - **3 scientific hypotheses** proven (Momentum, Entropy, Auto-Routing)
>
> See the [Stability Map](#stability-map) for parameter safety zones.

---

## License

Apache-2.0 — See [LICENSE](LICENSE) for details.

---

## References

See [RFC-0005: Research Roadmap](./documentation/rfc/RFC-0005-research-roadmap.md) for comprehensive bibliography including:

- Wiener, N. (1948). _Cybernetics_
- Ashby, W. R. (1956). _An Introduction to Cybernetics_
- Strogatz, S. H. (2015). _Nonlinear Dynamics and Chaos_
- Meadows, D. H. (2008). _Thinking in Systems_
