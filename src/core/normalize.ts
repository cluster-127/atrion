/**
 * Atrion Normalization Functions
 * tanh-based soft normalization with gradient preservation.
 * See RFC-0002 §2.1
 */

import { isSafeNumber, safeDivide, safeTanh, toSafeNumber } from './guards.js'
import type { NormalizedPressure, PressureVector } from './types.js'

const asPressure = (n: number): NormalizedPressure => n as NormalizedPressure

/**
 * Normalize a raw metric value to [-1, 1] using tanh.
 * Handles edge cases: NaN, Infinity, zero baseline.
 *
 * @param rawValue - The raw metric (e.g., latency in ms)
 * @param baseline - The expected baseline value
 * @param scale - Steepness factor (higher = sharper transition)
 * @returns Normalized value in [-1, 1]
 */
export function normalize(
  rawValue: number,
  baseline: number,
  scale: number = 1
): NormalizedPressure {
  // Guard: ensure all inputs are safe numbers
  const safeRaw = toSafeNumber(rawValue, 0)
  const safeBaseline = toSafeNumber(baseline, 1) // Avoid division by zero
  const safeScale = toSafeNumber(scale, 1)

  // Guard: baseline must be positive
  if (safeBaseline <= 0) {
    return asPressure(0)
  }

  const deviation = safeDivide(safeRaw - safeBaseline, safeBaseline, 0)
  return asPressure(safeTanh(deviation * safeScale))
}

/**
 * Normalize raw telemetry into a PressureVector.
 * Handles edge cases in all inputs.
 *
 * @param latencyMs - Current latency in milliseconds
 * @param errorRate - Current error rate [0, 1]
 * @param saturation - Current queue saturation [0, 1]
 * @param baselines - Baseline values for normalization
 * @param scale - Global tanh scale factor
 */
export function normalizeTelemetry(
  latencyMs: number,
  errorRate: number,
  saturation: number,
  baselines: {
    latencyMs: number
    errorRate: number
    saturation: number
  },
  scale: number = 1
): PressureVector {
  return {
    latency: normalize(latencyMs, baselines.latencyMs, scale),
    error: normalize(errorRate, baselines.errorRate, scale),
    saturation: normalize(saturation, baselines.saturation, scale),
  }
}

/**
 * Check if a normalized pressure is within valid bounds.
 */
export function isValidPressure(p: NormalizedPressure): boolean {
  return isSafeNumber(p) && p >= -1 && p <= 1
}

/**
 * Check if all components of a PressureVector are within bounds.
 */
export function isValidPressureVector(v: PressureVector): boolean {
  return isValidPressure(v.latency) && isValidPressure(v.error) && isValidPressure(v.saturation)
}
