# Atrion Roadmap

> Physics-based concurrency control for Node.js

---

## Current: v2.0.0 ✅

**Major Release: WASM Default + Workload Profiles** (2026-01-22)

### RFC-0009: Rust/WASM Physics Engine ✅

- [x] Rust physics core (586M ops/s)
- [x] WASM compilation (13.2KB bundle)
- [x] SIMD optimization (AVX2 + WASM SIMD128)
- [x] WASM default (`engine: 'auto'`)
- [x] Check Valve parity fix
- [x] Differential testing (9 parity tests)

### RFC-0010: Workload Profiles ✅

- [x] LIGHT, STANDARD, HEAVY, EXTREME profiles
- [x] Profile-aware pressure calculation
- [x] Lease API (`startTask`, `heartbeat`, `release`)
- [x] AbortController integration
- [x] `setRouteProfile()` API

### Quality ✅

- [x] 184 passing tests
- [x] 17 Rust unit tests
- [x] ESLint + Husky pre-commit

---

## Next: v2.1.0 🚧

**AI Swarm & Advanced Profiles**

- [ ] AI Swarm workload support
- [ ] Dynamic profile switching
- [ ] Profile telemetry & analytics
- [ ] Dashboard prototype

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
| v2.0.0  | 2026-01-22 | WASM default, Workload Profiles  |
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
