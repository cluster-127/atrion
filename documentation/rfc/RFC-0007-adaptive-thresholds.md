# RFC-0007: Adaptive Thresholds (Neuroplasticity)

| Field       | Value                 |
| ----------- | --------------------- |
| **Status**  | Draft                 |
| **Created** | 2026-01-11            |
| **Authors** | Antigravity Agent     |
| **Depends** | RFC-0001 (Core Model) |

---

## Abstract

Current Atrion thresholds (breakMultiplier, criticalPressure, scarFactor) are **static constants**. This RFC proposes an **Adaptive Control Layer** that computes dynamic thresholds based on rolling statistical analysis (μ ± kσ), enabling:

1. Self-tuning to traffic patterns (diurnal cycles, seasonal load)
2. Zero-config operation (no manual threshold tuning)
3. Anomaly-sensitive defense (tighter bounds during calm periods)

---

## 1. Motivation

### 1.1 The Diurnal Problem

| Time     | Baseline Traffic | Static Break (100Ω) | Result          |
| -------- | ---------------- | ------------------- | --------------- |
| 04:00 AM | 10 req/s         | Too high            | Slow detection  |
| 20:00 PM | 10,000 req/s     | Too low             | False positives |

Static thresholds cannot adapt to natural load variation.

### 1.2 The Boiling Frog

Slow-ramp attacks (Slowloris) gradually shift `μ` upward → system normalizes attack as baseline.

**Solution**: Hybrid limits (soft dynamic + hard static ceiling).

---

## 2. Mathematical Formulation

### 2.1 Core Equations

**Dynamic Break Threshold:**

```
B_dynamic = μ(R) + k × σ(R)
```

Where:

- `μ(R)` = Rolling mean of resistance
- `σ(R)` = Rolling standard deviation
- `k` = Sensitivity multiplier (default: 3.0)

**Effective Break Threshold (with safety clamps):**

```
B_effective = clamp(B_dynamic, B_floor, B_ceiling)
```

**Recovery Threshold (Current - Multiplier-based):**

```
R_recovery = B_effective × γ
```

Where `γ = 0.5` (recovery multiplier).

**Recovery Threshold (Future - Statistical):**

> **Note**: A more statistically grounded approach defines recovery relative to mean:

```
R_recovery = μ(R) + k_recovery × σ(R)
```

Where `k_recovery = 1` (1-sigma, 68% coverage) provides recovery when resistance returns to "normal + 1σ" range.

**Comparison:**

| Approach         | Formula             | Pros                | Cons                 |
| ---------------- | ------------------- | ------------------- | -------------------- |
| Multiplier (v1)  | `B_effective × 0.5` | Simple, predictable | Not adaptive         |
| Statistical (v2) | `μ + 1σ`            | Adapts to baseline  | Cold-start sensitive |

**Recommendation**: Start with multiplier (v1.2), migrate to statistical (v2.0) after warmup maturity.

### 2.2 EMA Update Equations

**Smoothing Factor:**

```
α = 2 / (N + 1)
```

Where `N` = window size.

**Mean Update (Exponential Moving Average):**

```
μ_t = α × x_t + (1 - α) × μ_{t-1}
```

**Variance Update (Exponential Moving Variance):**

```
σ²_t = (1 - α) × (σ²_{t-1} + α × (x_t - μ_t)²)
```

**Standard Deviation:**

```
σ_t = √(σ²_t)
```

### 2.3 Z-Score Interpretation

The `k` parameter represents standard deviations from mean:

| k   | Coverage | Interpretation                   |
| --- | -------- | -------------------------------- |
| 1   | 68.27%   | Sensitive (many false positives) |
| 2   | 95.45%   | Balanced                         |
| 3   | 99.73%   | Conservative (default)           |

**Break Condition:**

```
R_current > μ + k × σ  →  CIRCUIT_BREAKER
```

**Recovery Condition:**

```
R_current < (μ + k × σ) × γ  →  OPERATIONAL
```

---

## 3. Design

### 3.1 Core Concept: Z-Score Boundaries

Replace static break threshold with:

```
dynamicBreak = μ(R) + k × σ(R)
```

Where:

- `μ(R)` = Rolling mean of resistance over window
- `σ(R)` = Rolling standard deviation
- `k` = Sensitivity multiplier (default: 3.0, i.e., 3-sigma)

### 3.2 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AtrionGuard                      │
│  ┌───────────────┐    ┌───────────────────────────┐ │
│  │ Physics Engine│◄───│      AutoTuner            │ │
│  │ (RFC-0001)    │    │  ┌─────────────────────┐  │ │
│  │               │    │  │ RollingWindow (N)   │  │ │
│  │ resistance────┼────┼─►│ compute μ, σ        │  │ │
│  │               │    │  │ dynamicBreak = μ+kσ │  │ │
│  │ breakPoint◄───┼────┼──│ clamp(minFloor,     │  │ │
│  │               │    │  │       hardCeiling)  │  │ │
│  └───────────────┘    │  └─────────────────────┘  │ │
│                       └───────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 3.3 AutoTuner Interface

```typescript
interface AutoTunerConfig {
  windowSize: number // Rolling window size (default: 100)
  sensitivity: number // k-sigma multiplier (default: 3.0)
  minFloor: number // Minimum threshold (safety net)
  hardCeiling: number // Maximum threshold (anti-boiling-frog)
  warmupTicks: number // Ticks before adaptive kicks in
}

interface AutoTuner {
  observe(resistance: Ohms): void
  getStats(): { mean: number; stdDev: number }
  computeBreakPoint(): Ohms
}
```

### 3.4 Hybrid Limit Strategy

```
effectiveBreak = clamp(
  dynamicBreak,      // μ + kσ
  config.minFloor,   // Never below (e.g., 30Ω)
  config.hardCeiling // Never above (e.g., 500Ω)
)
```

| Limit         | Purpose                                   |
| ------------- | ----------------------------------------- |
| `minFloor`    | Prevents over-sensitivity during low load |
| `hardCeiling` | Prevents boiling-frog normalization       |

---

## 4. Algorithm

### 4.1 Exponential Moving Average (EMA) — Default

EMA provides decay-weighted recent bias, ideal for dynamic traffic patterns:

```typescript
class EMAAccumulator {
  private mean = 0
  private variance = 0
  private initialized = false
  private readonly alpha: number

  constructor(windowSize: number = 100) {
    // α = 2 / (N + 1) — standard EMA smoothing factor
    this.alpha = 2 / (windowSize + 1)
  }

  update(x: number): void {
    if (!this.initialized) {
      this.mean = x
      this.variance = 0
      this.initialized = true
      return
    }

    const delta = x - this.mean
    this.mean += this.alpha * delta

    // Exponential variance (for stdDev)
    this.variance = (1 - this.alpha) * (this.variance + this.alpha * delta * delta)
  }

  get stdDev(): number {
    return Math.sqrt(this.variance)
  }
}
```

**Why EMA over Welford?**

- Traffic patterns are dynamic (diurnal cycles)
- Recent data should weigh more than stale data
- Faster adaptation to load changes

### 4.2 Welford's Online Algorithm — Alternative

For cases requiring equal weighting of all history (stable baseline):

```typescript
class WelfordAccumulator {
  private count = 0
  private mean = 0
  private m2 = 0

  update(x: number): void {
    this.count++
    const delta = x - this.mean
    this.mean += delta / this.count
    const delta2 = x - this.mean
    this.m2 += delta * delta2
  }

  get variance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0
  }

  get stdDev(): number {
    return Math.sqrt(this.variance)
  }
}
```

---

## 5. Integration Points

### 5.1 PhysicsConfig Extension

```typescript
interface PhysicsConfig {
  // ... existing fields ...

  // NEW: Adaptive control (optional)
  adaptive?: {
    enabled: boolean
    windowSize: number
    sensitivity: number
    minFloor: Ohms
    hardCeiling: Ohms
    warmupTicks: number
  }
}
```

### 5.2 updatePhysics Modification

```diff
 const breakPoint = config.adaptive?.enabled
+  ? autoTuner.computeBreakPoint()
   : asOhms(config.baseResistance * config.breakMultiplier);
```

### 5.3 Recovery Threshold

Same logic applies to CB recovery:

```typescript
const recoveryPoint = config.adaptive?.enabled
  ? autoTuner.computeRecoveryPoint() // μ - kσ, floored
  : breakPoint * 0.5
```

---

## 6. Trade-offs

### 6.1 Alternatives Considered

| Approach             | Pros                  | Cons                         |
| -------------------- | --------------------- | ---------------------------- |
| Static thresholds    | Simple, predictable   | No adaptation                |
| Time-based profiles  | Handles diurnal       | Manual config per deployment |
| ML-based prediction  | Most adaptive         | Complexity, latency          |
| **Z-Score (chosen)** | Balance of simplicity | Cold-start problem           |

### 6.2 Rejected: Pure Dynamic (No Hard Ceiling)

Without `hardCeiling`, slow attacks normalize indefinitely. Hard ceiling provides absolute defense.

---

## 7. Failure Modes

| Failure                  | Mitigation                           |
| ------------------------ | ------------------------------------ |
| Cold start (no data)     | Use static defaults until warmup     |
| Sudden traffic drop      | EMA smooths transition               |
| Boiling frog (slow ramp) | `hardCeiling` prevents normalization |
| Oscillation (flapping)   | Hysteresis band (break ≠ recover)    |

---

## 8. Observability

New telemetry fields for `PhysicsEvent`:

```typescript
interface PhysicsEvent {
  // ... existing ...
  adaptive?: {
    mean: number
    stdDev: number
    dynamicBreak: Ohms
    effectiveBreak: Ohms
  }
}
```

---

## 9. Migration Path

### Phase 1: Opt-in (v1.2)

- Add `AutoTuner` as optional module
- Default: `adaptive.enabled = false`
- Static behavior unchanged

### Phase 2: Recommended (v2.0)

- Default: `adaptive.enabled = true`
- Static mode deprecated but supported

---

## 10. Security Considerations

- `hardCeiling` MUST be set to prevent unbounded normalization
- `minFloor` prevents overly aggressive shedding
- Warmup period uses conservative static defaults

---

## 11. References

- Welford, B.P. (1962). "Note on a method for calculating corrected sums of squares and products"
- EWMA in control charts: Roberts, S.W. (1959)
- Adaptive load shedding: Netflix Blog, "Hystrix"

---

## Appendix A: Default Configuration

```typescript
const DEFAULT_ADAPTIVE_CONFIG = {
  enabled: false,
  windowSize: 100,
  sensitivity: 3.0, // 3-sigma (99.7% of normal distribution)
  minFloor: 30 as Ohms, // Never break below 30Ω
  hardCeiling: 500 as Ohms, // Never break above 500Ω (anti-boiling-frog)
  warmupTicks: 50, // Use static until 50 samples
}
```
