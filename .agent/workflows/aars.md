---
description: Atrion Agentic Rules Set (AARS) - Mandatory principles for CDO Physics Engine development
---

# ATRION AGENTIC RULES SET (AARS) v1.0

**Target System:** Conditioned Deterministic Orchestration (CDO) Physics Engine
**Enforcement Level:** STRICT / ZERO TOLERANCE

---

## 0. PRIME DIRECTIVE: The Physics Analogy

Atrion is NOT a standard software library. It is a **Digital Physics Engine**.

- **Rule:** Code behavior must mimic physical laws (conservation of energy, entropy, inertia), not business logic heuristics.
- **Violation:** Using `if/else` logic where a mathematical formula (decay/damping) could be used.
- **Enforcement:** Reject any PR that hardcodes thresholds outside of the `CircuitBreaker` state logic.

---

## 1. ARCHITECTURAL PURITY (Functional Core)

### 1.1 No Side Effects in Core

- **Rule:** Files under `src/core/` MUST be **Pure Functions**. They map `(State, Input) -> NewState`.
- **Forbidden:**
- Calling `Date.now()` or `new Date()`.
- Generating random numbers (`Math.random()`).
- Console logging (except via injected Logger interface).
- Mutating arguments.

- **Exception:** `src/core/guards.ts` may throw Errors or log warnings via dependency injection.

### 1.2 Immutability is Law

- **Rule:** All state updates MUST return a new object reference.
- **Pattern:** Use spread syntax `{ ...state, newProp }`.
- **Forbidden:** `state.resistance = 10;` or `array.push(item)`.

---

## 2. TYPE SYSTEM & SAFETY

### 2.1 Primitive Obsession is Forbidden

- **Rule:** Never use bare `number` for physical units in public interfaces.
- **Requirement:** Use Branded Types (`Volts`, `Ohms`, `Momentum`).
- **Enforcement:**
- ❌ `function calculateFlow(v: number, r: number)`
- ✅ `function calculateFlow(v: Volts, r: Ohms)`

### 2.2 Explicit State Transitions

- **Rule:** State transitions must respect the Discriminated Union definition.
- **Requirement:** Use TypeScript control flow analysis (narrowing) based on `mode`.
- **Forbidden:** Accessing `state.momentum` without checking if `mode === 'OPERATIONAL'`.

---

## 3. MATHEMATICAL HYGIENE

### 3.1 The NaN/Infinity Zero Tolerance

- **Rule:** Every mathematical operation involving division, logarithms, or exponents MUST be guarded.
- **Requirement:** Wrap potentially dangerous ops with helpers from `src/core/guards.ts`.
- **Sanitization:** Inputs from the "outside world" (telemetry) MUST be sanitized via `PhysicsGuard.sanitizeVector` before entering the core loop.

### 3.2 Floating Point Determinism

- **Rule:** Never compare floating point numbers with `===`.
- **Requirement:** Use `Math.abs(a - b) < EPSILON`.
- **Normalize Zero:** `-0` MUST be normalized to `0` to prevent logging confusion.

### 3.3 Zero-Clamping (Zeno's Paradox)

- **Rule:** Values decaying asymptotically (e.g., Scar Tissue) MUST be clamped to strict 0 when they fall below `EPSILON`.
- **Rationale:** Prevents denormalized number performance penalties and log pollution.

---

## 4. TIME & DETERMINISM

### 4.1 Time is an Input

- **Rule:** The physics engine is strictly **Time-Agnostic**.
- **Requirement:** `deltaT` and `staleness` are calculated by the _Shell_ (Simulation Runner) and passed as arguments to the _Core_.
- **Constraint:** `deltaT` MUST be guaranteed positive (`> 0`). If `now < lastUpdated` (clock skew), treat `deltaT` as `minDeltaT`.

### 4.2 Timestamp vs Duration

- **Rule:** Strictly distinguish between `Timestamp` (Point in time) and `DeltaTime` (Duration).
- **Violation:** Adding two Timestamps together (Semantically meaningless).

---

## 5. TESTING MANDATES

### 5.1 Invariants Over Examples

- **Rule:** Unit tests are insufficient for physics. **Property-Based Tests** (`fast-check`) are mandatory for all core formulas.
- **Required Invariants:**
- `Resistance >= BaseResistance` (Always)
- `Momentum(p, p) === 0` (Identity)
- `Normalize(x) \in [-1, 1]` (Bounds)

### 5.2 Deterministic Simulation

- **Rule:** Simulations MUST use `VirtualClock`.
- **Requirement:** A test run with seed X must produce _identical_ charts byte-for-byte on every run.

---

## 6. DOCUMENTATION & RFCs

### 6.1 RFC First

- **Rule:** Code implements RFCs. Code does not define behavior.
- **Workflow:** If implementation requires a logic change, update the RFC first, then the code.
- **Traceability:** Complex functions MUST include a comment linking to the specific RFC section (e.g., `// See RFC-0002 §3.1`).

---

## 7. AI PERSONA INSTRUCTION (For Prompts)

**Copy/Paste this when starting a new session:**

> You are **Atrion-Architect**, a strict Senior Systems Engineer specializing in Control Theory and Distributed Systems.
> **Your Constraints:**
>
> 1. You strictly follow the **Functional Core, Imperative Shell** pattern.
> 2. You use **Branded Types** for all physical units; raw numbers are forbidden in signatures.
> 3. You are paranoid about **NaN, Infinity, and floating-point errors**.
> 4. You prefer **composition over inheritance**.
> 5. You prioritize **mathematical correctness** over "clever" code.
>
> **Current Context:** We are building the Atrion Physics Engine (MVS Phase).
> **Objective:** Implement rigorous, scientifically accurate TypeScript code.
> **Tone:** Professional, Concise, Technical, "Brutally Honest". Don't fluff. Just code and logic.
