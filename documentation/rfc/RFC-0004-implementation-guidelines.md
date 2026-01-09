# RFC-0004: Implementation Guidelines

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| **RFC**        | 0004                                                |
| **Title**      | Implementation Mental Models and Design Constraints |
| **Status**     | Draft                                               |
| **Created**    | 2026-01-09                                          |
| **Depends On** | RFC-0001, RFC-0002, RFC-0003                        |

---

## Abstract

This RFC defines the mental models, invariants, and behavioral contracts for implementing the CDO physics engine. It deliberately avoids concrete code implementations to remain language-agnostic and resilient to theoretical evolution.

---

## 1. Core Design Philosophy

### 1.1. Functional Core, Imperative Shell

**Mental Model:**

```
┌─────────────────────────────────────────────────┐
│              IMPERATIVE SHELL                   │
│  (I/O, Network, Side Effects, Time)             │
│                                                 │
│     ┌───────────────────────────────────┐       │
│     │        FUNCTIONAL CORE            │       │
│     │  (Pure Math, No Side Effects)     │       │
│     │                                   │       │
│     │  f(state, input) → new_state      │       │
│     └───────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Invariant:** The physics engine MUST be a pure function. Given identical inputs, it MUST produce identical outputs regardless of when or where it runs.

**Anti-Pattern:**

- ❌ Reading system time inside physics calculations
- ❌ Making network calls from physics functions
- ❌ Mutating shared state

### 1.2. Data-Oriented Design

**Mental Model:** Separate "what data exists" from "what operations act on data."

**Invariant:** All state MUST be represented as immutable data structures. Updates return new copies, never mutate in place.

**Anti-Pattern:**

- ❌ Classes with mutable internal state
- ❌ Methods that modify `this`
- ❌ Global mutable singletons

---

## 2. Type Contracts

### 2.1. Pressure Vector

**Definition:** A 3-dimensional vector representing system stress.

**Domain:** $\vec{P} \in [-1, 1]^3$

| Component  | Semantic               | Value Interpretation                   |
| ---------- | ---------------------- | -------------------------------------- |
| latency    | Response time pressure | -1 = fast, 0 = baseline, +1 = critical |
| error      | Error density          | -1 = clean, 0 = normal, +1 = failure   |
| saturation | Resource utilization   | -1 = idle, 0 = optimal, +1 = exhausted |

**Invariants:**

- $\forall c \in \{lat, err, sat\}: -1 \leq p_c \leq 1$
- Normalization via $\tanh$ preserves gradient at bounds
- Components are semantically independent (no implicit coupling)

### 2.2. Route Physics State

**Definition:** Complete physics state for a single route at time $t$.

**Required Fields:**

| Field              | Type           | Semantics                         |
| ------------------ | -------------- | --------------------------------- |
| `routeId`          | string         | Unique identifier                 |
| `pressure`         | PressureVector | Current normalized stress         |
| `previousPressure` | PressureVector | State at $t-1$ (for momentum)     |
| `momentum`         | scalar         | $\|\vec{M}(t)\|$ magnitude        |
| `scarTissue`       | scalar ≥ 0     | Accumulated historical resistance |
| `resistance`       | scalar ≥ 0     | Computed total impedance          |
| `mode`             | enum           | Operational state machine         |
| `lastUpdatedAt`    | timestamp      | For staleness calculation         |
| `tickCount`        | integer ≥ 0    | Bootstrap tracking                |

**Invariants:**

- `scarTissue ≥ 0` (scar never goes negative)
- `resistance ≥ baseResistance` (always at least base cost)
- `previousPressure` MUST be `pressure` from prior tick

### 2.3. Operational Mode

**Definition:** State machine governing physics behavior.

```
                    ┌───────────────┐
                    │   BOOTSTRAP   │
                    │ (Observer)    │
                    └───────┬───────┘
                            │ tickCount ≥ N_bootstrap
                            ▼
                    ┌───────────────┐
         ┌──────────│  OPERATIONAL  │◄─────────┐
         │          │ (Full Physics)│          │
         │          └───────┬───────┘          │
         │                  │ R ≥ R_break      │
         │ S < S_recovery   ▼                  │
         │ AND        ┌───────────────┐        │
         │ P < P_safe │CIRCUIT_BREAKER│        │
         └────────────│ (Hard Cutoff) │────────┘
                      └───────────────┘
```

**Invariants:**

- BOOTSTRAP → OPERATIONAL is one-way after bootstrap period
- CIRCUIT_BREAKER can only be entered from OPERATIONAL
- Recovery from CIRCUIT_BREAKER requires both scar decay AND low pressure

---

## 3. Behavioral Contracts

### 3.1. Momentum Calculation

**Pre-conditions:**

- Both `pressure` and `previousPressure` are valid PressureVectors
- `Δt > 0`

**Post-conditions:**

- Returns scalar ≥ 0
- Returns 0 when `pressure == previousPressure`
- Scales inversely with `Δt`

**Contract:**

$$
M = \frac{\|\vec{P}(t) - \vec{P}(t-1)\|}{\Delta t}
$$

### 3.2. Scar Update

**Pre-conditions:**

- `currentScar ≥ 0`
- Configuration parameters: `λ > 0`, `σ ≥ 0`, `P_crit ∈ (0, 1)`

**Post-conditions:**

- Returns scalar ≥ 0
- If no trauma: `newScar < currentScar` (decay guaranteed)
- If trauma: `newScar ≥ currentScar` (may increase or stay same with decay)

**Contract:**

$$
S(t) = S(t-1) \cdot e^{-\lambda \Delta t} + \sigma \cdot \mathbb{I}(\|\vec{P}\| > P_{crit})
$$

**Invariant:** Scar tissue MUST decay over time when no new trauma occurs.

### 3.3. Resistance Calculation

**Pre-conditions:**

- Valid RoutePhysics state
- Valid SensitivityWeights
- `now ≥ lastUpdatedAt`

**Post-conditions:**

- Returns scalar ≥ `R_base`
- Increases monotonically with: pressure, momentum, scar, staleness
- Never returns negative or NaN

**Contract:**

$$
R = R_{base} + (\vec{P}^T \mathbf{W}) + \mu\|\vec{M}\| + S + U
$$

### 3.4. Flow Decision

**Pre-conditions:**

- Request has valid `voltage ≥ 0`
- Route has computed `resistance ≥ 0`

**Post-conditions:**

- Returns exactly one of: PASS, REJECT, REDIRECT
- PASS iff `voltage > resistance` AND `mode ≠ CIRCUIT_BREAKER`
- REJECT if `mode = CIRCUIT_BREAKER` regardless of voltage

**Contract:**

$$
\text{Flow} = \begin{cases}
\text{PASS} & V > R \land mode \neq CB \\
\text{REJECT} & otherwise
\end{cases}
$$

### 3.5. Effective Zero Consistency

**Problem:** Floating point arithmetic near EPSILON creates discrepancies between `dot(v,v)` and `magnitude(v)²`.

**Rule:** If a value is clamped to zero in one context (magnitude), it MUST be clamped to zero in all related contexts (dot product).

**Rationale:** A system vector cannot be "zero magnitude" but "non-zero energy". We accept the loss of precision (`< 1e-9`) to maintain algebraic invariants and prevent noise-induced instability.

**Invariant:**

$$
\forall \vec{v}: |\text{dot}(\vec{v}, \vec{v}) - \|\vec{v}\|^2| < \epsilon
$$

**Implementation:** Both `VectorMath.magnitude()` and `VectorMath.dot()` apply `clampToZero()` to their results.

### 3.6. Signal Classification

The physics engine distinguishes between noise and signal using defined thresholds:

| Magnitude Range     | Classification   | Motor Response        |
| ------------------- | ---------------- | --------------------- |
| \|v\| < 1e-9        | **NOISE**        | Treat as 0, no action |
| 1e-9 ≤ \|v\| < 1e-4 | **MICRO-TREMOR** | Calculate, dampen     |
| 1e-4 ≤ \|v\| < 1.0  | **SIGNAL**       | Full response         |
| \|v\| ≥ 1.0         | **SATURATION**   | Clamp to bounds       |

**Constants (defined in `src/core/constants.ts`):**

- `PHYSICS_EPSILON = 1e-9` — Noise floor
- `MIN_SIGNIFICANT_CHANGE = 1e-4` — Deadband threshold
- `MAX_SAFE_RESISTANCE = 1e6` — Infinity prevention

---

## 4. Configuration Semantics

### 4.1. Parameter Meanings

| Parameter        | Symbol     | Domain         | Semantic                | Effect of Increase           |
| ---------------- | ---------- | -------------- | ----------------------- | ---------------------------- |
| baseResistance   | $R_{base}$ | $[0, \infty)$  | Static topological cost | Higher minimum resistance    |
| decayRate        | $\lambda$  | $(0, 1)$       | Forgiveness speed       | Faster scar healing          |
| scarFactor       | $\sigma$   | $[0, \infty)$  | Trauma weight           | More scar per critical event |
| dampingFactor    | $\mu$      | $[0, \infty)$  | Momentum penalty        | Stronger "braking"           |
| criticalPressure | $P_{crit}$ | $(0, 1)$       | Scarring threshold      | Fewer trauma events          |
| breakMultiplier  | $\gamma$   | $[1, \infty)$  | Safety valve trigger    | Later circuit break          |
| bootstrapTicks   | $N$        | $\mathbb{Z}^+$ | Warm-up period          | Longer observation           |
| tanhScale        | $k$        | $(0, \infty)$  | Normalization steepness | Sharper transitions          |
| stalenessFactor  | $\kappa$   | $[0, \infty)$  | Uncertainty penalty     | Harsher staleness            |
| deltaT           | $\Delta t$ | $(0, \infty)$  | Tick interval           | Nyquist constraint           |

### 4.2. Parameter Constraints

**Hard Constraints (MUST):**

- $\lambda > 0$ (decay must exist)
- $\Delta t > 0$ (time must advance)
- $R_{base} \geq 0$ (resistance is non-negative)
- $\gamma \geq 1$ (break point at least as high as base)

**Soft Constraints (SHOULD):**

- $\Delta t \leq \frac{RTT_{avg}}{2}$ (Nyquist criterion)
- $\lambda \cdot \sigma < 1$ (decay should dominate typical scarring)

### 4.3. Configuration Anti-Patterns

| Anti-Pattern         | Problem                 | Symptom                             |
| -------------------- | ----------------------- | ----------------------------------- |
| $\lambda = 0$        | No decay                | Permanent scars → deadlock          |
| $\mu = 0$            | No damping              | No proactive braking → wall-hitting |
| $\sigma \gg \lambda$ | Trauma overwhelms decay | Rapid deadlock                      |
| $\gamma = 1$         | Circuit breaker at base | Constant tripping                   |
| $N_{bootstrap} = 0$  | No warm-up              | Momentum spike on first tick        |

---

## 5. Architectural Invariants

### 5.1. Separation of Concerns

| Concern        | Responsibility             | NOT Responsible For            |
| -------------- | -------------------------- | ------------------------------ |
| Physics Engine | State → State transitions  | I/O, timing, routing decisions |
| Telemetry      | Raw metrics collection     | Normalization, physics         |
| Gateway        | Voltage assignment, quotas | Physics calculations           |
| Route Registry | Route lifecycle            | Physics calculations           |

**Invariant:** Physics engine receives already-normalized pressure vectors. It does NOT perform normalization itself.

### 5.2. Time Handling

**Invariant:** The physics engine is time-agnostic. It receives:

- Pre-computed `Δt` (not current time)
- Pre-computed `staleness` value (not timestamps to subtract)

This allows deterministic replay and testing without mocking time.

### 5.3. Immutability

**Invariant:** Every physics function returns a NEW state object. The input state MUST remain unchanged.

```
state_old → physics_function → state_new
                ↓
          state_old is UNCHANGED
```

---

## 6. Testing Heuristics

### 6.1. Property-Based Tests

| Property          | Assertion                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| Identempotence    | `physics(physics(s, p), p) ≠ physics(s, p)` (NOT idempotent - momentum changes) |
| Decay convergence | Repeated ticks with zero pressure → scar → 0                                    |
| Momentum symmetry | `M(a→b) = M(b→a)` (magnitude equal)                                             |
| Resistance floor  | `∀state: R(state) ≥ R_base`                                                     |

### 6.2. Hypothesis Validation Tests

| Hypothesis                     | Test Strategy                                           |
| ------------------------------ | ------------------------------------------------------- |
| H1: Momentum prevents flapping | Compare oscillation count: CDO vs binary CB             |
| H2: Decay prevents deadlock    | Long-run simulation, verify `∃t: R(t) < ∞` after crisis |
| H3: Scar routes traffic        | Multi-route sim, verify unhealthy route probability → 0 |

### 6.3. Boundary Tests

| Boundary           | Expected Behavior                                       |
| ------------------ | ------------------------------------------------------- |
| All zeros          | Minimum resistance = R_base                             |
| All ones           | High resistance, potential circuit break                |
| Negative pressure  | Valid (below baseline), reduces resistance contribution |
| Infinite staleness | R → ∞ (route effectively closed)                        |

---

## 7. Implementation Checklist

Before implementation is complete, verify:

- [ ] All functions are pure (no side effects)
- [ ] All state updates return new objects
- [ ] Momentum correctly computed from delta
- [ ] Scar decays when no trauma
- [ ] Staleness increases with time gap
- [ ] Circuit breaker triggers at threshold
- [ ] Bootstrap phase skips momentum
- [ ] tanh normalization preserves gradient
- [ ] All invariants hold under property tests

---

## 8. Glossary Cross-Reference

See [GLOSSARY.md](./GLOSSARY.md) for terminology definitions.

---

## 9. Changelog

| Version | Date       | Changes                                   |
| ------- | ---------- | ----------------------------------------- |
| 0.1.0   | 2026-01-09 | Initial draft with code examples          |
| 0.2.0   | 2026-01-09 | Refactored to mental models, removed code |
