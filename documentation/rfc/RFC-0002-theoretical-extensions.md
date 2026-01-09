# RFC-0002: Theoretical Extensions

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| **RFC**        | 0002                                           |
| **Title**      | Theoretical Extensions and Boundary Conditions |
| **Status**     | Draft                                          |
| **Created**    | 2026-01-09                                     |
| **Supersedes** | None                                           |
| **Depends On** | RFC-0001                                       |

---

## Abstract

This RFC extends the core CDO mathematical model with solutions to identified theoretical limitations. It addresses parameter derivation, edge cases, and architectural safeguards required for practical implementation.

---

## 1. Parameter Derivation Framework

### 1.1. SLO-Driven Weight Matrix

**Problem:** The sensitivity matrix $\mathbf{W}$ cannot be arbitrary.

**Solution:** Weights are compiled from Service Level Objectives (SLO).

#### 1.1.1. SLO Configuration Schema

```typescript
interface SLOConfig {
  serviceId: string

  // Criticality scores [0, 10]
  latencyCriticality: number // Real-time requirements
  errorCriticality: number // Consistency requirements
  saturationCriticality: number // Throughput requirements

  // Baselines for normalization
  baselineLatencyMs: number
  maxAcceptableLatencyMs: number
  targetErrorRate: number // e.g., 0.001 = 0.1%
}
```

#### 1.1.2. Weight Derivation Formula

$$
w_j = \log(1 + c_j)
$$

Where $c_j \in [0, 10]$ is the criticality score for dimension $j$.

| Service Type     | $c_{\text{lat}}$ | $c_{\text{err}}$ | $c_{\text{sat}}$ | Profile                   |
| ---------------- | ---------------- | ---------------- | ---------------- | ------------------------- |
| Payment Gateway  | 8                | 9                | 3                | Latency + Error sensitive |
| Ledger/Audit     | 2                | 10               | 2                | Error sensitive only      |
| CDN/Streaming    | 10               | 3                | 8                | Latency + Throughput      |
| Batch Processing | 1                | 5                | 2                | Low priority              |

#### 1.1.3. Rationale for Logarithmic Scale

- **Diminishing returns:** Doubling criticality shouldn't double weight
- **Prevents dominance:** Single high criticality doesn't overwhelm others
- **Intuitive calibration:** Scores map to business understanding

---

### 1.2. External Voltage Injection

**Problem:** Priority ($V$) assignment creates inflation risk if internal.

**Solution:** Voltage is injected by the Business Layer, not computed by physics.

#### 1.2.1. Injection Mechanism

```
┌─────────────────┐
│   API Gateway   │
│  (Business)     │
├─────────────────┤
│ X-Atrion-Voltage│ ──→ Injected Header
│ X-Atrion-Tier   │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Atrion Engine  │
│  (Physics)      │
├─────────────────┤
│ V(req) = header │ ──→ No internal decision
│ R(t) = computed │
└─────────────────┘
```

#### 1.2.2. Voltage Tiers

| Header Value | Tier | Semantic          | Typical $V$ |
| ------------ | ---- | ----------------- | ----------- |
| `critical`   | 0    | Must succeed      | $100$       |
| `high`       | 1    | Priority traffic  | $50$        |
| `normal`     | 2    | Standard requests | $20$        |
| `low`        | 3    | Background        | $5$         |
| `bulk`       | 4    | Deferrable        | $1$         |

#### 1.2.3. Inflation Prevention

Inflation control is **Gateway responsibility**, not Atrion's:

- Quota enforcement per tier
- Rate limiting per API key
- Cost models (higher tier = higher cost)

**Principle:** Atrion is a traffic police, not a legislator.

---

## 2. Normalization Strategy

### 2.1. Soft Normalization (The Hyperbolic Tangent Choice)

**Problem:** Hard clamping at $[0, 1]$ loses gradient information.

**Solution:** Use hyperbolic tangent (tanh) for soft normalization, preserving gradient while bounding output.

#### 2.1.1. Primary Form (tanh)

$$
p_{\text{norm}} = \tanh\left( \frac{\text{raw\_value}}{\text{scale\_factor}} \right)
$$

**Output Range:** $[-1, 1]$ — provides more granular control than $[0, 1]$.

**Key Benefit:** Even when the system is overloaded ($>100\%$ capacity), the derivative $\frac{dp}{dt}$ remains non-zero, allowing the Momentum mechanic to continue functioning and differentiating between "bad" and "worse".

#### 2.1.2. Alternative: Logistic Sigmoid

For $[0, 1]$ bounded output:

$$
p = \sigma(x) = \frac{1}{1 + e^{-k(x - x_0)}}
$$

Where:

- $x$ = raw metric value
- $x_0$ = baseline (sigmoid midpoint)
- $k$ = steepness parameter

#### 2.1.3. Per-Component Configuration

| Component        | Raw Input                                | Scale Factor | Output Range |
| ---------------- | ---------------------------------------- | ------------ | ------------ |
| $p_{\text{lat}}$ | $\frac{\text{latency}}{\text{baseline}}$ | $1.0$        | $[-1, 1]$    |
| $p_{\text{err}}$ | $\text{error\_rate}$                     | $0.01$       | $[-1, 1]$    |
| $p_{\text{sat}}$ | $\frac{\text{queue}}{\text{max}}$        | $0.5$        | $[-1, 1]$    |

#### 2.1.4. Gradient Preservation Property

Key advantage over clamping:

```
Clamp:  latency = 2s  → p = 1.0
        latency = 10s → p = 1.0  (SAME! Momentum = 0)

tanh:   latency = 2s  → p = 0.76
        latency = 10s → p = 0.99 (Different! Momentum > 0)
```

**Critical Insight:** The system can still differentiate between "overloaded" and "catastrophically overloaded" — information that hard clamping destroys.

---

## 3. Temporal Dynamics

### 3.1. Multi-Rate Sampling

**Problem:** Different pressure components operate at different time scales.

| Component  | Time Scale    | Update Frequency |
| ---------- | ------------- | ---------------- |
| Latency    | Milliseconds  | Every tick       |
| Error Rate | Seconds       | Every tick       |
| Saturation | Minutes-Hours | Every $N$ ticks  |

**Solution:** Per-component sampling intervals.

#### 3.1.1. Component-Specific $\Delta t$

$$
\Delta t_j = \max(\Delta t_{\text{min}}, \frac{\text{RTT}_{\text{avg},j}}{2})
$$

Following Nyquist criterion: sample at least 2x faster than the signal frequency.

#### 3.1.2. Momentum with Variable $\Delta t$

$$
M_j(t) = \frac{p_j(t) - p_j(t - \Delta t_j)}{\Delta t_j}
$$

**Total Momentum:**

$$
\|\vec{M}(t)\| = \sqrt{\sum_j M_j(t)^2}
$$

#### 3.1.3. Synchronization Strategy

To prevent stale component bias:

1. Fast components: Use instantaneous value
2. Slow components: Use Exponentially Weighted Moving Average (EWMA)

$$
p_{\text{sat}}(t) = \alpha \cdot p_{\text{sat}}^{\text{raw}}(t) + (1 - \alpha) \cdot p_{\text{sat}}(t-1)
$$

Where $\alpha \in (0, 1)$ is the smoothing factor.

#### 3.1.4. Bias Voltage Model

**Conceptual Framework:** Slow metrics (e.g., Saturation) act as a **"bias voltage"** that changes gradually, while fast metrics (e.g., Latency) provide instantaneous resistance changes.

- Fast metrics: Update resistance immediately on each tick
- Slow metrics: Provide a baseline offset that shifts over minutes/hours

**Benefit:** High-frequency noise from fast metrics does not distort long-term resource planning. The bias voltage creates a stable foundation upon which instantaneous fluctuations operate.

---

### 3.2. Telemetry Delay Compensation

**Problem:** Real systems have observation delay $\Delta\tau$.

**Solution:** Linear extrapolation using momentum.

#### 3.2.1. Predictive Pressure Estimate

$$
\hat{P}(t) = P(t - \Delta\tau) + \Delta\tau \cdot M(t - \Delta\tau)
$$

#### 3.2.2. Delay-Aware Resistance

Replace $\vec{P}(t)$ with $\hat{P}(t)$ in the impedance equation:

$$
R_i(t) = R_{\text{base}} + (\hat{P}_i(t)^T \mathbf{W}_i) + \mu \|\vec{M}_i(t)\| + S_i(t)
$$

#### 3.2.3. Overshoot Risk Mitigation

Linear extrapolation may overshoot if momentum changes direction. Mitigation:

$$
\hat{P}(t) = \min\left( P(t - \Delta\tau) + \Delta\tau \cdot M, \; P_{\text{max}} \right)
$$

Capped extrapolation prevents runaway predictions.

**Constraint:** The extrapolation is bounded by the Staleness Uncertainty term (§5.1). During long telemetry outages, the Uncertainty penalty $U(t)$ dominates, effectively closing the route regardless of extrapolated pressure.

---

### 3.3. Cold Start Protocol

**Problem:** At $t = 0$, no historical data exists.

**Solution:** Bootstrap Mode with pessimistic defaults.

#### 3.3.1. Bootstrap State Machine

```
┌──────────────────┐
│   BOOTSTRAP      │
│ (Observer Mode)  │
├──────────────────┤
│ R = R_bootstrap  │   Fixed pessimistic resistance
│ M = undefined    │   No momentum calculation
│ Collect P(t)     │   Building baseline
└────────┬─────────┘
         │ After N_bootstrap ticks
         ▼
┌──────────────────┐
│   OPERATIONAL    │
│ (Full Physics)   │
├──────────────────┤
│ R = computed     │   Full impedance law
│ M = computed     │   Momentum active
│ S = 0 (fresh)    │   No scar history
└──────────────────┘
```

#### 3.3.2. Bootstrap Parameters

| Parameter              | Suggested Value                      | Rationale                |
| ---------------------- | ------------------------------------ | ------------------------ |
| $R_{\text{bootstrap}}$ | $R_{\text{cluster\_avg}} \times 1.2$ | Conservative             |
| $N_{\text{bootstrap}}$ | $10$ ticks                           | Statistical significance |

#### 3.3.3. Baseline Initialization

After bootstrap:

$$
P_{\text{base}} = \frac{1}{N_{\text{bootstrap}}} \sum_{t=1}^{N_{\text{bootstrap}}} P(t)
$$

This becomes the normalization reference for sigmoid.

---

## 4. Cascade Containment

### 4.1. Hybrid Safety Valve

**Problem:** Scar tissue is local, but cascade failure is global.

**Solution:** Hard cutoff when resistance exceeds catastrophic threshold.

#### 4.1.1. Break Point Threshold

$$
R_{\text{break}} = R_{\text{base}} \times \gamma
$$

Where $\gamma \in [5, 10]$ is the safety margin.

#### 4.1.2. Mode Transition

```
IF R(t) ≥ R_break:
    mode = CIRCUIT_BREAKER  // Hard cutoff
    route.status = OPEN     // No traffic
ELSE:
    mode = CDO_PHYSICS      // Analog resistance
    route.status = FLOW     // Impedance-controlled
```

#### 4.1.3. Recovery Protocol

```
WHILE mode = CIRCUIT_BREAKER:
    // Passive observation (no traffic)
    IF S(t) < S_recovery AND P(t) < P_safe:
        mode = CDO_PHYSICS  // Return to analog control
        R = R_bootstrap     // Conservative restart
```

#### 4.1.4. Cascade Propagation Limit

When a route enters CIRCUIT_BREAKER, neighboring routes experience:

$$
R_{\text{neighbor}}(t) = R_{\text{neighbor}}(t) + \epsilon_{\text{cascade}}
$$

Where $\epsilon_{\text{cascade}}$ is a small preventive resistance bump.

---

## 5. Uncertainty Quantification

### 5.1. Staleness Penalty

**Problem:** Silent node death looks like recovery (pressure drops to zero).

**Solution:** Add uncertainty term based on data freshness.

$$
U(t) = \kappa \cdot (t_{\text{current}} - t_{\text{last\_seen}})
$$

#### 5.1.1. Modified Impedance Law

$$
R_i(t) = R_{\text{base}} + (\hat{P}_i^T \mathbf{W}_i) + \mu \|\vec{M}_i\| + S_i(t) + U_i(t)
$$

#### 5.1.2. Timeout Behavior

| Staleness      | Effect                                    |
| -------------- | ----------------------------------------- |
| $0 \leq U < 1$ | Normal operation                          |
| $1 \leq U < 5$ | Elevated caution                          |
| $U \geq 5$     | Route effectively closed ($R \to \infty$) |

---

## 6. Open Research Questions

### 6.1. Normalization Scale Factor Optimization

The scale factor in tanh normalization affects sensitivity:

- Too low: Slow response to pressure changes
- Too high: Binary-like behavior (defeats purpose)

**Research Direction:** Adaptive $k$ based on observed variance.

### 6.2. Multi-Route Coupling

Current model treats routes as independent. Real systems have:

- Shared downstream dependencies
- Load redistribution effects
- Correlated failures

**Research Direction:** Coupling matrix $C_{ij}$ modeling inter-route effects.

### 6.3. Chaos Boundary Mapping

Numerical validation should map parameter regions where $\Delta L(t) > 0$.

**Research Direction:** Bifurcation diagrams for $(\lambda, \mu, \sigma)$ space.

---

## 7. Summary of Extensions

| Extension                    | Problem Solved          | Section |
| ---------------------------- | ----------------------- | ------- |
| SLO-Driven Weights           | Arbitrary $\mathbf{W}$  | §1.1    |
| External Voltage             | Priority inflation      | §1.2    |
| tanh Normalization           | Gradient loss at bounds | §2.1    |
| Multi-Rate Sampling          | Time scale mismatch     | §3.1    |
| Telemetry Delay Compensation | Observation lag         | §3.2    |
| Cold Start Protocol          | Bootstrap anomalies     | §3.3    |
| Hybrid Safety Valve          | Cascade failure         | §4.1    |
| Staleness Penalty            | Silent death            | §5.1    |

---

## 8. References

1. Control Theory literature (see RFC-0001)
2. SLO/SLI frameworks: Google SRE Book, Chapter 4
3. Sigmoid/Logistic function: Bishop, _Pattern Recognition and Machine Learning_, 2006
4. EWMA: Roberts, S.W. (1959). Control Chart Tests Based on Geometric Moving Averages

---

## 9. Changelog

| Version | Date       | Changes       |
| ------- | ---------- | ------------- |
| 0.1.0   | 2026-01-09 | Initial draft |
