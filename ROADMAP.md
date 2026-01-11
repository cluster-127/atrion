# Atrion Roadmap

> Physics-based concurrency control for Node.js

---

## Current: v1.2.1 ✅

**Neuroplasticity Release** (2026-01-11)

- ✅ Core Physics Engine
- ✅ Observer Pattern (telemetry)
- ✅ AutoTuner Module (μ+kσ adaptive thresholds)
- ✅ Circuit Breaker Recovery Fix
- ✅ AtrionGuard Wrapper Class
- ✅ 13 Wind Tunnel Scenarios
- ✅ 114 Passing Tests
- ✅ npm Published

---

## Next: v2.0.0 🚧

**Pluggable State Architecture** (RFC-0008)

### Phase 1: Core Interfaces

- [ ] `StateProvider` interface
- [ ] `StateManager` class
- [ ] `PhysicsVector` type

### Phase 2: Providers

- [ ] `InMemoryProvider` (default, free)
- [ ] Backward compatibility layer

### Phase 3: Atrion Class

- [ ] Main `Atrion` entry point
- [ ] Constructor with provider option
- [ ] AutoTuner enabled by default

### Phase 4: Observability

- [ ] OpenTelemetry adapter
- [ ] Metrics export

---

## Future: v2.x+

### Potential Features

| Feature      | Priority | Description                   |
| ------------ | -------- | ----------------------------- |
| Multi-tenant | Medium   | Per-tenant state isolation    |
| Prediction   | Medium   | ML-based threshold prediction |
| Dashboard    | High     | Real-time visualization       |
| Prometheus   | Medium   | Native metrics export         |
| gRPC         | Low      | Alternative to HTTP           |

---

## Version History

| Version | Date       | Highlights                       |
| ------- | ---------- | -------------------------------- |
| v1.2.1  | 2026-01-11 | AutoTuner physics integration    |
| v1.2.0  | 2026-01-11 | Neuroplasticity, 6 new scenarios |
| v1.1.0  | 2026-01-11 | Observer pattern                 |
| v1.0.0  | 2026-01-09 | Initial release                  |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0
