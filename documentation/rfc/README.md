# Atrion RFC Documentation

> Conditioned Deterministic Orchestration — Request for Comments

---

## RFC Index

| RFC                                                 | Title                     | Status | Description                                   |
| --------------------------------------------------- | ------------------------- | ------ | --------------------------------------------- |
| [RFC-0001](./RFC-0001-core-mathematical-model.md)   | Core Mathematical Model   | Draft  | State space, impedance law, flow decision     |
| [RFC-0002](./RFC-0002-theoretical-extensions.md)    | Theoretical Extensions    | Draft  | SLO-driven weights, tanh, multi-rate sampling |
| [RFC-0003](./RFC-0003-stability-analysis.md)        | Stability Analysis        | Draft  | Lyapunov, failure modes, validation framework |
| [RFC-0004](./RFC-0004-implementation-guidelines.md) | Implementation Guidelines | Draft  | Mental models, invariants, contracts          |
| [RFC-0005](./RFC-0005-research-roadmap.md)          | Research Roadmap          | Draft  | Open questions, bibliography                  |
| [RFC-0006](./RFC-0006-visual-metaphors.md)          | Visual Metaphors          | Draft  | Mermaid diagrams, hydraulic analogy           |

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

## Contributing

To propose changes:

1. Open an issue describing the problem
2. Reference relevant RFC sections
3. Propose specific amendments

---

## Changelog

| Date       | Change                              |
| ---------- | ----------------------------------- |
| 2026-01-09 | Initial RFC set created (0001-0004) |
