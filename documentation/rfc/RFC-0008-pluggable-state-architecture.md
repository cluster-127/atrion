# RFC-0008: Pluggable State Architecture

| Field       | Value                                            |
| ----------- | ------------------------------------------------ |
| **RFC**     | 0008                                             |
| **Title**   | Pluggable State Architecture                     |
| **Status**  | Final Draft                                      |
| **Created** | 2026-01-09                                       |
| **Authors** | Erdem Arslan, Atrion Architect                   |
| **Target**  | v2.0.0                                           |
| **Related** | RFC-0001 (Core Model), RFC-0004 (Implementation) |

---

## 1. Abstract

Currently, Atrion stores its internal state (Momentum, Scar Tissue) in local process memory. While this ensures microsecond-level latency, it leads to **Fragmented Intelligence** in distributed environments (e.g., Kubernetes). If one pod detects a failure, others remain unaware until they experience the failure themselves.

This RFC proposes a **Pluggable State Interface** that decouples the Physics Engine from the Storage Layer, following the **Hexagonal (Ports & Adapters)** pattern. This enables:

- **Cluster Awareness:** Pods share Scar Tissue data
- **Persistence:** State survives process restarts
- **Extensibility:** Enterprise adapters (`@atrion/cluster`)
- **Open Core:** Free core, paid enterprise features

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HEXAGONAL ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    ┌─────────────┐     ┌─────────────┐     ┌────────────┐  │
│    │   Adapter   │     │   CORE      │     │  Adapter   │  │
│    │  (Redis)    │◄───►│  Physics    │◄───►│ (Metrics)  │  │
│    └─────────────┘     │   Engine    │     └────────────┘  │
│                        └──────┬──────┘                      │
│    ┌─────────────┐            │            ┌────────────┐  │
│    │   Adapter   │◄───────────┴───────────►│  Adapter   │  │
│    │ (InMemory)  │     StateProvider       │ (Postgres) │  │
│    └─────────────┘        Port             └────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Contract (Port)

### 3.1. StateProvider Interface

```typescript
// src/core/state/types.ts

export interface PhysicsVector {
  resistance: Ohms
  momentum: number
  scarTissue: Scar
  timestamp: Timestamp
}

export interface StateProvider {
  /**
   * Initialize provider and connect to external stores
   */
  connect(): Promise<void>

  /**
   * Cleanup on shutdown
   */
  disconnect(): Promise<void>

  /**
   * Retrieve current state vector for a route
   * Returns null if no state exists (cold start)
   */
  getVector(routeId: string): Promise<PhysicsVector | null>

  /**
   * Publish a state update
   * Implementation decides if fire-and-forget or awaited
   */
  updateVector(routeId: string, vector: PhysicsVector): Promise<void>

  /**
   * Subscribe to remote state changes (eventual consistency)
   */
  subscribe?(routeId: string, callback: (vector: PhysicsVector) => void): void
}
```

### 3.2. StateManager (Internal)

```typescript
// src/core/state/manager.ts

export class StateManager {
  private provider: StateProvider
  private cache: Map<string, PhysicsVector> = new Map()

  constructor(provider: StateProvider = new InMemoryProvider()) {
    this.provider = provider
  }

  /**
   * Fast path: Read from local cache (μs)
   */
  getLocal(routeId: string): PhysicsVector | null {
    return this.cache.get(routeId) ?? null
  }

  /**
   * Background: Sync with cluster (ms)
   */
  async sync(routeId: string, vector: PhysicsVector): Promise<void> {
    this.cache.set(routeId, vector)
    await this.provider.updateVector(routeId, vector)
  }
}
```

---

## 4. The Async Loop ("The Pulse")

Physics calculations are synchronous (CPU-bound). Network I/O is asynchronous (slow).
We use **Optimistic/Eventual Consistency** to prevent the Observer Effect.

```
┌─────────────────────────────────────────────────────────────┐
│                    THE ATRION LOOP                          │
├─────────────────────────────────────────────────────────────┤
│  1. COMPUTE  │ Engine calculates state (CachedState) │ μs  │
│  2. BUFFER   │ Changes buffered locally              │ μs  │
│  3. PUSH     │ Provider broadcasts delta (Async)     │ ms  │
│  4. PULL     │ Provider merges cluster updates       │ ms  │
└─────────────────────────────────────────────────────────────┘
```

**Fast Path (Read):** Engine reads from local `CachedState`
**Background Path (Sync):** Provider pushes/pulls asynchronously

---

## 5. Conflict Resolution: Gamma Blending (γ)

When Node A says `Scar = 5.0` and Node B says `Scar = 2.0`, we blend:

```
S_merged = γ × S_cluster + (1 - γ) × S_local
```

| γ Value     | Behavior                                        |
| ----------- | ----------------------------------------------- |
| γ = 0       | Ignore cluster (Isolationist)                   |
| γ = 1       | Obey cluster instantly (Hive Mind)              |
| **γ = 0.3** | **Recommended** - Local dominant, cluster pulls |

---

## 6. Default Adapter (Free)

```typescript
// src/core/state/providers/inmemory.ts

export class InMemoryProvider implements StateProvider {
  private store = new Map<string, PhysicsVector>()

  async connect(): Promise<void> {
    // No-op for in-memory
  }

  async disconnect(): Promise<void> {
    this.store.clear()
  }

  async getVector(routeId: string): Promise<PhysicsVector | null> {
    return this.store.get(routeId) ?? null
  }

  async updateVector(routeId: string, vector: PhysicsVector): Promise<void> {
    this.store.set(routeId, vector)
  }
}
```

---

## 7. Future Extensions

> Additional StateProvider implementations may be developed in separate packages.
> See project documentation for extension guidelines.

---

## 8. Migration Path (v1 → v2)

```typescript
// v1.0 (Implicit InMemoryProvider)
const state = updatePhysics(state, telemetry, ...);

// v2.0 (Explicit Provider)
const atrion = new Atrion({
  provider: new InMemoryProvider(), // Default
});
```

### Breaking Changes

| v1.0                       | v2.0                            | Migration            |
| -------------------------- | ------------------------------- | -------------------- |
| `updatePhysics()` function | `atrion.updatePhysics()` method | Wrap in Atrion class |
| Stateless functions        | Stateful Atrion instance        | Create singleton     |

---

## 9. Open Source Scope

### Apache-2.0

- `StateProvider` interface
- `InMemoryProvider` implementation
- `StateManager` class
- All physics functions
- Simulation tools

---

## 10. Implementation Phases

| Phase | Deliverable                       | Timeline |
| ----- | --------------------------------- | -------- |
| 1     | `StateManager` + `StateProvider`  | Week 1-2 |
| 2     | `InMemoryProvider` + Atrion class | Week 2-3 |
| 3     | OpenTelemetry hooks               | Week 3-4 |

---

## 11. Risks

| Risk                     | Mitigation                               |
| ------------------------ | ---------------------------------------- |
| Breaking change backlash | Migration guide + codemods               |
| Redis failure            | Graceful degradation to InMemoryProvider |

---

## 12. References

1. Hexagonal Architecture (Ports & Adapters) - Alistair Cockburn
2. Redis CRSP (Eventually Consistent)

---

## 13. Changelog

| Version | Date       | Changes                           |
| ------- | ---------- | --------------------------------- |
| 0.1.0   | 2026-01-09 | Initial draft                     |
| 0.2.0   | 2026-01-09 | Merged: Hexagonal, CachedState, γ |
| 0.3.0   | 2026-01-11 | Removed commercial sections       |
