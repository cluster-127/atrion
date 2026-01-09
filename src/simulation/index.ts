/**
 * Atrion Simulation Entry Point
 * Spike Test Demo
 */

import asciichart from 'asciichart'
import type {
  DeltaTime,
  NormalizedPressure,
  Ohms,
  PhysicsConfig,
  SLOConfig,
} from '../core/types.js'
import { runSimulation } from './runner.js'
import { Scenarios } from './scenarios.js'

// --- CONFIGURATION (MVS) ---
const MVS_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 0.1, // Slow recovery (to see Scar effect)
  scarFactor: 5, // Trauma weight
  dampingFactor: 20, // Strong momentum brake
  criticalPressure: 0.4 as NormalizedPressure,
  breakMultiplier: 10, // 10x Base = 100 Ohms -> Circuit Breaker
  bootstrapTicks: 5,
  minDeltaT: 100 as DeltaTime,
  tanhScale: 1.0,
}

const MVS_SLO: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01, // 1%
  criticality: { latency: 5, error: 10, saturation: 5 },
}

// --- SCENARIO: THE SPIKE ---
// Ticks 0-20: Normal
// Ticks 20-30: ERROR SPIKE (80% Error Rate)
// Ticks 30-60: Recovery
const spikeScenario = Scenarios.compose(
  Scenarios.sustained(50), // Latency: 50ms (Normal)
  Scenarios.spike(20, 30, 0.8, 0.0), // Error: Spike to 0.8
  Scenarios.sustained(0) // Saturation: 0
)

console.log('\n🚀 Atrion Physics Engine MVS - Starting Simulation...\n')

const observer = runSimulation({
  durationTicks: 60,
  config: MVS_CONFIG,
  slo: MVS_SLO,
  scenario: spikeScenario,
})

// --- VISUALIZATION ---
const sError = observer.getSeries('error')
const sResist = observer.getSeries('resistance')
const sMomentum = observer.getSeries('momentum')

console.log('RED: Error Input | GREEN: Resistance Output | BLUE: Momentum\n')

console.log(
  asciichart.plot([sError, sResist, sMomentum], {
    height: 15,
    colors: [
      asciichart.red, // Error
      asciichart.green, // Resistance
      asciichart.blue, // Momentum
    ],
  })
)

// --- STATS ---
const history = observer.getHistory()
const peakR = Math.max(...history.map((h) => h.output.resistance))
console.log('\n📊 Stats:')
console.log(`Peak Resistance: ${peakR.toFixed(2)} Ohms`)
console.log(`Final Resistance: ${history[history.length - 1].output.resistance.toFixed(2)} Ohms`)

console.log('\n✅ Simulation Complete.')
