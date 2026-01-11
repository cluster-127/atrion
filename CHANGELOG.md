# Changelog

All notable changes to Atrion MVS will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.1] - 2026-01-11

### Added: AutoTuner Physics Integration

- **physics.ts**: Optional `autoTuner` parameter for adaptive thresholds
- **Break threshold**: Uses `autoTuner.computeBreakPoint()` when available
- **Recovery threshold**: Uses `autoTuner.computeRecoveryPoint()` when available
- **Observation**: Feeds resistance to tuner for μ+kσ learning

### Changed: Lab Scenario Tuning

- **Microservices**: Aggressive config (scarFactor=50, breakMultiplier=5) → 14/15 fast-fail
- **IoT**: High-stress config (baseLatency=50, queuePenalty=10x) → 90% sampling, 0 errors

---

## [1.2.0] - 2026-01-11

### Added: Neuroplasticity & Wind Tunnel Expansion

- **Circuit Breaker Recovery Fix** (`src/core/physics.ts`)

  - Resistance-based CB exit: R < 50Ω triggers recovery
  - Fixes hysteresis trap where CB never exited

- **AutoTuner Module** (`src/core/auto-tuner.ts`)

  - EMA-based adaptive thresholds (RFC-0007)
  - Dynamic break point: μ + kσ
  - Hybrid limits: minFloor, hardCeiling

- **RFC-0007: Adaptive Thresholds** (Neuroplasticity)

  - Mathematical formulation for dynamic thresholds
  - Z-Score interpretation (k=1,2,3)
  - Migration path: v1.2 opt-in → v2.0 default

- **RFC-0008: Pluggable State Architecture** (renumbered from RFC-0007)

  - StateProvider interface for cluster sync
  - Commercial tier structure

- **Wind Tunnel Scenarios** (`lab/`)
  - `game-lod-v2`: Budget miss weight amplification (122% faster LOD switch)
  - `cb-recovery`: Circuit breaker exit validation
  - `predictive-lod`: Trend-based anticipatory degradation (75% predictive)
  - `ecommerce`: Black Friday VIP priority (84% revenue efficiency)
  - `iot`: Lossy backpressure (sampling)
  - `microservices`: Domino stopper (fast-fail chain)

### Changed

- RFC priorities swapped: Adaptive Thresholds now RFC-0007, Pluggable State now RFC-0008

---

## [1.1.0] - 2026-01-11

### Added: Observability Patch (Operation First Flight)

- **PhysicsObserver Interface** - Optional callback for real-time telemetry

  - `PhysicsEvent` type with all computed values (resistance, momentum, scar, mode)
  - `ObserverDecision` type: FLOW | SHED | BOOTSTRAP
  - Mode transition detection

- **Built-in Observers** (`src/core/observers.ts`)

  - `consoleObserver` - Emoji-prefixed debug logging (✅/🚫/🔄)
  - `silentObserver` - No-op for benchmarking overhead
  - `createCompositeObserver()` - Fan-out to multiple observers
  - `createFilteredObserver()` - Conditional event filtering
  - `createCollectorObserver()` - Event array collection

- **Unit Tests** (`tests/unit/observer.test.ts`) - 10 new tests
  - Observer integration with updatePhysics
  - Mode transition detection
  - Built-in observer functionality

### Changed

- `updatePhysics()` now accepts optional `observer?: PhysicsObserver` parameter
- No breaking changes - fully backwards compatible

---

## [Unreleased]

### Phase 4: Stability Mapping

#### Added

- `src/analysis/mapper.ts` - Parameter grid search tool
  - 10x10 grid: decayRate (0.1-5.0) x scarFactor (1-20)
  - ASCII heatmap visualization with ANSI colors
  - Variance-based stability scoring
- `npm run stability-map` script

#### Results

- **90.2% average stability** across 100 configurations
- **Optimal config:** decayRate=5.0, scarFactor=1.0
- **Chaotic zone:** Low decay + medium scar (left edge)

---

### v2.0.0 Roadmap (RFC-0007)

#### Added

- `documentation/rfc/RFC-0007-pluggable-state-architecture.md`
  - StateProvider interface (Hexagonal Architecture)
  - InMemoryProvider (default, free)
  - Cluster sync model (Redis Pub/Sub, eventual consistency)
  - Gamma blending (γ=0.3) for conflict resolution
  - Commercial tier structure (Community/Pro/Team/Enterprise)

---

### Phase 3: Hypothesis Validation

#### Added

- `tests/hypotheses/h1-momentum.test.ts` - Flapping elimination (4 tests)
  - Atrion: 1 transition vs Standard CB: 49 transitions (95% reduction)
- `tests/hypotheses/h2-entropy.test.ts` - Deadlock prevention (2 tests)
  - Half-Life: 4 ticks (theoretical: 3.47)
- `tests/hypotheses/h3-autorouting.test.ts` - Auto-routing (2 tests)
  - Traffic shift: 69.1% to secondary during failure

#### Changed (Physics v2.0)

- `src/core/physics.ts` - SI Unit System
  - `deltaT` now converted to seconds internally
  - `decayRate: 2.0` means "200% decay per second" (human-readable)
- `src/core/physics.ts` - Check Valve Pattern
  - Only POSITIVE pressure (stress > baseline) causes trauma
  - Silence no longer triggers scar tissue accumulation

### Phase 2.5: Integration Tests

#### Added

- `tests/integration/spike.test.ts` - Hysteresis & peak analysis (5 tests)
- `tests/integration/decay.test.ts` - Scar tissue recovery (4 tests)
- `tests/integration/circuit-breaker.test.ts` - State transitions (7 tests)

### Phase 2: Simulation

#### Added

- `src/simulation/scenarios.ts` - PressureGenerator factory
  - silence, spike, sustained, oscillating, ramp, recovery, compose
- `src/simulation/observer.ts` - Telemetry capture & analysis
- `src/simulation/runner.ts` - VirtualClock tick loop
- `src/simulation/index.ts` - Entry point with visualization
- `src/simulation/asciichart.d.ts` - Type declarations

### Phase 1.5 Hotfix: Peer Feedback Integration

---

## [0.1.0] - 2026-01-09

### Phase 1.5: Hardening

#### Added

- `src/core/logger.ts` - Injectable logger interface

  - `Logger` interface with debug/info/warn/error
  - `silentLogger` - no output (default)
  - `consoleLogger` - standard output
  - `createLogger()` - configurable level filtering
  - `getLogger()`/`setLogger()`/`resetLogger()` - global instance

- `tests/unit/flow.test.ts` - 11 tests

  - decideFlow: PASS/REJECT/CIRCUIT_OPEN
  - selectRoute: softmax, filtering, edge cases

- `tests/unit/guards.test.ts` - 36 tests
  - isSafeNumber, toSafeNumber
  - Edge Case #1: safeDivide
  - Edge Case #2: safeExp
  - Edge Case #3: clampToZero
  - Edge Case #4: normalizeZero
  - Edge Case #5: safeDeltaT
  - PhysicsGuard composites

#### Changed

- `src/core/guards.ts` - `console.warn` → `getLogger().warn`
- `src/core/index.ts` - Logger exports added

---

### Phase 1: Core Physics Engine

#### Added

- `package.json` - Project config, dependencies
- `tsconfig.json` - TypeScript strict mode
- `vitest.config.ts` - Test configuration

- `src/core/types.ts` - Domain types

  - Branded primitives: Timestamp, DeltaTime, Volts, Ohms, NormalizedPressure, Momentum, Scar
  - PressureVector, SensitivityWeights
  - State machine: BootstrapState, OperationalState, CircuitBreakerState
  - PhysicsConfig, SLOConfig
  - FlowDecision

- `src/core/vector.ts` - VectorMath utilities

  - magnitude, add, subtract, scale, divide
  - dot, scaleComponents (Hadamard), sum, clamp, zero

- `src/core/clock.ts` - Time abstraction

  - Clock interface
  - VirtualClock (deterministic)
  - RealClock (production)

- `src/core/normalize.ts` - Normalization

  - normalize() - tanh with guards
  - normalizeTelemetry() - PressureVector from raw metrics
  - isValidPressure(), isValidPressureVector()

- `src/core/config.ts` - Configuration

  - DEFAULT_CONFIG, DEFAULT_SLO
  - deriveWeights() - SLO → sensitivity weights
  - deriveBaselines()
  - floatEquals(), EPSILON

- `src/core/guards.ts` - 5 Edge Case Guards

  - isSafeNumber, toSafeNumber
  - safeClamp, safeDivide, safeExp, safeTanh
  - clampToZero, normalizeZero
  - sanitizePressure, sanitizePositive
  - PhysicsGuard composite

- `src/core/physics.ts` - Core physics

  - calculateMomentum()
  - updateScar()
  - calculateStaleness()
  - calculateResistance()
  - createBootstrapState()
  - updatePhysics()

- `src/core/flow.ts` - Flow decision

  - decideFlow() - V > R gate
  - selectRoute() - softmax selection
  - createRequest()

- `src/core/index.ts` - Public API

- `tests/unit/vector.test.ts` - 12 tests
- `tests/unit/normalize.test.ts` - 9 tests
- `tests/unit/physics.test.ts` - 12 tests

---

## Principles Established

1. **Type Safety:** Branded types, discriminated unions, readonly
2. **Defensive Programming:** 5 edge case guards
3. **Functional Core:** Pure functions, no side effects
4. **Testability:** VirtualClock, injectable Logger, fast-check
5. **RFC Compliance:** Every implementation references RFC
