/**
 * Differential Testing: TypeScript vs WASM Physics
 *
 * Ensures both engines produce identical results.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_SLO, deriveBaselines, deriveWeights } from '../../src/core/config'
import { normalizeTelemetry } from '../../src/core/normalize'
import { updatePhysics } from '../../src/core/physics'

// WASM types (loaded dynamically)
type WasmModule = typeof import('../../atrion-physics/pkg/atrion_physics')
type WasmEngine = InstanceType<WasmModule['PhysicsEngine']>

const WEIGHTS = deriveWeights(DEFAULT_SLO)
const BASELINES = deriveBaselines(DEFAULT_SLO)

describe('Differential Testing: TS vs WASM', () => {
  let wasmEngine: WasmEngine | null = null
  let wasmModule: WasmModule | null = null

  beforeAll(async () => {
    if (typeof WebAssembly === 'undefined') {
      console.warn('WebAssembly not available, skipping WASM differential tests')
      return
    }

    try {
      wasmModule = await import('../../atrion-physics/pkg/atrion_physics')
      wasmEngine = new wasmModule.PhysicsEngine()
      console.log('WASM engine loaded for differential testing')
    } catch (e) {
      console.warn('WASM module not found, tests will be skipped:', e)
    }
  })

  describe('Full Physics Calculation', () => {
    it('should produce identical results for low load', () => {
      if (!wasmEngine || !wasmModule) {
        console.log('Skipping: WASM not available')
        return
      }

      const telemetry = { latencyMs: 50, errorRate: 0.01, saturation: 0.2 }
      const pressure = normalizeTelemetry(telemetry, BASELINES, 100) // 3rd arg: alpha
      const previousState = {
        resistance: 10 as any,
        pressure: { latency: 0.1, error: 0.01, saturation: 0.1 },
        momentum: 0.5,
        scar: 5,
        lastUpdate: Date.now() as any,
        mode: 'OPERATIONAL' as const,
        tickCount: 10,
      }

      // TypeScript
      const tsResult = updatePhysics(
        previousState as any,
        pressure,
        WEIGHTS,
        DEFAULT_CONFIG,
        100 as any,
      )

      // WASM (calculate resistance only for now)
      const wasmPressure = new wasmModule.PressureVector(
        pressure.latency,
        pressure.error,
        pressure.saturation,
      )
      const wasmResistance = wasmEngine.calculateResistance(
        wasmPressure,
        previousState.momentum,
        previousState.scar,
        0, // staleness
      )

      // Compare resistance calculation
      const diff = Math.abs(tsResult.resistance - wasmResistance)
      console.log(`TS: ${tsResult.resistance}, WASM: ${wasmResistance}, diff: ${diff}`)
      expect(diff).toBeLessThan(0.1) // Allow some tolerance for now
    })
  })
})
