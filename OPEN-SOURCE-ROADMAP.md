# Atrion Open-Source Roadmap

> Physics-based concurrency control for Node.js — Apache-2.0

---

## Philosophy

**"Self-host the full engine. Scale with Atrion Cloud when ready."**

Atrion follows the **Sentry/Datadog model**: the complete physics engine is open-source and self-hostable. Atrion Cloud provides managed infrastructure, enhanced observability, and enterprise features for teams that want operational convenience.

---

## Current: v1.2.1 ✅

**Neuroplasticity Release** (2026-01-11)

### Core Physics Engine

| Feature              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| **Resistance Model** | `R(t) = R_base + Pressure + Momentum + ScarTissue`    |
| **Momentum**         | Rate-of-change detection (catch problems before peak) |
| **Scar Tissue**      | Historical trauma memory (remember bad routes)        |
| **Check Valve**      | Only positive pressure accumulates trauma             |

### AutoTuner (Zero-Config)

| Feature                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Z-Score Thresholds** | `dynamicBreak = μ + kσ`                              |
| **EMA Learning**       | Exponential moving average baseline                  |
| **Hybrid Limits**      | `minFloor` + `hardCeiling` (Boiling Frog protection) |
| **Shadow Mode**        | Continuous statistical learning                      |

### Observability

| Feature                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| **PhysicsObserver**    | Real-time telemetry callbacks                   |
| **Built-in Observers** | console, silent, composite, filtered, collector |
| **Mode Transitions**   | BOOTSTRAP → OPERATIONAL → CIRCUIT_OPEN          |
| **Prometheus Metrics** | Standard metric export                          |

### Validation

- ✅ 114 passing tests
- ✅ 13 Wind Tunnel scenarios
- ✅ 90.2% stability across 100 configurations
- ✅ Flapping: 1 transition vs 49 (standard CB)

---

## Next: v2.0.0 🚧

**Pluggable State Architecture** (RFC-0008)

### Phase 1: Core Interfaces

```typescript
interface StateProvider {
  get(routeId: string): PhysicsState | undefined
  set(routeId: string, state: PhysicsState): void
  delete(routeId: string): void
  keys(): Iterable<string>
}
```

- [ ] `StateProvider` interface
- [ ] `StateManager` class
- [ ] `PhysicsVector` type standardization

### Phase 2: Providers

- [ ] `InMemoryProvider` (Map-based, zero-dependency)
- [ ] `RedisStateProvider` (basic pub/sub sync)
- [ ] Backward compatibility layer

### Phase 3: Main Class Refactor

- [ ] `Atrion` class as primary entry point
- [ ] Constructor with `{ provider?: StateProvider }` option
- [ ] AutoTuner enabled by default

### Phase 4: Observability Enhancement

- [ ] OpenTelemetry Trace adapter
- [ ] OpenTelemetry Metrics adapter
- [ ] Structured logging (JSON format)

---

## Self-Hosted vs Cloud

| Capability             | Self-Hosted (Free) | Atrion Cloud  |
| ---------------------- | ------------------ | ------------- |
| **Core Physics**       | ✅ Full            | ✅ Full       |
| **AutoTuner**          | ✅ Full            | ✅ Full       |
| **InMemoryProvider**   | ✅                 | ✅            |
| **RedisStateProvider** | ✅ Basic sync      | ✅ Smart sync |
| **Prometheus Metrics** | ✅                 | ✅            |
| **Decision Dashboard** | ❌                 | ✅            |
| **Gamma Blending**     | ❌                 | ✅            |
| **VIP Lanes**          | ❌                 | ✅            |
| **HotPatch**           | ❌                 | ✅            |
| **GossipBan**          | ❌                 | ✅            |
| **TrafficReplay**      | ❌                 | ✅            |
| **Audit Logging**      | ❌                 | ✅            |
| **SSO/SAML**           | ❌                 | ✅ Enterprise |
| **SLA**                | ❌                 | ✅ Enterprise |

---

## API Surface

### Current (v1.x)

```typescript
import { AtrionGuard } from 'atrion'

const guard = new AtrionGuard({
  config: { scarFactor: 5 },
  autoTuner: true,
})

if (!guard.canAccept('api/checkout')) {
  return res.status(503).json({ error: 'Service busy' })
}

guard.reportOutcome('api/checkout', {
  latencyMs: 45,
  isError: false,
  saturation: 0.3,
})
```

### Planned (v2.x)

```typescript
import { Atrion, InMemoryProvider } from 'atrion'

const atrion = new Atrion({
  provider: new InMemoryProvider(),
  autoTuner: { k: 3, alpha: 0.1 },
})

const decision = atrion.route('api/checkout', telemetry)
```

### With Redis (v2.x)

```typescript
import { Atrion, RedisStateProvider } from 'atrion'

const atrion = new Atrion({
  provider: new RedisStateProvider({ url: 'redis://...' }),
  // ⚠️ Basic sync only. For smart conflict resolution,
  //    consider Atrion Cloud.
})
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
npm install
npm test
npm run simulate
npm run stability-map
```

---

## License

Apache-2.0

---

_"Self-host the brains. Let us handle the headaches."_
