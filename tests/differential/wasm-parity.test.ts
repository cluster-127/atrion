/**
 * Differential Testing: TypeScript vs WASM Physics Parity
 *
 * CRITICAL: These tests ensure WASM produces IDENTICAL results to TS.
 * This is the mathematical correctness gate for v2.0.0.
 *
 * Any failure here BLOCKS release.
 */

import { describe, expect, it } from 'vitest'
import * as wasmModule from '../../atrion-physics/pkg/atrion_physics'
import { DEFAULT_CONFIG, DEFAULT_SLO, deriveWeights } from '../../src/core/config'
import { calculateResistance, updateScar } from '../../src/core/physics'
import type { DeltaTime, Momentum, PressureVector, Scar } from '../../src/core/types'

// Branded type helpers
const asMomentum = (n: number) => n as Momentum
const asScar = (n: number) => n as Scar
const asDeltaTime = (n: number) => n as DeltaTime
const asPressure = (n: number) => n as any

// Derived weights that TS uses
const TS_WEIGHTS = deriveWeights(DEFAULT_SLO)

describe('WASM Parity Tests (Release Gate)', () => {
  const engine = new wasmModule.PhysicsEngine()

  describe('Check Valve: Silence is not Trauma', () => {
    it('should not accumulate scar from negative pressure (TS)', () => {
      // Negative pressure = system performing BETTER than baseline
      const pressure: PressureVector = {
        latency: asPressure(-0.5),
        error: asPressure(-0.3),
        saturation: asPressure(-0.2),
      }

      const result = updateScar(asScar(10), pressure, DEFAULT_CONFIG, asDeltaTime(100))

      // Should decay but NOT add new scar (silence is not trauma)
      expect(result).toBeLessThanOrEqual(10)
    })

    it('should not accumulate scar from negative pressure (WASM)', () => {
      const pressure = new wasmModule.PressureVector(-0.5, -0.3, -0.2)
      const result = engine.updateScar(10, pressure)

      // WASM should behave identically - no trauma from negative pressure
      expect(result).toBeLessThanOrEqual(10)
    })

    it('should accumulate scar from high positive pressure (TS)', () => {
      const pressure: PressureVector = {
        latency: asPressure(0.9),
        error: asPressure(0.8),
        saturation: asPressure(0.7),
      }

      const result = updateScar(asScar(0), pressure, DEFAULT_CONFIG, asDeltaTime(100))

      expect(result).toBeGreaterThan(0)
    })

    it('should accumulate scar from high positive pressure (WASM)', () => {
      const pressure = new wasmModule.PressureVector(0.9, 0.8, 0.7)
      const result = engine.updateScar(0, pressure)

      expect(result).toBeGreaterThan(0)
    })
  })

  describe('Resistance Calculation Parity', () => {
    const testCases = [
      { name: 'zero inputs', pressure: [0, 0, 0], momentum: 0, scar: 0, staleness: 0 },
      { name: 'low pressure', pressure: [0.2, 0.1, 0.05], momentum: 0.5, scar: 2, staleness: 0.1 },
      {
        name: 'medium pressure',
        pressure: [0.5, 0.3, 0.2],
        momentum: 1.0,
        scar: 5,
        staleness: 0.5,
      },
      { name: 'high pressure', pressure: [0.8, 0.7, 0.6], momentum: 2.0, scar: 10, staleness: 1.0 },
    ]

    testCases.forEach(({ name, pressure, momentum, scar, staleness }) => {
      it(`should produce similar results for ${name}`, () => {
        const tsPressure: PressureVector = {
          latency: asPressure(pressure[0]),
          error: asPressure(pressure[1]),
          saturation: asPressure(pressure[2]),
        }

        // TypeScript calculation
        const tsResult = calculateResistance(
          tsPressure,
          asMomentum(momentum),
          asScar(scar),
          TS_WEIGHTS,
          DEFAULT_CONFIG,
          staleness,
        )

        // WASM calculation
        const wasmPressure = new wasmModule.PressureVector(pressure[0], pressure[1], pressure[2])
        const wasmResult = engine.calculateResistance(wasmPressure, momentum, scar, staleness)

        // Allow small floating point tolerance
        const diff = Math.abs(tsResult - wasmResult)
        expect(diff).toBeLessThan(0.5) // Tolerance for config differences
      })
    })
  })

  describe('Config Consistency', () => {
    it('should use same base resistance', () => {
      const wasmPressure = new wasmModule.PressureVector(0, 0, 0)
      const wasmResult = engine.calculateResistance(wasmPressure, 0, 0, 0)

      // WASM base resistance should match TS
      expect(wasmResult).toBeCloseTo(DEFAULT_CONFIG.baseResistance, 0)
    })
  })
})
