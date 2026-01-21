# Atrion Roadmap

> Physics-based concurrency control for Node.js

---

## Current: v1.3.0 ✅

**Pluggable State Architecture** (2026-01-21)

- ✅ Core Physics Engine
- ✅ Observer Pattern (telemetry)
- ✅ AutoTuner Module (μ+kσ adaptive thresholds)
- ✅ **Atrion Class** (new v2.0 API)
- ✅ **StateProvider Interface** (RFC-0008)
- ✅ **InMemoryProvider** (default)
- ✅ **RedisStateProvider** (LWW sync)
- ✅ 141 Passing Tests
- ✅ npm Published

---

## Next: v1.4.0 🚧

**Observability & Developer Experience**

### Phase 1: OpenTelemetry

- [ ] Trace adapter
- [ ] Metrics export
- [ ] Structured logging (JSON)

### Phase 2: Migration Tools

- [ ] v1.x deprecation warnings
- [ ] Codemod for API migration

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
| v1.3.0  | 2026-01-21 | Pluggable State, Atrion Class    |
| v1.2.1  | 2026-01-11 | AutoTuner physics integration    |
| v1.2.0  | 2026-01-11 | Neuroplasticity, 6 new scenarios |
| v1.1.0  | 2026-01-11 | Observer pattern                 |
| v1.0.0  | 2026-01-09 | Initial release                  |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0
