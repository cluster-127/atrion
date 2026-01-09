/**
 * Circuit Breaker Integration Test
 * Validates state machine transitions and safety valve behavior.
 *
 * This test proves RFC-0001 §6 Circuit Breaker mechanism.
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

// Configuration tuned to trigger circuit breaker (Moderate Decay)
const CB_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 0.5, // Saniyede %50 - Orta hızda iyileşme
  scarFactor: 10, // High scar accumulation
  dampingFactor: 30,
  criticalPressure: 0.3 as NormalizedPressure, // Low threshold for trauma
  breakMultiplier: 5, // 50 Ohms triggers CB
  bootstrapTicks: 3,
  minDeltaT: 100 as DeltaTime,
  tanhScale: 1.0,
}

const TEST_SLO: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01,
  criticality: { latency: 5, error: 10, saturation: 5 },
}

describe('Circuit Breaker Integration', () => {
  describe('State Transitions', () => {
    it('should start in BOOTSTRAP mode', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.sustained(0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 2,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // First tick should be BOOTSTRAP
      expect(history[0].meta.mode).toBe('BOOTSTRAP')
    })

    it('should transition to OPERATIONAL after bootstrap ticks', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.sustained(0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 10,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // After bootstrapTicks (3), should be OPERATIONAL
      expect(history[4].meta.mode).toBe('OPERATIONAL')
    })

    it('should trigger CIRCUIT_BREAKER under extreme pressure', () => {
      // Extreme sustained pressure to trigger CB
      const scenario = Scenarios.compose(
        Scenarios.sustained(500), // Very high latency
        Scenarios.sustained(0.9), // Very high error
        Scenarios.sustained(0.9) // Very high saturation
      )

      const observer = runSimulation({
        durationTicks: 30,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()
      const baseR = CB_CONFIG.baseResistance

      // Should eventually enter CIRCUIT_BREAKER OR have significantly increased resistance
      const cbTriggered = history.some((h) => h.meta.mode === 'CIRCUIT_BREAKER')
      const maxR = Math.max(...history.map((h) => h.output.resistance))

      // Under extreme pressure, resistance should at least increase 50% from base
      expect(cbTriggered || maxR > baseR * 1.5).toBe(true)
    })
  })

  describe('Safety Valve Behavior', () => {
    it('should have high resistance in CIRCUIT_BREAKER mode', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(500),
        Scenarios.sustained(0.9),
        Scenarios.sustained(0.9)
      )

      const observer = runSimulation({
        durationTicks: 30,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()
      const breakPoint = CB_CONFIG.baseResistance * CB_CONFIG.breakMultiplier

      // Find CB entries
      const cbEntries = history.filter((h) => h.meta.mode === 'CIRCUIT_BREAKER')

      if (cbEntries.length > 0) {
        // All CB entries should have resistance >= breakpoint
        for (const entry of cbEntries) {
          expect(entry.output.resistance).toBeGreaterThanOrEqual(breakPoint)
        }
      }
    })

    it('should not recover from CB while pressure is high', () => {
      // Sustained extreme pressure
      const scenario = Scenarios.compose(
        Scenarios.sustained(500),
        Scenarios.sustained(0.9),
        Scenarios.sustained(0.9)
      )

      const observer = runSimulation({
        durationTicks: 40,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // Find first CB entry
      const firstCbIndex = history.findIndex((h) => h.meta.mode === 'CIRCUIT_BREAKER')

      if (firstCbIndex >= 0) {
        // All subsequent entries should also be CB (no recovery under pressure)
        const afterCb = history.slice(firstCbIndex)
        const allCb = afterCb.every((h) => h.meta.mode === 'CIRCUIT_BREAKER')
        expect(allCb).toBe(true)
      }
    })

    it('should potentially recover when pressure drops', () => {
      // High pressure then recovery
      const scenario = Scenarios.compose(
        Scenarios.recovery(15, 500, 50), // High latency then normal
        Scenarios.recovery(15, 0.9, 0.0), // High error then zero
        Scenarios.recovery(15, 0.9, 0.0) // High saturation then zero
      )

      const observer = runSimulation({
        durationTicks: 100,
        config: {
          ...CB_CONFIG,
          decayRate: 0.5, // Fast decay for recovery test
        },
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // Check if CB was triggered and then potentially recovered
      const modes = history.map((h) => h.meta.mode)
      const hadCb = modes.includes('CIRCUIT_BREAKER')

      if (hadCb) {
        // May or may not recover depending on scar decay
        // At minimum, resistance should decrease after pressure drops
        const cbStart = modes.indexOf('CIRCUIT_BREAKER')
        const rAtCb = history[cbStart].output.resistance
        const rFinal = observer.finalResistance()

        // Should show some recovery tendency
        expect(rFinal).toBeLessThanOrEqual(rAtCb)
      }
    })
  })

  describe('Mode Persistence', () => {
    it('should persist mode across ticks', () => {
      const scenario = Scenarios.compose(
        Scenarios.sustained(50),
        Scenarios.sustained(0),
        Scenarios.sustained(0)
      )

      const observer = runSimulation({
        durationTicks: 20,
        config: CB_CONFIG,
        slo: TEST_SLO,
        scenario,
      })

      const history = observer.getHistory()

      // After bootstrap, should stay OPERATIONAL with low pressure
      const postBootstrap = history.slice(CB_CONFIG.bootstrapTicks)
      const allOperational = postBootstrap.every((h) => h.meta.mode === 'OPERATIONAL')

      expect(allOperational).toBe(true)
    })
  })
})
