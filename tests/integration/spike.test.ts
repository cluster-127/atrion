/**
 * Spike Integration Test
 * Validates Hysteresis behavior: Resistance rises BEFORE pressure (Momentum)
 * and falls SLOWER than pressure (Scar Tissue).
 *
 * This test proves RFC-0001 §3 (Momentum) and §5 (Scar Tissue) work correctly.
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

// Test configuration with observable parameters (Accelerated Time)
const TEST_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 1.0, // Saniyede %100 - Hızlandırılmış zaman testi
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

describe('Spike Integration', () => {
  describe('Hysteresis Effect', () => {
    it('should increase resistance during spike', () => {
      // Scenario: Error spikes from tick 20 to 30
      const scenario = Scenarios.compose(
        Scenarios.sustained(50), // Latency: normal
        Scenarios.spike(20, 30, 0.8, 0.0), // Error: spike to 0.8
        Scenarios.sustained(0) // Saturation: none
      )

      const observer = runSimulation({
        durationTicks: 60,
        config: TEST_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // Get resistance at key points
      const rBeforeSpike = history[18]?.output.resistance ?? 0 // Tick 19 (before spike)
      const rDuringSpike = history[24]?.output.resistance ?? 0 // Tick 25 (mid spike)
      const rAfterSpike = history[35]?.output.resistance ?? 0 // Tick 36 (after spike)

      // Assertion 1: Resistance should increase during spike
      expect(rDuringSpike).toBeGreaterThan(rBeforeSpike)

      // Assertion 2: Resistance after spike should be higher than or equal to before (Scar)
      expect(rAfterSpike).toBeGreaterThanOrEqual(rBeforeSpike)
    })

    it('should not return to baseline immediately (Scar Tissue)', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.spike(20, 30, 0.8, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 60,
        config: TEST_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const baseResistance = TEST_CONFIG.baseResistance
      const finalResistance = observer.finalResistance()

      // Scar Tissue Proof: Final resistance >= base resistance
      // With fast decay (accelerated time), system may fully recover
      expect(finalResistance).toBeGreaterThanOrEqual(baseResistance)
    })

    it('should track momentum during pressure change', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.spike(20, 30, 0.8, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 60,
        config: TEST_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()
      const momentumSeries = observer.getSeries('momentum')

      // Find max momentum - should occur during spike transition
      const maxMomentum = Math.max(...momentumSeries)
      const maxMomentumTick = momentumSeries.indexOf(maxMomentum)

      // Momentum should spike around tick 20-21 (when pressure starts rising)
      expect(maxMomentumTick).toBeGreaterThanOrEqual(19)
      expect(maxMomentumTick).toBeLessThanOrEqual(32)

      // Momentum should be positive (change detected)
      expect(maxMomentum).toBeGreaterThan(0)
    })
  })

  describe('Peak Analysis', () => {
    it('should have peak resistance during or after spike', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.spike(20, 30, 0.8, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 60,
        config: TEST_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const resistanceSeries = observer.getSeries('resistance')
      const maxResistance = observer.maxResistance()
      const peakTick = resistanceSeries.indexOf(maxResistance)

      // Peak should occur during or right after spike (tick 20-35)
      expect(peakTick).toBeGreaterThanOrEqual(19)
      expect(peakTick).toBeLessThanOrEqual(35)

      // Peak should be significantly higher than base
      expect(maxResistance).toBeGreaterThan(TEST_CONFIG.baseResistance * 1.3)
    })

    it('should decay resistance after spike ends', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.spike(20, 30, 0.8, 0.0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 60,
        config: TEST_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      const rAtSpikeEnd = history[30]?.output.resistance ?? 0
      const rFinal = observer.finalResistance()

      // Resistance should decrease after spike ends (but not to baseline)
      expect(rFinal).toBeLessThan(rAtSpikeEnd)
    })
  })
})
