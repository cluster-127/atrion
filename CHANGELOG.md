# Changelog

All notable changes to Atrion MVS will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Phase 1.5 Hotfix: Peer Feedback Integration

#### Added

- `src/core/constants.ts` - Signal vs Noise boundaries
  - `PHYSICS_EPSILON = 1e-9` — Noise floor
  - `MIN_SIGNIFICANT_CHANGE = 1e-4` — Deadband threshold
  - `MAX_SAFE_RESISTANCE = 1e6` — Infinity prevention

#### Changed

- `src/core/vector.ts` - Guarded operations per AARS 3.1/3.3

  - `magnitude()` uses `clampToZero()` for denormalized protection
  - `divide()` uses `safeDivide()` for NaN/Infinity prevention
  - `dot()` uses `clampToZero()` for Effective Zero Consistency

- `src/core/guards.ts` - Now imports from constants.ts

- `documentation/rfc/RFC-0004-implementation-guidelines.md`

  - Added §3.5 Effective Zero Consistency
  - Added §3.6 Signal Classification table

- `tests/unit/vector.test.ts` - EPSILON tolerance for invariants

### Phase 2: Simulation (Planned)

- Scenario generators (spike, sustained, oscillating, recovery)
- Tick-based runner with VirtualClock
- Observer with asciichart visualization
- Integration tests

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
