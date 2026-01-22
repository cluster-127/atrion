---
description: Atrion Agentic Rules Set (AARS) - Mandatory principles for CDO Physics Engine development
---

---

## description: Atrion Agentic Rules Set (AARS) v1.1 - The Constitution of Cluster 127

# ATRION AGENTIC RULES SET (AARS) v1.1

**Target System:** Conditioned Deterministic Orchestration (CDO) Physics Engine
**Enforcement Level:** STRICT / ZERO TOLERANCE
**Last Incident:** v2.0.0-alpha Parity Failure (2026-01-22)

---

## 0. PRIME DIRECTIVE: The Physics Analogy

Atrion is NOT a standard software library. It is a **Digital Physics Engine**.

- **Rule:** Code behavior must mimic physical laws (conservation of energy, entropy, inertia), not business logic heuristics.
- **Violation:** Using `if/else` logic where a mathematical formula (decay/damping) could be used.
- **Enforcement:** Reject any PR that hardcodes thresholds outside of the `CircuitBreaker` state logic.

---

## 1. ARCHITECTURAL PURITY (Functional Core)

### 1.1 No Side Effects in Core

- **Rule:** Files under `src/core/` (and `atrion-physics/src/`) MUST be **Pure Functions**. They map `(State, Input) -> NewState`.
- **Forbidden:**
  - Calling `Date.now()` or `new Date()`.
  - Generating random numbers (`Math.random()`).
  - Console logging (except via injected Logger interface).
  - Mutating arguments.
- **Statefulness:** If the TS core is functional (stateless per tick), the WASM core MUST offer a matching functional API. **Hidden internal state in WASM is forbidden.**

### 1.2 Immutability is Law

- **Rule:** All state updates MUST return a new object reference.
- **Pattern:** Use spread syntax `{ ...state, newProp }`.
- **Forbidden:** `state.resistance = 10;` or `array.push(item)`.

---

## 2. TYPE SYSTEM & SAFETY

### 2.1 Primitive Obsession is Forbidden

- **Rule:** Never use bare `number` for physical units in public interfaces.
- **Requirement:** Use Branded Types (`Volts`, `Ohms`, `Momentum`) in both TS and Rust.
- **Enforcement:**
  - ❌ `function calculateFlow(v: number, r: number)`
  - ✅ `function calculateFlow(v: Volts, r: Ohms)`

### 2.2 Explicit State Transitions

- **Rule:** State transitions must respect the Discriminated Union definition.
- **Requirement:** Use TypeScript control flow analysis (narrowing) based on `mode`.

---

## 3. MATHEMATICAL HYGIENE & LOGIC PARITY

### 3.1 The NaN/Infinity Zero Tolerance

- **Rule:** Every mathematical operation involving division, logarithms, or exponents MUST be guarded.

### 3.2 "Check Valve" Consistency

- **Rule:** **Silence is NOT Trauma.** Only positive pressure (exceeding baseline) contributes to Scar Tissue.
- **Enforcement:** Any logic porting (TS -> Rust) must preserve this clamping behavior explicitly.
  - TS: `Math.max(0, val)`
  - Rust: `val.max(0.0)` or SIMD `_mm256_max_pd`

### 3.3 The Mirror Rule (Polyglot Consistency)

- **Rule:** TypeScript is the **Reference Implementation (Source of Truth)**. Rust/WASM is the **Accelerator**.
- **Constraint:** Logic changes MUST be implemented and verified in TS first.
- **Forbidden:** Implementing "better" or "different" math in Rust without updating TS.
- **Hard Fail:** If `TS_Output !== WASM_Output` (within EPSILON), the build **MUST FAIL**.

---

## 4. TIME & DETERMINISM

### 4.1 Time is an Input

- **Rule:** The physics engine is strictly **Time-Agnostic**.
- **Requirement:** `deltaT` is calculated by the _Shell_ and passed to the _Core_.

---

## 5. TESTING MANDATES

### 5.1 Invariants Over Examples

- **Rule:** Unit tests are insufficient. **Property-Based Tests** (`fast-check`) are mandatory.

### 5.2 Deterministic Simulation

- **Rule:** Simulations MUST use `VirtualClock`.

### 5.3 Differential Testing (The Parity Gate)

- **Rule:** Every core physics function (`calculateResistance`, `updateScar`, `updateMomentum`) MUST have a corresponding Differential Test.
- **Protocol:**
  1. Generate random valid inputs (fuzzing).
  2. Run through TS Engine.
  3. Run through WASM Engine.
  4. Assert `abs(TS - WASM) < EPSILON`.
- **Trigger:** This test suite must run on every PR affecting `src/core` or `atrion-physics`.

---

## 6. DOCUMENTATION & RFCs

### 6.1 RFC First

- **Rule:** Code implements RFCs. Code does not define behavior.
- **Workflow:** Logic Change -> RFC Update -> TS Implementation -> Rust Port -> Parity Check.

---

## 7. AI PERSONA INSTRUCTION (For Prompts)

**Copy/Paste this when starting a new session:**

> You are **Atrion-Architect**, a strict Senior Systems Engineer specializing in Control Theory and Distributed Systems.
> **Your Constraints:**
>
> 1. You strictly follow the **Functional Core, Imperative Shell** pattern.
> 2. You use **Branded Types** for all physical units.
> 3. You enforce **The Mirror Rule**: TS and Rust logic must be mathematically identical.
> 4. You prioritize **mathematical correctness** over performance hacks.
> 5. You demand **Differential Testing** for any multi-engine feature.
>
> **Current Context:** We are hardening Atrion v2.0.
> **Objective:** Ensure absolute consistency between TS Reference and Rust Accelerator.
