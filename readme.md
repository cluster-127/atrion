# Atrion

> The Reference Implementation of Conditioned Deterministic Orchestration

## A Topological Physics Approach to Distributed Reliability

* **Type:** Research Proposal & Proof of Concept (PoC)
* **Domain:** Distributed Systems Engineering, Control Theory, Adaptive Systems

---

## 1. Abstract

This repository contains the reference implementation and simulation environment for **Conditioned Deterministic Orchestration (CDO)**.

CDO is a theoretical framework that reimagines fault tolerance in distributed systems not as a rule-based policy enforcement (e.g., static circuit breakers), but as a **fluid dynamics and digital physics problem**. The core hypothesis is that system stability can be achieved by modeling traffic flow through **Vectorized Pressure**, **Momentum (Derivative Control)**, and **Structural Scarring (Hysteresis)**.

The goal is to create a decision topology where erroneous behaviors are not explicitly "forbidden" by policy, but become physically impossible (or prohibitively expensive) due to rising system impedance.

---

## 2. Core Concepts

The system operates on four redefined axioms of distributed control:

1. **Decision $\rightarrow$ Flow:** Routing is not a binary choice but a function of potential energy (Priority/Voltage) overcoming dynamic resistance (Impedance).
2. **Constraint $\rightarrow$ Dynamic Resistance:** Constraints are not static limits. They are variable forces that increase with pressure (Latency, Error, Saturation) and momentum.
3. **Memory $\rightarrow$ Scar Tissue:** The system retains a "memory" of past failures as topological scarring. This increases the base resistance of a route, which decays over time via entropy.
4. **Rejection $\rightarrow$ Impedance:** Requests are not actively rejected; they are shed when their priority voltage cannot overcome the calculated total resistance.

---

## 3. Mathematical Model

The engine implements the following discrete-time dynamical equations:

### 3.1. State Space ($\vec{P}$)

Pressure is a 3-dimensional vector representing the stress on a route at time $t$:
$$
\vec{P}(t) = [ p_{lat}, p_{err}, p_{sat} ]
$$

### 3.2. Momentum ($\vec{M}$)

The system is proactive, reacting to the *rate of change* (derivative) rather than just the absolute value:
$$
\vec{M}(t) = \frac{\vec{P}(t) - \vec{P}(t-1)}{\Delta t}
$$

### 3.3. The Law of Impedance ($R_{total}$)

The total resistance of a route is calculated as:
$$
R(t) = R_{base} + \|\vec{P}(t)\| + (\mu \cdot \|\vec{M}(t)\|) + S(t)
$$

* **$R_{base}$**: Static topological cost.
* **$\mu$ (Damping)**: Coefficient to penalize high-velocity changes (prevents wall-hitting).
* **$S(t)$ (Scar)**: Persistent resistance from past trauma, subject to exponential decay ($e^{-\lambda t}$).

---

## 4. Project Structure

This repository is structured as a "Game Engine" for reliability simulation, strictly separating the mathematical core from the simulation loop.

```text
/src
  ├── core/
  │   ├── types.ts       # Vector definitions and State interfaces
  │   └── physics.ts     # Pure functions implementing the equations (Ohm's Law, Momentum)
  ├── simulation/
  │   ├── scenario.ts    # Synthetic load generators (Sine waves, spikes)
  │   └── index.ts       # Main simulation loop (No I/O, console plotting)
  └── tests/             # Unit tests for the physics engine

```

---

## 5. Getting Started

This is a **simulation environment**, not a production library. It runs in-memory to validate the mathematical model.

### Prerequisites

* Node.js (LTS) or Bun

### Installation

```bash
npm install
# or
bun install

```

### Running the Simulation

The default simulation injects synthetic error spikes and visualizes the **Resistance** response in the console.

```bash
npm start
# or
npx ts-node src/simulation/index.ts

```

### Expected Output

Observe the console logs. When an error spike is introduced:

1. **Resistance** should rise *before* the error peaks (due to Momentum).
2. **Resistance** should remain elevated after the error clears (due to Scar Tissue).
3. **Resistance** should slowly decay back to baseline (Entropy).

---

## 6. Research Questions

This project aims to validate the following hypotheses:

* **H1:** Momentum-based resistance eliminates "flapping" (hysteresis) observed in binary circuit breakers.
* **H2:** Mathematical decay (entropy) prevents deadlocks without requiring explicit "health check" probes.
* **H3:** Scar tissue modeling effectively routes traffic away from chronically unstable nodes without manual intervention (Auto-Remodeling).

---

## 7. Disclaimer

This is an academic research proposal and a Proof of Concept (PoC). The code provided here is for **simulation and modeling purposes only**. It is not intended for use in production environments as a traffic controller or load balancer in its current state.
