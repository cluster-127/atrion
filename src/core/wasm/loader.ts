/**
 * WASM Physics Engine Loader
 *
 * Loads and initializes the Rust/WASM physics engine.
 * Uses static import for Node.js compatibility.
 */

import type { PhysicsConfig, SensitivityWeights } from '../types.js'

// Static import of WASM module (nodejs target)
import * as wasmModule from '../../../atrion-physics/pkg/atrion_physics.js'

type PhysicsEngine = InstanceType<typeof wasmModule.PhysicsEngine>
type PressureVector = InstanceType<typeof wasmModule.PressureVector>

let wasmEngine: PhysicsEngine | null = null

/**
 * Check if WASM is available in current environment
 */
export function isWasmAvailable(): boolean {
  // @ts-expect-error WebAssembly is not defined in all environments
  return typeof WebAssembly !== 'undefined'
}

/**
 * Initialize WASM module and engine
 */
export async function initWasm(
  config?: PhysicsConfig,
  weights?: SensitivityWeights,
): Promise<PhysicsEngine> {
  if (wasmEngine) return wasmEngine

  if (!isWasmAvailable()) {
    throw new Error('WebAssembly is not supported in this environment')
  }

  try {
    // Create engine instance
    wasmEngine = new wasmModule.PhysicsEngine()
    return wasmEngine
  } catch (error) {
    throw new Error(`Failed to initialize WASM: ${error}`)
  }
}

/**
 * Get WASM engine (must call initWasm first)
 */
export function getWasmEngine(): PhysicsEngine {
  if (!wasmEngine) {
    throw new Error('WASM engine not initialized. Call initWasm() first.')
  }
  return wasmEngine
}

/**
 * Create PressureVector for WASM
 */
export function createPressureVector(
  latency: number,
  error: number,
  saturation: number,
): PressureVector {
  return new wasmModule.PressureVector(latency, error, saturation)
}

/**
 * Calculate resistance using WASM engine
 */
export function calculateResistanceWasm(
  engine: PhysicsEngine,
  pressure: { latency: number; error: number; saturation: number },
  momentum: number,
  scar: number,
  staleness: number,
): number {
  const pressureVec = createPressureVector(pressure.latency, pressure.error, pressure.saturation)
  return engine.calculateResistance(pressureVec, momentum, scar, staleness)
}
