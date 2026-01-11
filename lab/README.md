# Atrion Wind Tunnel Lab

Chaos testing environment for validating Atrion's fault tolerance.

---

## 📁 Structure

```
lab/
├── chaos/           # Basic error/latency testing
│   ├── chaos-server.ts
│   └── guardian-client.ts
├── fintech/         # Multi-route, cascade failures
│   ├── fintech-server.ts
│   └── fintech-client.ts
├── flash-crowd/     # Saturation pressure testing
│   ├── stable-server.ts
│   └── flash-client.ts
├── security/        # DDoS defense & tarpit
│   ├── tarpit-server.ts
│   └── ddos-client.ts
├── llm-router/      # AI model switching
│   ├── llm-providers.ts
│   └── smart-router.ts
├── game-lod/        # Base game LOD scenario
│   ├── game-server.ts
│   └── lod-controller.ts
├── game-lod-v2/     # [NEW] Soft degradation delay fix
│   ├── game-server.ts
│   └── lod-controller.ts
├── cb-recovery/     # [NEW] Circuit breaker recovery test
│   ├── cb-server.ts
│   └── recovery-client.ts
├── predictive-lod/  # [NEW] Anticipatory LOD switching
│   ├── game-server.ts
│   └── predictive-controller.ts
└── README.md
```

---

## 🧪 Scenarios

| Scenario           | Port    | Purpose                                  |
| ------------------ | ------- | ---------------------------------------- |
| Chaos              | 3000    | Error/latency tolerance                  |
| Fintech            | 3001    | Multi-route, cascade failures            |
| Flash Crowd        | 3002    | Saturation pressure                      |
| Security           | 3003    | DDoS defense, tarpit                     |
| LLM Router         | 3004    | AI model switching, cost optimization    |
| Game LOD           | 3005    | Base soft degradation                    |
| **Game LOD V2**    | 3006    | **Budget miss weight amplification**     |
| **CB Recovery**    | 3007    | **Circuit breaker exit via half-open**   |
| **Predictive LOD** | 3008    | **Trend-based anticipatory degradation** |
| **E-Commerce**     | 3009    | **VIP priority routing (Black Friday)**  |
| **IoT Data Dam**   | 3010    | **Lossy backpressure (sampling)**        |
| **Microservices**  | 3011-13 | **Domino stopper (fast-fail chain)**     |
| **AutoTuner**      | -       | **Adaptive threshold validation (μ+kσ)** |

---

## 📊 Key Results (2026-01-11)

### ⚔️ Security (Tarpit) — **BREAKTHROUGH!**

| Metric          | Value               |
| --------------- | ------------------- |
| Bot Latency     | 2ms → **5000ms** 🕸️ |
| Max Resistance  | **120.6Ω**          |
| Circuit Breaker | **TRIGGERED** ✅    |

### 💳 Fintech

- Route isolation working
- Cascade failures absorbed

### ⚡ Flash Crowd

- 68% saturation achieved
- No blocking (server stable)

### 🎮 Game LOD V2 — **Soft Degradation Fix**

| Metric           | V1 (Base) | V2 (Fixed)    |
| ---------------- | --------- | ------------- |
| First LOD switch | Tick #91  | **Tick #41**  |
| Budget miss amp  | None      | **3x weight** |

### 🔌 CB Recovery — **Hysteresis Fix**

| Metric       | Before      | After       |
| ------------ | ----------- | ----------- |
| CB Triggered | ✅ Req #62  | ✅ Req #62  |
| CB Exited    | ❌ NO       | ✅ Req #130 |
| Recovery R   | 76.8Ω stuck | **49.7Ω**   |

### 🔮 Predictive LOD — **Anticipatory Switching**

| Metric             | Value       |
| ------------------ | ----------- |
| Total LOD switches | 4           |
| Predictive         | **3** (75%) |
| Reactive           | 1           |
| Trend threshold    | 5%/tick     |

---

## 🚀 Running Tests

```bash
# Security (DDoS)
npx tsx lab/security/tarpit-server.ts
npx tsx lab/security/ddos-client.ts

# Fintech
npx tsx lab/fintech/fintech-server.ts
npx tsx lab/fintech/fintech-client.ts

# Flash Crowd
npx tsx lab/flash-crowd/stable-server.ts
npx tsx lab/flash-crowd/flash-client.ts

# Chaos
npx tsx lab/chaos/chaos-server.ts
npx tsx lab/chaos/guardian-client.ts

# Game LOD (Base)
npx tsx lab/game-lod/game-server.ts
npx tsx lab/game-lod/lod-controller.ts

# Game LOD V2 (Soft Degradation Fix)
npx tsx lab/game-lod-v2/game-server.ts
npx tsx lab/game-lod-v2/lod-controller.ts

# CB Recovery (Circuit Breaker Exit Test)
npx tsx lab/cb-recovery/cb-server.ts
npx tsx lab/cb-recovery/recovery-client.ts

# Predictive LOD (Trend-Based Anticipation)
npx tsx lab/predictive-lod/game-server.ts
npx tsx lab/predictive-lod/predictive-controller.ts
```
