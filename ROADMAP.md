# Atrion Roadmap

> Physics-based concurrency control for Node.js

---

## Current: v1.3.1 ✅

**Pluggable State Architecture** (2026-01-21)

- ✅ Core Physics Engine (RFC-0001-0004)
- ✅ AutoTuner Module (RFC-0007)
- ✅ Pluggable State Architecture (RFC-0008)
- ✅ InMemoryProvider + RedisStateProvider
- ✅ 141 Passing Tests
- ✅ npm Published

---

## Next: v2.0.0 🚧

**Major Release: Performance + Workload Profiles**

### RFC-0009: Rust/WASM Physics Engine

- [x] Rust physics core (586M ops/s)
- [x] WASM compilation (13.2KB bundle)
- [x] SIMD optimization (AVX2 + WASM SIMD128)
- [x] TypeScript integration (`useWasm` flag)
- [x] Differential testing (TS/WASM parity)

### RFC-0010: Workload Profiles

- [ ] LIGHT, STANDARD, HEAVY, EXTREME profiles
- [ ] Profile-aware pressure calculation
- [ ] Lease API (`startTask`, `heartbeat`, `release`)
- [ ] AbortController integration
- [ ] AI Swarm support

---

## Future: v3.x+

### Potential Features

| Feature       | Priority | Description                   |
| ------------- | -------- | ----------------------------- |
| Dashboard     | High     | Real-time visualization       |
| Prometheus    | High     | Native metrics export         |
| Multi-tenant  | Medium   | Per-tenant state isolation    |
| Prediction    | Medium   | ML-based threshold prediction |
| OpenTelemetry | Medium   | Trace + metrics adapters      |
| gRPC          | Low      | Alternative to HTTP           |

---

## Version History

| Version | Date       | Highlights                       |
| ------- | ---------- | -------------------------------- |
| v1.3.1  | 2026-01-21 | Error hierarchy, LRU memory      |
| v1.3.0  | 2026-01-21 | Pluggable State (RFC-0008)       |
| v1.2.1  | 2026-01-11 | AutoTuner physics integration    |
| v1.2.0  | 2026-01-11 | Neuroplasticity, 6 new scenarios |
| v1.1.0  | 2026-01-11 | Observer pattern                 |
| v1.0.0  | 2026-01-09 | Initial release                  |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache-2.0
