# CDO Glossary

> Terminology and Symbol Reference for Conditioned Deterministic Orchestration

---

## Core Concepts

| Term                | Definition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **CDO**             | Conditioned Deterministic Orchestration — framework for fault tolerance via physics-based impedance |
| **Impedance**       | Total resistance to traffic flow through a route                                                    |
| **Pressure**        | 3-dimensional stress vector (latency, error, saturation)                                            |
| **Momentum**        | Rate of change of pressure; derivative-based control                                                |
| **Scar Tissue**     | Accumulated structural resistance from past failures                                                |
| **Voltage**         | Request priority; determines ability to overcome resistance                                         |
| **Flow**            | Traffic passing through a route when V > R                                                          |
| **Decay/Entropy**   | Time-based reduction of scar tissue                                                                 |
| **Remodeling**      | System adaptation via scar accumulation on failing routes                                           |
| **tanh Norm.**      | Hyperbolic tangent for soft-bounding metrics to [-1, 1] with gradient preservation                  |
| **Bias Voltage**    | Slow-changing baseline from metrics like Saturation; stable foundation for fast fluctuations        |
| **Predictive Ext.** | Estimating current state from stale telemetry using momentum-based linear prediction                |

---

## Mathematical Symbols

| Symbol             | Name              | Domain                  | Definition                                         |
| ------------------ | ----------------- | ----------------------- | -------------------------------------------------- |
| $\vec{P}$          | Pressure Vector   | $[-1,1]^3$              | $(p_{\text{lat}}, p_{\text{err}}, p_{\text{sat}})$ |
| $\vec{M}$          | Momentum          | $\mathbb{R}^3$          | $\frac{d\vec{P}}{dt}$                              |
| $S$                | Scar Tissue       | $[0, \infty)$           | Historical resistance accumulator                  |
| $R$                | Total Resistance  | $[0, \infty)$           | Impedance to flow                                  |
| $V$                | Voltage           | $[0, \infty)$           | Request priority                                   |
| $\mathbf{W}$       | Weight Matrix     | $\mathbb{R}^{3\times3}$ | Sensitivity to pressure types                      |
| $\lambda$          | Decay Rate        | $(0, 1)$                | Scar tissue decay constant                         |
| $\mu$              | Damping Factor    | $[0, \infty)$           | Momentum penalty coefficient                       |
| $\sigma$           | Scar Factor       | $[0, \infty)$           | Trauma accumulation rate                           |
| $\Delta t$         | Delta T           | $(0, \infty)$           | Sampling interval                                  |
| $P_{\text{crit}}$  | Critical Pressure | $[0, 1]$                | Threshold for scarring                             |
| $R_{\text{base}}$  | Base Resistance   | $[0, \infty)$           | Static topological cost                            |
| $R_{\text{break}}$ | Break Point       | $[0, \infty)$           | Circuit breaker trigger threshold                  |
| $L(t)$             | Lyapunov Function | $[0, \infty)$           | System energy measure                              |
| $\kappa$           | Staleness Factor  | $[0, \infty)$           | Uncertainty penalty coefficient                    |

---

## Operational Modes

| Mode                | Description               | Behavior                                  |
| ------------------- | ------------------------- | ----------------------------------------- |
| **BOOTSTRAP**       | Initial observation phase | Fixed resistance, no momentum calculation |
| **OPERATIONAL**     | Normal physics mode       | Full impedance law active                 |
| **CIRCUIT_BREAKER** | Safety valve triggered    | Hard cutoff, no traffic                   |

---

## Failure Modes

| Mode            | Cause                        | Symptom                |
| --------------- | ---------------------------- | ---------------------- |
| **Oscillation** | Low $\mu$                    | Rapid R fluctuation    |
| **Deadlock**    | Low $\lambda$, high $\sigma$ | All routes R → ∞       |
| **Chaos**       | Bad parameter combination    | Unpredictable dynamics |

---

## Analogies

| CDO Concept | Physical Analogy     | Electrical Analogy    |
| ----------- | -------------------- | --------------------- |
| Pressure    | Pipe stress          | Current load          |
| Resistance  | Pipe constriction    | Electrical resistance |
| Momentum    | Flow velocity change | dI/dt                 |
| Scar Tissue | Pipe corrosion       | Accumulated damage    |
| Voltage     | Pump pressure        | EMF                   |
| Flow        | Fluid passage        | Current flow          |
| Decay       | Pipe self-repair     | Capacitor discharge   |

---

## Acronyms

| Acronym | Full Form                               |
| ------- | --------------------------------------- |
| CDO     | Conditioned Deterministic Orchestration |
| SLO     | Service Level Objective                 |
| SLI     | Service Level Indicator                 |
| EWMA    | Exponentially Weighted Moving Average   |
| BIBO    | Bounded-Input Bounded-Output            |
| RTT     | Round-Trip Time                         |

---

## References

| Term               | RFC Section   |
| ------------------ | ------------- |
| Pressure Vector    | RFC-0001 §2.1 |
| Momentum           | RFC-0001 §3.1 |
| Scar Dynamics      | RFC-0001 §3.2 |
| Impedance Law      | RFC-0001 §4   |
| SLO-Driven Weights | RFC-0002 §1.1 |
| tanh Normalization | RFC-0002 §2.1 |
| Bootstrap Protocol | RFC-0002 §3.3 |
| Lyapunov Analysis  | RFC-0003 §1   |
| Failure Modes      | RFC-0003 §2   |
| Type Definitions   | RFC-0004 §2   |
