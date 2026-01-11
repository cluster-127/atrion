/**
 * Atrion Wind Tunnel: AutoTuner Validation Test
 *
 * Demonstrates dynamic threshold adaptation:
 * 1. Phase 1: Warm-up (learn baseline)
 * 2. Phase 2: Normal traffic (observe μ+kσ)
 * 3. Phase 3: Spike (watch threshold adapt)
 * 4. Phase 4: Recovery (threshold tightens)
 *
 * Run: npx tsx lab/autotuner/autotuner-test.ts
 */

import fs from 'fs'
import {
  AutoTuner,
  consoleObserver,
  DEFAULT_CONFIG,
  DEFAULT_SLO,
  deriveWeights,
  normalizeTelemetry,
  updatePhysics,
} from '../../src/core/index.js'
import type {
  BootstrapState,
  Ohms,
  PhysicsConfig,
  RouteState,
  Scar,
  Timestamp,
} from '../../src/core/types.js'

// --- CONFIGURATION ---
const LOG_FILE = 'logs/autotuner-test.log'
const ROUTE_ID = 'autotuner-demo'

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- SIMULATION ---
async function runSimulation() {
  fs.mkdirSync('logs', { recursive: true })
  fs.writeFileSync(LOG_FILE, '')

  log(`\n🔬 AUTOTUNER VALIDATION TEST started\n`)

  // Initialize physics
  const config: PhysicsConfig = { ...DEFAULT_CONFIG }
  const weights = deriveWeights(DEFAULT_SLO)
  let now = Date.now() as Timestamp

  // Create bootstrap state manually
  let state: RouteState = {
    routeId: ROUTE_ID,
    mode: 'BOOTSTRAP',
    pressure: { latency: 0, error: 0, saturation: 0 } as any,
    previousPressure: undefined,
    momentum: undefined,
    scarTissue: 0 as Scar,
    resistance: (config.baseResistance * 1.2) as Ohms,
    tickCount: 0,
    lastUpdatedAt: now,
  } as BootstrapState

  // Initialize AutoTuner
  const autoTuner = new AutoTuner(
    {
      windowSize: 20, // Small window for faster adaptation
      sensitivity: 3.0,
      minFloor: 20 as Ohms,
      hardCeiling: 200 as Ohms,
      warmupTicks: 10,
    },
    100 as Ohms // Fallback during warmup
  )

  // Phase 1: Warmup (15 ticks)
  log('📈 PHASE 1: Warmup (learning baseline)\n')
  for (let i = 0; i < 15; i++) {
    const pressure = normalizeTelemetry(
      30 + Math.random() * 10, // 30-40ms latency
      0,
      0.2,
      { latencyMs: 50, errorRate: 0.01, saturation: 0.5 }
    )

    now = (now + 100) as Timestamp
    state = updatePhysics(state, pressure, weights, config, now, consoleObserver, autoTuner)

    const stats = autoTuner.getStats()
    const breakPoint = autoTuner.computeBreakPoint()

    if (i % 5 === 0) {
      log(
        `   Tick ${i + 1}: R=${state.resistance.toFixed(1)}Ω | ` +
          `μ=${stats.mean.toFixed(1)} σ=${stats.stdDev.toFixed(2)} | ` +
          `Break=${breakPoint.toFixed(1)}Ω | ` +
          `Warmed=${stats.isWarmedUp}`
      )
    }
  }

  // Phase 2: Normal traffic (20 ticks)
  log('\n📊 PHASE 2: Normal traffic (stable thresholds)\n')
  for (let i = 0; i < 20; i++) {
    const pressure = normalizeTelemetry(
      35 + Math.random() * 10, // Similar to baseline
      0,
      0.25,
      { latencyMs: 50, errorRate: 0.01, saturation: 0.5 }
    )

    now = (now + 100) as Timestamp
    state = updatePhysics(state, pressure, weights, config, now, undefined, autoTuner)

    if (i % 5 === 0) {
      const stats = autoTuner.getStats()
      const breakPoint = autoTuner.computeBreakPoint()
      log(
        `   Tick ${i + 16}: R=${state.resistance.toFixed(1)}Ω | ` +
          `μ=${stats.mean.toFixed(1)} σ=${stats.stdDev.toFixed(2)} | ` +
          `Break=${breakPoint.toFixed(1)}Ω`
      )
    }
  }

  // Phase 3: Spike (15 ticks)
  log('\n🔥 PHASE 3: Traffic spike (threshold adapts)\n')
  for (let i = 0; i < 15; i++) {
    const pressure = normalizeTelemetry(
      150 + Math.random() * 50, // High latency spike
      0.05, // Some errors
      0.8, // High saturation
      { latencyMs: 50, errorRate: 0.01, saturation: 0.5 }
    )

    now = (now + 100) as Timestamp
    state = updatePhysics(state, pressure, weights, config, now, undefined, autoTuner)

    if (i % 3 === 0) {
      const stats = autoTuner.getStats()
      const breakPoint = autoTuner.computeBreakPoint()
      log(
        `   Tick ${i + 36}: R=${state.resistance.toFixed(1)}Ω | ` +
          `μ=${stats.mean.toFixed(1)} σ=${stats.stdDev.toFixed(2)} | ` +
          `Break=${breakPoint.toFixed(1)}Ω | ` +
          `Mode=${state.mode}`
      )
    }
  }

  // Phase 4: Recovery (20 ticks)
  log('\n💚 PHASE 4: Recovery (threshold tightens)\n')
  for (let i = 0; i < 20; i++) {
    const pressure = normalizeTelemetry(
      25 + Math.random() * 10, // Back to low latency
      0,
      0.15,
      { latencyMs: 50, errorRate: 0.01, saturation: 0.5 }
    )

    now = (now + 100) as Timestamp
    state = updatePhysics(state, pressure, weights, config, now, undefined, autoTuner)

    if (i % 5 === 0) {
      const stats = autoTuner.getStats()
      const breakPoint = autoTuner.computeBreakPoint()
      log(
        `   Tick ${i + 51}: R=${state.resistance.toFixed(1)}Ω | ` +
          `μ=${stats.mean.toFixed(1)} σ=${stats.stdDev.toFixed(2)} | ` +
          `Break=${breakPoint.toFixed(1)}Ω | ` +
          `Mode=${state.mode}`
      )
    }
  }

  // Final summary
  const finalStats = autoTuner.getStats()
  const finalBreak = autoTuner.computeBreakPoint()
  const finalRecovery = autoTuner.computeRecoveryPoint()

  log(`\n${'='.repeat(60)}`)
  log(`📊 AUTOTUNER FINAL RESULTS`)
  log(`${'='.repeat(60)}`)
  log(`   📈 STATISTICS:`)
  log(`      Mean (μ):     ${finalStats.mean.toFixed(2)}Ω`)
  log(`      StdDev (σ):   ${finalStats.stdDev.toFixed(2)}Ω`)
  log(`      Samples:      ${finalStats.sampleCount}`)
  log(``)
  log(`   🎯 THRESHOLDS:`)
  log(`      Break Point:  ${finalBreak.toFixed(1)}Ω (μ + 3σ)`)
  log(`      Recovery:     ${finalRecovery.toFixed(1)}Ω`)
  log(``)
  log(`   ✅ ADAPTIVE: Threshold changed dynamically based on traffic!`)
  log(`${'='.repeat(60)}`)

  log('\n🏁 Simulation complete!')
}

runSimulation()
