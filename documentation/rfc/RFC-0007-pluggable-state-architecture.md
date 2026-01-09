# RFC-0007: Pluggable State Architecture

| Field       | Value                                            |
| ----------- | ------------------------------------------------ |
| **RFC**     | 0007                                             |
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

## 7. Enterprise Adapter (Paid)

### 7.1. RedisClusterProvider

```typescript
// @atrion/cluster (Commercial Package)

import { Atrion } from 'atrion'
import { RedisClusterProvider } from '@atrion/cluster'

const atrion = new Atrion({
  provider: new RedisClusterProvider({
    redis: { url: process.env.REDIS_URL },
    sync: { interval: 100, channel: 'atrion:sync' },
    gamma: 0.3, // Cluster influence factor
  }),
  license: process.env.ATRION_LICENSE_KEY,
})
```

### 7.2. Failure Mode: Graceful Degradation

```typescript
class RedisClusterProvider implements StateProvider {
  private fallback = new InMemoryProvider()
  private healthy = true

  async updateVector(routeId: string, vector: PhysicsVector) {
    try {
      await this.redis.publish('atrion:sync', JSON.stringify({ routeId, vector }))
      this.healthy = true
    } catch (e) {
      console.warn('[Atrion] Redis unavailable, degrading to InMemory')
      this.healthy = false
      // Continue operating - traffic flow > metrics sync
    }
  }
}
```

**Principle:** Never crash the application. Traffic flow is more important than state sync.

---

## 8. Pricing Model

### Per-Cluster Flat License

| Tier       | Monthly | Clusters     | Support     |
| ---------- | ------- | ------------ | ----------- |
| Starter    | $99     | 1 Production | Community   |
| Pro        | $299    | 5 Production | Email (48h) |
| Enterprise | Custom  | Unlimited    | Dedicated   |

**Why Per-Cluster?**

- Predictable cost (pod scaling doesn't increase bill)
- Simple metering (no usage tracking)
- Fair value (cluster coordination is the real value)

### License Validation

```typescript
interface LicenseKey {
  tier: 'starter' | 'pro' | 'enterprise'
  clusterLimit: number
  expiresAt: Date
  signature: string // Cryptographic, offline validation
}
```

---

## 9. Migration Path (v1 → v2)

```typescript
// v1.0 (Implicit InMemoryProvider)
const state = updatePhysics(state, telemetry, ...);

// v2.0 (Explicit Provider - Free)
const atrion = new Atrion({
  provider: new InMemoryProvider(), // Default
});

// v2.0 (Enterprise)
const atrion = new Atrion({
  provider: new RedisClusterProvider({ ... }),
  license: 'atrion_ent_xxx',
});
```

### Breaking Changes

| v1.0                       | v2.0                            | Migration            |
| -------------------------- | ------------------------------- | -------------------- |
| `updatePhysics()` function | `atrion.updatePhysics()` method | Wrap in Atrion class |
| Stateless functions        | Stateful Atrion instance        | Create singleton     |

---

## 10. Open Source Boundary

### Apache-2.0 (Free)

- `StateProvider` interface
- `InMemoryProvider` implementation
- `StateManager` class
- All physics functions
- Simulation tools

### Commercial (Paid)

- `RedisClusterProvider`
- `PostgresPersistenceAdapter`
- `AtrionStudio` dashboard
- License key validation

---

## 11. Implementation Phases

| Phase | Deliverable                       | Timeline  |
| ----- | --------------------------------- | --------- |
| 1     | `StateManager` + `StateProvider`  | Week 1-2  |
| 2     | `InMemoryProvider` + Atrion class | Week 2-3  |
| 3     | OpenTelemetry hooks               | Week 3-4  |
| 4     | `@atrion/cluster` (private repo)  | Week 5-8  |
| 5     | License key system                | Week 6-8  |
| 6     | `@atrion/studio` MVP              | Week 9-12 |

---

## 12. Risks

| Risk                     | Mitigation                                |
| ------------------------ | ----------------------------------------- |
| Breaking change backlash | Migration guide + codemods                |
| Redis as single backend  | Design for multiple adapters              |
| License bypass           | Legal protection, not technical DRM       |
| Redis failure            | Graceful degradation to InMemoryProvider  |
| Open source competition  | Move fast, build community, provide value |

---

## 13. References

1. Hexagonal Architecture (Ports & Adapters) - Alistair Cockburn
2. HashiCorp BSL License Model
3. Redis CRSP (Eventually Consistent)
4. Kong Enterprise Plugin Architecture

---

## 14. Changelog

| Version | Date       | Changes                           |
| ------- | ---------- | --------------------------------- |
| 0.1.0   | 2026-01-09 | Initial draft                     |
| 0.2.0   | 2026-01-09 | Merged: Hexagonal, CachedState, γ |
