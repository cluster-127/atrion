/**
 * Atrion Wind Tunnel: Circuit Breaker Recovery Server
 *
 * Simulates a service that goes under heavy load, triggers circuit breaker,
 * then gradually recovers. Used to test CB exit via half-open mechanism.
 *
 * Phases:
 * 1. Normal operation (low latency)
 * 2. Spike (high latency, errors)
 * 3. Recovery (gradual latency reduction)
 *
 * Run: npx tsx lab/cb-recovery/cb-server.ts
 */

import expressModule from 'express'

const express = (expressModule as any).default ?? expressModule
const app = express()
app.use(express.json())

const PORT = 3007

// --- SERVER STATE ---
type ServerPhase = 'NORMAL' | 'SPIKE' | 'RECOVERY'

const state = {
  phase: 'NORMAL' as ServerPhase,
  requestCount: 0,
  recoveryProgress: 0, // 0-100%
  errorRate: 0, // Current error rate
  baseLatency: 20, // Current base latency
}

// Phase configurations
const PHASE_CONFIG = {
  NORMAL: { baseLatency: 20, errorRate: 0.02 },
  SPIKE: { baseLatency: 500, errorRate: 0.5 },
  RECOVERY: { baseLatency: 20, errorRate: 0.02 }, // Target values
}

// --- SET PHASE ENDPOINT ---
app.post('/phase', (req: any, res: any) => {
  const { phase } = req.body
  if (!['NORMAL', 'SPIKE', 'RECOVERY'].includes(phase)) {
    return res.status(400).json({ error: 'Invalid phase' })
  }

  const oldPhase = state.phase
  state.phase = phase

  if (phase === 'SPIKE') {
    state.baseLatency = PHASE_CONFIG.SPIKE.baseLatency
    state.errorRate = PHASE_CONFIG.SPIKE.errorRate
    state.recoveryProgress = 0
  } else if (phase === 'RECOVERY') {
    state.recoveryProgress = 0
    // Will gradually recover to normal
  } else if (phase === 'NORMAL') {
    state.baseLatency = PHASE_CONFIG.NORMAL.baseLatency
    state.errorRate = PHASE_CONFIG.NORMAL.errorRate
    state.recoveryProgress = 100
  }

  console.log(`🔄 Phase changed: ${oldPhase} → ${phase}`)

  res.json({
    phase: state.phase,
    baseLatency: state.baseLatency,
    errorRate: state.errorRate,
    recoveryProgress: state.recoveryProgress,
  })
})

// --- REQUEST ENDPOINT ---
app.post('/request', async (req: any, res: any) => {
  state.requestCount++

  // In RECOVERY phase, gradually improve metrics
  if (state.phase === 'RECOVERY' && state.recoveryProgress < 100) {
    state.recoveryProgress += 5 // 5% improvement per request

    // Interpolate between SPIKE and NORMAL values
    const progress = state.recoveryProgress / 100
    state.baseLatency = Math.round(
      PHASE_CONFIG.SPIKE.baseLatency * (1 - progress) + PHASE_CONFIG.NORMAL.baseLatency * progress
    )
    state.errorRate =
      PHASE_CONFIG.SPIKE.errorRate * (1 - progress) + PHASE_CONFIG.NORMAL.errorRate * progress
  }

  // Simulate latency
  const jitter = Math.random() * 20 - 10 // ±10ms
  const actualLatency = Math.max(5, state.baseLatency + jitter)
  await new Promise((r) => setTimeout(r, actualLatency))

  // Simulate errors
  const isError = Math.random() < state.errorRate
  if (isError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      phase: state.phase,
      recoveryProgress: state.recoveryProgress,
    })
  }

  res.json({
    requestId: state.requestCount,
    phase: state.phase,
    latency: Math.round(actualLatency),
    recoveryProgress: state.recoveryProgress,
    isHealthy: state.recoveryProgress >= 80,
  })
})

// --- HEALTH CHECK (for half-open probes) ---
app.get('/health', (_req: any, res: any) => {
  const isHealthy = state.phase === 'NORMAL' || state.recoveryProgress >= 80

  if (isHealthy) {
    res.json({
      status: 'healthy',
      phase: state.phase,
      recoveryProgress: state.recoveryProgress,
    })
  } else {
    res.status(503).json({
      status: 'degraded',
      phase: state.phase,
      recoveryProgress: state.recoveryProgress,
    })
  }
})

// --- STATS ---
app.get('/stats', (_req: any, res: any) => {
  res.json({
    phase: state.phase,
    requestCount: state.requestCount,
    recoveryProgress: state.recoveryProgress + '%',
    currentLatency: state.baseLatency + 'ms',
    errorRate: (state.errorRate * 100).toFixed(1) + '%',
  })
})

// --- RESET ---
app.post('/reset', (_req: any, res: any) => {
  state.phase = 'NORMAL'
  state.requestCount = 0
  state.recoveryProgress = 100
  state.baseLatency = PHASE_CONFIG.NORMAL.baseLatency
  state.errorRate = PHASE_CONFIG.NORMAL.errorRate
  res.json({ status: 'reset' })
})

app.listen(PORT, () => {
  console.log(`\n🔌 CB RECOVERY SERVER running on port ${PORT}`)
  console.log(`   ├─ Request: POST http://localhost:${PORT}/request`)
  console.log(`   ├─ Phase:   POST http://localhost:${PORT}/phase`)
  console.log(`   ├─ Health:  GET  http://localhost:${PORT}/health`)
  console.log(`   ├─ Stats:   GET  http://localhost:${PORT}/stats`)
  console.log(`   └─ Mode:    Circuit Breaker Recovery Testing\n`)
})
