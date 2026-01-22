# Atrion RFC Documentation

> Conditioned Deterministic Orchestration — Request for Comments

---

## RFC Index

| RFC                                                    | Title                        | Status      | Description                                   |
| ------------------------------------------------------ | ---------------------------- | ----------- | --------------------------------------------- |
| [RFC-0001](./RFC-0001-core-mathematical-model.md)      | Core Mathematical Model      | Implemented | State space, impedance law, flow decision     |
| [RFC-0002](./RFC-0002-theoretical-extensions.md)       | Theoretical Extensions       | Implemented | SLO-driven weights, tanh, multi-rate sampling |
| [RFC-0003](./RFC-0003-stability-analysis.md)           | Stability Analysis           | Implemented | Lyapunov, failure modes, validation framework |
| [RFC-0004](./RFC-0004-implementation-guidelines.md)    | Implementation Guidelines    | Implemented | Mental models, invariants, contracts          |
| [RFC-0005](./RFC-0005-research-roadmap.md)             | Research Roadmap             | Draft       | Open questions, bibliography                  |
| [RFC-0006](./RFC-0006-visual-metaphors.md)             | Visual Metaphors             | Implemented | Mermaid diagrams, hydraulic analogy           |
| [RFC-0007](./RFC-0007-adaptive-thresholds.md)          | Adaptive Thresholds          | Implemented | Z-Score AutoTuner, μ+kσ dynamic thresholds    |
| [RFC-0008](./RFC-0008-pluggable-state-architecture.md) | Pluggable State Architecture | Implemented | StateProvider, InMemory, Redis                |
| [RFC-0009](./RFC-0009-performance-layer.md)            | Performance Layer            | Implemented | Rust/WASM physics core, 586M ops/s            |
| [RFC-0010](./RFC-0010-workload-profiles.md)            | Workload Profiles            | Draft       | Long-running tasks, Lease API, AI Swarm       |

---

## Quick Reference

### Core Equations

**Pressure Vector:**
$$\vec{P}(t) = [p_{\text{lat}}, p_{\text{err}}, p_{\text{sat}}]^T$$

**Momentum:**
$$\vec{M}(t) = \frac{\vec{P}(t) - \vec{P}(t-1)}{\Delta t}$$

**Scar Tissue:**
$$S(t) = S(t-1) \cdot e^{-\lambda \Delta t} + \sigma \cdot \mathbb{I}(\|\vec{P}\| > P_{\text{crit}})$$

**Impedance Law:**
$$R(t) = R_{\text{base}} + (\vec{P}^T \mathbf{W}) + \mu\|\vec{M}\| + S(t)$$

**Flow Condition:**
$$\text{Flow} = \begin{cases} 1 & V > R \\ 0 & V \leq R \end{cases}$$

---

## Reading Order

1. **Start here:** RFC-0001 for core model
2. **Extensions:** RFC-0002 for practical refinements
3. **Validation:** RFC-0003 for stability and testing
4. **Implementation:** RFC-0004 for code patterns
5. **Performance:** RFC-0009 for Rust/WASM

---

## Status Definitions

| Status      | Meaning                     |
| ----------- | --------------------------- |
| Draft       | Under development           |
| Review      | Ready for feedback          |
| Accepted    | Approved for implementation |
| Implemented | Code complete               |
| Deprecated  | Superseded by newer RFC     |

---

## Changelog

| Date       | Change                                |
| ---------- | ------------------------------------- |
| 2026-01-22 | Added RFC-0007-0010, updated statuses |
| 2026-01-09 | Initial RFC set created (0001-0006)   |
