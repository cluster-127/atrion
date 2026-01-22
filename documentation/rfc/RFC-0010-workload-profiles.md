# RFC-0010: Workload Profiles & Long-Running Tasks

**Status:** Draft
**Author:** Erdem Arslan
**Created:** 2026-01-21
**Target:** v2.1+

---

## Abstract

This RFC extends Atrion's admission control to support **heterogeneous workloads** — from microsecond API calls to hour-long ML training jobs — without penalizing legitimate heavy computation.

**Core Insight:** Pressure is deviation from expectation, not absolute magnitude.

---

## Motivation

### The False Positive Problem

Current model penalizes high latency/compute uniformly:

```
High latency → High pressure → Scar → Circuit breaker
```

**But what if high latency is expected?**

| Workload         | Expected Latency | "Abuse" Threshold |
| ---------------- | ---------------- | ----------------- |
| Health check     | 5ms              | 50ms              |
| REST API         | 100ms            | 500ms             |
| Video transcode  | 30s              | 5 min             |
| ML inference     | 5s               | 30s               |
| Genome sequencer | 30 min           | 2 hours           |
| AI Swarm agent   | 1-10 min         | 30 min            |

**Without workload awareness, Atrion would kill legitimate genome sequencing jobs.**

---

## Workload Profiles

### Profile Definitions

```typescript
type WorkloadProfile = 'LIGHT' | 'STANDARD' | 'HEAVY' | 'EXTREME' | 'CUSTOM'

interface ProfileConfig {
  baselineLatencyMs: number
  baselineComputeUs: number // microseconds CPU time
  baselineMemoryBytes: number
  maxDurationMs: number
  heartbeatRequired: boolean
}

const PROFILES: Record<WorkloadProfile, ProfileConfig> = {
  LIGHT: {
    baselineLatencyMs: 10,
    baselineComputeUs: 100,
    baselineMemoryBytes: 1_000,
    maxDurationMs: 1_000,
    heartbeatRequired: false,
  },
  STANDARD: {
    baselineLatencyMs: 100,
    baselineComputeUs: 10_000,
    baselineMemoryBytes: 10_000_000,
    maxDurationMs: 30_000,
    heartbeatRequired: false,
  },
  HEAVY: {
    baselineLatencyMs: 5_000,
    baselineComputeUs: 1_000_000,
    baselineMemoryBytes: 100_000_000,
    maxDurationMs: 300_000, // 5 minutes
    heartbeatRequired: true,
  },
  EXTREME: {
    baselineLatencyMs: 60_000, // 1 minute
    baselineComputeUs: 30_000_000, // 30 seconds
    baselineMemoryBytes: 8_000_000_000, // 8GB
    maxDurationMs: 3_600_000, // 1 hour
    heartbeatRequired: true,
  },
}
```

### API Usage

```typescript
// Short-lived request (default)
atrion.route('api/users', telemetry)

// With explicit profile
atrion.route('ml/inference', telemetry, { profile: 'HEAVY' })

// Per-route default
atrion.setRouteProfile('genom/sequence', 'EXTREME')
```

---

## Long-Running Task Model

### The Lease Pattern

```typescript
interface TaskLease {
  id: string
  routeId: string
  profile: WorkloadProfile
  startedAt: Timestamp
  expiresAt: Timestamp
  budget: ResourceBudget
  heartbeat(): void
  release(): Promise<void>
}

interface ResourceBudget {
  cpuTimeUs: number // Total CPU budget
  memoryBytes: number // Peak memory allowed
  remainingMs: number // Time until expiry
}
```

### Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                        TASK LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ ACQUIRE │ -> │ RUNNING │ -> │ HEALTHY │ -> │ RELEASE │  │
│  │  LEASE  │    │         │    │   ✓✓✓   │    │         │  │
│  └─────────┘    └────┬────┘    └─────────┘    └─────────┘  │
│                      │                                      │
│                      v                                      │
│                 ┌─────────┐                                 │
│                 │ TIMEOUT │ -> Lease expires, no scar      │
│                 │ (crash) │    (graceful handling)         │
│                 └─────────┘                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Start long-running task
const lease = await atrion.startTask('genom/sequence', {
  profile: 'EXTREME',
  timeout: 30 * 60 * 1000, // 30 minute max
})

try {
  // Periodic heartbeat during execution
  const interval = setInterval(() => {
    lease.heartbeat({
      progress: currentProgress,
      memoryUsed: process.memoryUsage().heapUsed,
    })
  }, 5000)

  // Do the actual work
  await runGenomeSequencing()

  clearInterval(interval)
} finally {
  // Release lease (success or failure)
  await lease.release()
}
```

---

## Physics Integration

### Pressure Calculation with Profiles

```typescript
function calculatePressure(actual: Telemetry, profile: ProfileConfig): PressureVector {
  return {
    latency: normalize(actual.latencyMs, profile.baselineLatencyMs),
    compute: normalize(actual.computeUs, profile.baselineComputeUs),
    memory: normalize(actual.memoryBytes, profile.baselineMemoryBytes),
  }
}
```

**Key Insight:** Same `normalize()` function, different baselines per profile.

### Scar Accumulation Rules

| Scenario                     | Scar? | Why                        |
| ---------------------------- | ----- | -------------------------- |
| LIGHT task exceeds 10ms      | YES   | Deviation from expectation |
| EXTREME task runs 30min      | NO    | Within expected bounds     |
| EXTREME task exceeds 2hr     | YES   | Budget exceeded            |
| Task crashes without release | NO    | Lease expires gracefully   |
| Task never sends heartbeat   | YES   | Unhealthy pattern          |

---

## AI Swarm / Multi-Agent Support

### Swarm Registration

```typescript
const swarm = await atrion.createSwarm('ai/research', {
  profile: 'HEAVY',
  maxAgents: 10,
  sharedBudget: {
    totalCpuTimeUs: 60_000_000, // 1 minute total
    totalMemoryBytes: 32_000_000_000, // 32GB shared
  },
})

// Each agent gets a sub-lease
const agent1 = await swarm.spawnAgent('agent-1')
const agent2 = await swarm.spawnAgent('agent-2')

// Swarm pressure = aggregate of all agents
// If swarm overloaded → Atrion can prevent new agents
```

### Swarm Pressure Model

```
P_swarm = Σ(P_agent[i]) / N_agents

If P_swarm > threshold:
  → Block new agent spawning
  → Shed lowest-priority agents
  → Circuit breaker on entire swarm
```

---

## Resource Isolation

### Soft Limits vs Hard Limits

| Limit Type | Behavior                      | Physics Effect  |
| ---------- | ----------------------------- | --------------- |
| **Soft**   | Warning, increased resistance | R += penalty    |
| **Hard**   | Task terminated               | Circuit breaker |

```typescript
interface ResourceLimits {
  soft: ResourceBudget // Pressure increases
  hard: ResourceBudget // Task killed
}
```

### Example Configuration

```typescript
atrion.setRouteProfile('ml/training', {
  profile: 'EXTREME',
  limits: {
    soft: { cpuTimeUs: 30_000_000, memoryBytes: 8_000_000_000 },
    hard: { cpuTimeUs: 60_000_000, memoryBytes: 16_000_000_000 },
  },
})
```

---

## Observability

### New Telemetry Fields

```typescript
interface ExtendedTelemetry {
  // Existing
  latencyMs: number
  errorRate: number
  saturation: number

  // New for long-running tasks
  computeUs?: number // CPU time consumed
  memoryBytes?: number // Current heap usage
  progress?: number // 0.0 - 1.0
  heartbeatAge?: number // ms since last heartbeat
}
```

### Lease Events

```typescript
observer.onLeaseAcquired({ routeId, profile, budget })
observer.onHeartbeat({ routeId, progress, memoryUsed })
observer.onLeaseReleased({ routeId, duration, outcome })
observer.onLeaseExpired({ routeId, reason: 'timeout' | 'budget_exceeded' })
```

---

## Migration Path

### Phase 1: Profile Support (v2.1)

- Add `WorkloadProfile` type
- Extend `route()` with profile option
- Profile-aware baseline calculation

### Phase 2: Lease API (v2.2)

- `startTask()` / `release()` API
- Heartbeat mechanism
- Lease expiration handling

### Phase 3: Swarm Support (v2.3)

- `createSwarm()` API
- Aggregate pressure calculation
- Cross-agent resource sharing

---

## Success Criteria

- [ ] Genome sequencer runs 30+ minutes without scar
- [ ] API endpoint (LIGHT) correctly penalizes >100ms latency
- [ ] AI Swarm with 10 agents managed correctly
- [ ] Crashed tasks don't accumulate scar
- [ ] Heartbeat failure triggers appropriate response

---

## Appendix: Quick Reference

```typescript
// Short-lived (default)
atrion.route('api/ping', telemetry)

// Medium workload
atrion.route('api/report', telemetry, { profile: 'STANDARD' })

// Long-running task
const lease = await atrion.startTask('ml/train', { profile: 'EXTREME' })
lease.heartbeat({ progress: 0.5 })
await lease.release()

// AI Swarm
const swarm = await atrion.createSwarm('agents', { maxAgents: 10 })
const agent = await swarm.spawnAgent('agent-1')
```

---

**Status:** Endorsed ✅

> _"Bu RFC, Atrion'u Akıllı bir Orkestratör yapıyor."_ — Senior Architect

---

## Appendix B: AbortController Pattern (Architect Recommendation)

### Problem: Silent Failures

If `lease.release()` is never called (e.g., process crash, infinite loop), the task continues consuming resources even after lease expires. This is a **resource leak**.

### Solution: Mandatory AbortController

```typescript
// Task MUST provide an AbortController
const controller = new AbortController()

const lease = await atrion.startTask('ml/training', {
  profile: 'EXTREME',
  abortController: controller, // REQUIRED for HEAVY/EXTREME
})

// If lease expires without release, Atrion calls:
// controller.abort()

// Task code must respect abort signal
async function runTraining(signal: AbortSignal) {
  while (!signal.aborted) {
    await trainNextBatch()
  }
  console.log('Training aborted by Atrion')
}

runTraining(controller.signal)
```

### Enforcement

| Profile  | AbortController Required? |
| -------- | ------------------------- |
| LIGHT    | No                        |
| STANDARD | No                        |
| HEAVY    | **Yes**                   |
| EXTREME  | **Yes**                   |

### Behavior on Expiry

```
Lease expires →
  1. Atrion calls controller.abort()
  2. Scar accumulated = (overrun time / expected time) × scarFactor
  3. Route marked unhealthy until recovery
```

This ensures Atrion has **active termination power**, not just passive observation.
