/**
 * Atrion Configuration
 * Default values and SLO-derived weight calculation.
 * See RFC-0002 §1.1, RFC-0004 §4
 */

import type {
  DeltaTime,
  NormalizedPressure,
  Ohms,
  PhysicsConfig,
  SLOConfig,
  SensitivityWeights,
} from './types.js'

/**
 * Default physics configuration (conservative)
 */
export const DEFAULT_CONFIG: PhysicsConfig = {
  baseResistance: 10 as Ohms,
  decayRate: 0.1, // ~10% decay per tick
  scarFactor: 5,
  dampingFactor: 20,
  criticalPressure: 0.7 as NormalizedPressure,
  breakMultiplier: 10,
  bootstrapTicks: 10,
  minDeltaT: 100 as DeltaTime, // 100ms
  tanhScale: 1,
}

/**
 * Derive sensitivity weights from SLO configuration.
 * Uses log transform: w = log(1 + criticality)
 *
 * @param slo - Service Level Objective configuration
 * @returns Sensitivity weights for pressure calculation
 */
export function deriveWeights(slo: SLOConfig): SensitivityWeights {
  return {
    wLatency: Math.log(1 + slo.criticality.latency),
    wError: Math.log(1 + slo.criticality.error),
    wSaturation: Math.log(1 + slo.criticality.saturation),
  }
}

/**
 * Default SLO configuration for testing
 */
export const DEFAULT_SLO: SLOConfig = {
  baselineLatencyMs: 100,
  maxAcceptableLatencyMs: 500,
  targetErrorRate: 0.01,
  criticality: {
    latency: 5,
    error: 8,
    saturation: 3,
  },
}

/**
 * Calculate normalized baselines from SLO
 */
export function deriveBaselines(slo: SLOConfig) {
  return {
    latencyMs: slo.baselineLatencyMs,
    errorRate: slo.targetErrorRate,
    saturation: 0.5, // 50% utilization as baseline
  }
}

/**
 * Floating point comparison epsilon
 */
export const EPSILON = 1e-10

/**
 * Compare two numbers with epsilon tolerance
 */
export function floatEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON
}
