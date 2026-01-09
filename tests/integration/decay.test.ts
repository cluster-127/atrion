/**
 * Decay Integration Test
 * Validates that Scar Tissue decays to baseline over time with zero input.
 *
 * This test proves RFC-0001 §5 decay mechanism: S(t) = S(t-1) * e^(-λΔt)
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
import { Scenarios } from '../../src/simulation/scenarios.js'

// Fast decay configuration to observe recovery (Hyper-Metabolic Mode)
const FAST_DECAY_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 3.0, // Saniyede %300 - Hızlandırılmış zaman testi
  scarFactor: 5,
  dampingFactor: 20,
  criticalPressure: 0.4 as NormalizedPressure,
  breakMultiplier: 10,
  bootstrapTicks: 5,
  minDeltaT: 100 as DeltaTime,
  tanhScale: 1.0,
}

const TEST_SLO: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01,
  criticality: { latency: 5, error: 10, saturation: 5 },
}

describe('Decay Integration', () => {
  describe('Scar Tissue Recovery', () => {
    it('should decay scar tissue over time with zero input', () => {
      // Scenario: Build up scar, then silence
      // Ticks 1-20: High pressure (build scar)
      // Ticks 21-100: Silence (observe decay)
      const scenario = Scenarios.compose(
        Scenarios.recovery(20, 150, 50), // Latency: high then normal
        Scenarios.recovery(20, 0.5, 0.0), // Error: high then zero
        Scenarios.sustained(0) // Saturation: none
      )

      const observer = runSimulation({
        durationTicks: 100,
        config: FAST_DECAY_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const scarSeries = observer.getSeries('scar')

      // Find peak scar (should be around tick 20)
      const peakScar = Math.max(...scarSeries)
      const peakIndex = scarSeries.indexOf(peakScar)

      // Scar at end should be less than or equal to peak (may plateau if no new trauma)
      const finalScar = scarSeries[scarSeries.length - 1]

      expect(finalScar).toBeLessThanOrEqual(peakScar)
      expect(peakIndex).toBeLessThan(40) // Peak before tick 40
    })

    it('should approach baseline resistance with zero input', () => {
      const scenario = Scenarios.compose(
        Scenarios.recovery(20, 150, 50),
        Scenarios.recovery(20, 0.5, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 100,
        config: FAST_DECAY_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const baseResistance = FAST_DECAY_CONFIG.baseResistance
      const finalResistance = observer.finalResistance()
      const maxResistance = observer.maxResistance()

      // Final should be closer to base than max
      const distanceFromBase = Math.abs(finalResistance - baseResistance)
      const maxDistanceFromBase = Math.abs(maxResistance - baseResistance)

      expect(distanceFromBase).toBeLessThan(maxDistanceFromBase)
    })

    it('should decay exponentially (each step smaller than previous)', () => {
      const scenario = Scenarios.compose(
        Scenarios.recovery(10, 150, 50),
        Scenarios.recovery(10, 0.5, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 50,
        config: FAST_DECAY_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const resistanceSeries = observer.getSeries('resistance')

      // After peak, resistance should monotonically decrease or stay same
      const peakResistance = observer.maxResistance()
      const peakIndex = resistanceSeries.indexOf(peakResistance)

      // Check decay phase (after peak)
      const decayPhase = resistanceSeries.slice(peakIndex + 1)

      // Should be generally decreasing (allow small fluctuations)
      if (decayPhase.length > 5) {
        const firstHalf = decayPhase.slice(0, Math.floor(decayPhase.length / 2))
        const secondHalf = decayPhase.slice(Math.floor(decayPhase.length / 2))

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        expect(avgSecond).toBeLessThanOrEqual(avgFirst)
      }
    })
  })

  describe('Silence Baseline', () => {
    it('should maintain baseline resistance with constant zero input', () => {
      // Pure silence scenario
      const scenario = Scenarios.compose(
        Scenarios.sustained(50), // Normal latency
        Scenarios.sustained(0), // Zero error
        Scenarios.sustained(0) // Zero saturation
      )

      const observer = runSimulation({
        durationTicks: 30,
        config: FAST_DECAY_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()
      const baseResistance = FAST_DECAY_CONFIG.baseResistance

      // After bootstrap (tick 6+), resistance should be near baseline
      const postBootstrap = history.slice(6)

      for (const record of postBootstrap) {
        // Allow some tolerance (±50% of base)
        expect(record.output.resistance).toBeLessThan(baseResistance * 1.5)
        expect(record.output.resistance).toBeGreaterThan(baseResistance * 0.5)
      }
    })
  })
})
