# Contributing to Atrion

First off, thank you for considering contributing to Atrion! 🚀

Atrion is not just a library; it is a **Deterministic Physics Engine** for traffic orchestration. Because we deal with critical system stability, we hold our codebase to extremely high standards of rigor, type safety, and mathematical determinism.

Please read this document before opening a Pull Request.

---

## 🏛️ The Atrion Philosophy

We follow the **AARS (Atrion Agentic Rules Set)**. Every line of code must adhere to these principles:

1.  **Functional Core, Imperative Shell:** The logic in `src/core/` must be pure functions. No side effects, no IO, no randomness.
2.  **Simulation First:** If it cannot be simulated, it does not exist.
3.  **SI Units:** We speak the language of Physics. Time is in **Seconds**, not milliseconds.

---

## 📏 Coding Standards (The "Law")

### 1. No Naked Primitives (Branded Types)

Never use plain `number` for physical quantities. Use Branded Types defined in `src/core/types.ts`.

**❌ BAD:**

```typescript
function calculate(pressure: number): number { ... }

```

**✅ GOOD:**

```typescript
function calculate(pressure: NormalizedPressure): Ohms { ... }

```

### 2. Time Determinism

Never use `Date.now()` or `setTimeout` inside the core logic. Time is an external dependency injected via `VirtualClock` or `DeltaTime`.

**❌ BAD:**

```typescript
const now = Date.now() // Non-deterministic!
```

**✅ GOOD:**

```typescript
updatePhysics(..., now: Timestamp) // Passed from the Imperative Shell

```

### 3. Math Safety & Guards

Atrion must run forever without crashing.

- **Division by Zero:** Always guarded.
- **NaN / Infinity:** Never allowed to propagate.
- **Epsilon:** Values below `1e-9` are considered noise (Zero).

### 4. Positive Stress Logic (Check Valve)

Remember the "Check Valve" rule:

- **Silence (Input = 0) is NOT Trauma.**
- Only positive pressure (exceeding baseline) contributes to Scar Tissue.

---

## 🧪 Testing Guidelines

We do not just write unit tests; we prove hypotheses.

1. **Unit Tests:** For pure functions (`src/core`).
2. **Simulation Tests:** Located in `tests/simulation/`.
3. **Hypothesis Validation:** Located in `tests/hypotheses/`. If you change the physics model, you MUST verify that:

- **H1:** Flapping is still damped (Momentum).
- **H2:** Deadlocks are prevented (Entropy).
- **H3:** Auto-routing still works.

To run tests:

```bash
npm test

```

---

## 📝 Pull Request Process

1. **One Hypothesis per PR:** Do not bundle refactors with new features.
2. **Update RFCs:** If you change the math, update the relevant document in `docs/rfc/`.
3. **Green CI:** All 100+ tests must pass.
4. **No "Any":** `ts-ignore` and `any` are strictly forbidden.

---

## ⚖️ License

By contributing, you agree that your contributions will be licensed under its **Apache 2.0 License**.
