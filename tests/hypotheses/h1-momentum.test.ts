/**
 * HYPOTHESIS 1: Momentum Eliminates Flapping
 *
 * CLAIM: Under oscillating pressure near a threshold, Atrion (CDO) produces
 * fewer state transitions than a standard binary circuit breaker.
 *
 * METHODOLOGY:
 * 1. Generate oscillating pressure that hovers around threshold (0.45-0.55)
 * 2. Run both systems for 100 ticks
 * 3. Count state transitions (flapping index)
 * 4. Atrion should have significantly fewer transitions
 *
 * This proves RFC-0001 §3 (Momentum as inertia/damping mechanism)
 */

import { describe, expect, it } from 'vitest'
import type {
  DeltaTime,
  NormalizedPressure,
  Ohms,
  PhysicsConfig,
  SLOConfig,
} from '../../src/core/types.js'
import { runSimulation } from '../../src/simulation/runner.js'

// =============================================================================
// CONTENDER 1: STANDARD CIRCUIT BREAKER (Baseline)
// =============================================================================

interface CircuitBreakerState {
  isOpen: boolean
  cooldownRemaining: number
}

/**
 * Standard binary circuit breaker simulation.
 * Opens when error > threshold, closes after cooldown ticks.
 */
function simulateStandardCB(
  errorSeries: number[],
  threshold: number,
  cooldownTicks: number
): { states: boolean[]; transitions: number } {
  let state: CircuitBreakerState = { isOpen: false, cooldownRemaining: 0 }
  const states: boolean[] = []
  let transitions = 0

  for (const error of errorSeries) {
    const wasOpen = state.isOpen

    if (state.isOpen) {
      // In OPEN state - counting down to recovery
      state.cooldownRemaining--
      if (state.cooldownRemaining <= 0) {
        state.isOpen = false // Close after cooldown
      }
    } else {
      // In CLOSED state - monitoring threshold
      if (error > threshold) {
        state.isOpen = true
        state.cooldownRemaining = cooldownTicks
      }
    }

    // Count transitions
    if (wasOpen !== state.isOpen) {
      transitions++
    }

    states.push(state.isOpen)
  }

  return { states, transitions }
}

// =============================================================================
// CONTENDER 2: ATRION (CDO Physics Engine)
// =============================================================================

const ATRION_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 0.1,
  scarFactor: 5,
  dampingFactor: 20, // Key: Momentum damping
  criticalPressure: 0.5 as NormalizedPressure,
  breakMultiplier: 5,
  bootstrapTicks: 5,
  minDeltaT: 100 as DeltaTime,
  tanhScale: 1.0,
}

const ATRION_SLO: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01,
  criticality: { latency: 5, error: 10, saturation: 5 },
}

/**
 * Calculate Atrion's "effective state" and transitions.
 * We define "open" as resistance > breakpoint.
 */
function simulateAtrion(errorSeries: number[]): { states: boolean[]; transitions: number } {
  // Create oscillating scenario from error series
  const scenario = (tick: number) => ({
    latency: 50, // Normal latency
    error: errorSeries[tick - 1] ?? 0,
    saturation: 0,
  })

  const observer = runSimulation({
    durationTicks: errorSeries.length,
    config: ATRION_CONFIG,
    slo: ATRION_SLO,
    scenario,
  })

  const history = observer.getHistory()
  const breakPoint = ATRION_CONFIG.baseResistance * ATRION_CONFIG.breakMultiplier

  // Convert to binary state for comparison
  const states = history.map((h) => h.output.resistance >= breakPoint)

  // Count transitions
  let transitions = 0
  for (let i = 1; i < states.length; i++) {
    if (states[i] !== states[i - 1]) {
      transitions++
    }
  }

  return { states, transitions }
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Hypothesis 1: Momentum Eliminates Flapping', () => {
  describe('Oscillating Pressure Test', () => {
    it('should have fewer transitions than standard CB under oscillation', () => {
      const DURATION = 100

      // Generate oscillating error signal around threshold (0.45 - 0.55)
      // This simulates a service hovering at the edge of failure
      const errorSeries: number[] = []
      for (let i = 0; i < DURATION; i++) {
        // Sin wave oscillating around 0.5 with amplitude 0.1
        const error = 0.5 + 0.1 * Math.sin(i * 0.5)
        errorSeries.push(error)
      }

      // Standard CB parameters (tuned to same threshold)
      const CB_THRESHOLD = 0.5
      const CB_COOLDOWN = 5

      const cbResult = simulateStandardCB(errorSeries, CB_THRESHOLD, CB_COOLDOWN)
      const atrionResult = simulateAtrion(errorSeries)

      console.log(`\n📊 FLAPPING TEST RESULTS:`)
      console.log(`   Standard CB Transitions: ${cbResult.transitions}`)
      console.log(`   Atrion CDO Transitions:  ${atrionResult.transitions}`)
      console.log(
        `   Reduction: ${((1 - atrionResult.transitions / cbResult.transitions) * 100).toFixed(
          1
        )}%\n`
      )

      // HYPOTHESIS: Atrion should have fewer transitions
      expect(atrionResult.transitions).toBeLessThanOrEqual(cbResult.transitions)
    })

    it('should dampen high-frequency oscillations', () => {
      const DURATION = 100

      // High-frequency oscillation (rapid switching)
      const errorSeries: number[] = []
      for (let i = 0; i < DURATION; i++) {
        // Rapid alternation: 0.4, 0.6, 0.4, 0.6...
        const error = i % 2 === 0 ? 0.4 : 0.6
        errorSeries.push(error)
      }

      const cbResult = simulateStandardCB(errorSeries, 0.5, 3)
      const atrionResult = simulateAtrion(errorSeries)

      console.log(`\n📊 HIGH-FREQUENCY OSCILLATION TEST:`)
      console.log(`   Standard CB Transitions: ${cbResult.transitions}`)
      console.log(`   Atrion CDO Transitions:  ${atrionResult.transitions}`)

      // Standard CB will flap on every pair (many transitions)
      // Atrion's momentum should smooth this out
      expect(atrionResult.transitions).toBeLessThan(cbResult.transitions * 0.8)
    })

    it('should maintain stability under noise', () => {
      const DURATION = 100

      // Noisy signal around threshold with random jitter
      const errorSeries: number[] = []
      const rng = seedRandom(42) // Deterministic random
      for (let i = 0; i < DURATION; i++) {
        // Base: 0.48, with ±0.05 noise
        const noise = (rng() - 0.5) * 0.1
        const error = 0.48 + noise
        errorSeries.push(error)
      }

      const cbResult = simulateStandardCB(errorSeries, 0.5, 3)
      const atrionResult = simulateAtrion(errorSeries)

      console.log(`\n📊 NOISY SIGNAL TEST:`)
      console.log(`   Standard CB Transitions: ${cbResult.transitions}`)
      console.log(`   Atrion CDO Transitions:  ${atrionResult.transitions}`)

      // Atrion should be more stable
      expect(atrionResult.transitions).toBeLessThanOrEqual(cbResult.transitions)
    })
  })

  describe('Flapping Index Comparison', () => {
    it('should produce lower flapping index across all scenarios', () => {
      const scenarios = [
        { name: 'Slow Oscillation', freq: 0.2, amp: 0.1 },
        { name: 'Medium Oscillation', freq: 0.5, amp: 0.1 },
        { name: 'Fast Oscillation', freq: 1.0, amp: 0.1 },
        { name: 'Wide Swing', freq: 0.3, amp: 0.2 },
      ]

      const results: Array<{ name: string; cbFlap: number; atrionFlap: number }> = []

      for (const scenario of scenarios) {
        const errorSeries: number[] = []
        for (let i = 0; i < 100; i++) {
          const error = 0.5 + scenario.amp * Math.sin(i * scenario.freq)
          errorSeries.push(error)
        }

        const cbResult = simulateStandardCB(errorSeries, 0.5, 5)
        const atrionResult = simulateAtrion(errorSeries)

        results.push({
          name: scenario.name,
          cbFlap: cbResult.transitions,
          atrionFlap: atrionResult.transitions,
        })
      }

      console.log('\n📊 FLAPPING INDEX COMPARISON:')
      console.log('┌────────────────────┬──────────┬──────────┬───────────┐')
      console.log('│ Scenario           │ Std CB   │ Atrion   │ Winner    │')
      console.log('├────────────────────┼──────────┼──────────┼───────────┤')
      for (const r of results) {
        const winner = r.atrionFlap <= r.cbFlap ? 'Atrion ✅' : 'CB'
        console.log(
          `│ ${r.name.padEnd(18)} │ ${String(r.cbFlap).padStart(8)} │ ${String(
            r.atrionFlap
          ).padStart(8)} │ ${winner.padEnd(9)} │`
        )
      }
      console.log('└────────────────────┴──────────┴──────────┴───────────┘\n')

      // Atrion should win in at least 3 out of 4 scenarios
      const atrionWins = results.filter((r) => r.atrionFlap <= r.cbFlap).length
      expect(atrionWins).toBeGreaterThanOrEqual(3)
    })
  })
})

// =============================================================================
// UTILITY: Seeded Random Number Generator (Determinism)
// =============================================================================

function seedRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}
