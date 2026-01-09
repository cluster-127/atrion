/**
 * Atrion Guard Utilities
 * Defensive programming for the 5 critical edge cases:
 * 1. Division by Zero (Momentum Killer)
 * 2. Infinity Propagation (Black Hole)
 * 3. Denormalized Numbers (Zeno's Paradox)
 * 4. Negative Zero (-0)
 * 5. Time Travel (Clock Skew)
 */

import { MAX_SAFE_RESISTANCE, PHYSICS_EPSILON } from './constants.js'
import { getLogger } from './logger.js'
import type { DeltaTime, NormalizedPressure, PressureVector, Timestamp } from './types.js'

// Re-export constants for backward compatibility
export const EPSILON = PHYSICS_EPSILON
export const MAX_RESISTANCE = MAX_SAFE_RESISTANCE
export const MIN_DELTA_T = 1

// ============================================================================
// PRIMITIVE GUARDS
// ============================================================================

/**
 * Check if a value is a safe, finite number.
 * Returns false for: NaN, Infinity, -Infinity, BigInt, undefined, null
 */
export function isSafeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
}

/**
 * Coerce a value to a safe number, with fallback.
 * Handles: NaN, Infinity, -Infinity, undefined, null, strings, BigInt
 */
export function toSafeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'bigint') {
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value)
    }
    return fallback
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isSafeNumber(parsed) ? parsed : fallback
  }

  if (typeof value !== 'number') {
    return fallback
  }

  return isSafeNumber(value) ? value : fallback
}

/**
 * Clamp a number to a range, handling edge cases.
 */
export function safeClamp(value: number, min: number, max: number): number {
  if (!isSafeNumber(value)) return (min + max) / 2
  return Math.max(min, Math.min(max, value))
}

/**
 * [Edge Case #1] Safe division that handles zero and edge cases.
 * Prevents: Division by Zero → Infinity/NaN
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (!isSafeNumber(numerator) || !isSafeNumber(denominator)) {
    return fallback
  }
  if (denominator === 0) {
    return fallback
  }
  const result = numerator / denominator
  return isSafeNumber(result) ? result : fallback
}

/**
 * [Edge Case #2] Safe exponential that prevents overflow.
 * Prevents: exp(large) → Infinity
 */
export function safeExp(value: number, fallback: number = 0): number {
  if (!isSafeNumber(value)) return fallback

  // exp(709) ≈ 8.2e307, exp(710) = Infinity
  if (value > 709) return Number.MAX_VALUE
  if (value < -745) return 0 // Underflow to zero

  const result = Math.exp(value)
  return isSafeNumber(result) ? result : fallback
}

/**
 * Safe tanh (always bounded to [-1, 1]).
 */
export function safeTanh(value: number): number {
  if (!isSafeNumber(value)) return 0
  return Math.tanh(value)
}

/**
 * [Edge Case #3] Clamp denormalized numbers to zero.
 * Prevents: Zeno's Paradox - infinitely small but never zero
 */
export function clampToZero(value: number): number {
  if (!isSafeNumber(value)) return 0
  return Math.abs(value) < EPSILON ? 0 : value
}

/**
 * [Edge Case #4] Normalize -0 to +0.
 * Prevents: 1/-0 = -Infinity vs 1/0 = Infinity confusion
 */
export function normalizeZero(value: number): number {
  return value === 0 ? 0 : value // Adding 0 or using === converts -0 to 0
}

// ============================================================================
// PRESSURE GUARDS
// ============================================================================

/**
 * Sanitize a pressure-like value to [-1, 1].
 */
export function sanitizePressure(value: unknown): number {
  const num = toSafeNumber(value, 0)
  return safeClamp(num, -1, 1)
}

/**
 * Sanitize a positive value (resistance, scar, etc.).
 */
export function sanitizePositive(value: unknown, fallback: number = 0): number {
  const num = toSafeNumber(value, fallback)
  return Math.max(0, num)
}

// ============================================================================
// PHYSICS GUARD (Composite Guards)
// ============================================================================

const asPressure = (n: number): NormalizedPressure => n as NormalizedPressure

export const PhysicsGuard = {
  /**
   * Sanitize entire PressureVector.
   * NaN/Infinity in any component → safe 0
   */
  sanitizeVector: (v: PressureVector, label: string = 'unknown'): PressureVector => {
    const check = (n: number, name: string): NormalizedPressure => {
      if (!isSafeNumber(n)) {
        getLogger().warn(`Physics Violation [${label}]: ${name} is ${n}, defaulting to 0`)
        return asPressure(0)
      }
      return asPressure(safeClamp(n, -1, 1))
    }

    return {
      latency: check(v.latency, 'latency'),
      error: check(v.error, 'error'),
      saturation: check(v.saturation, 'saturation'),
    }
  },

  /**
   * [Edge Case #5] Safe delta time calculation.
   * Prevents: Time travel (negative deltaT) and division by zero.
   */
  safeDeltaT: (now: Timestamp, last: Timestamp, minDelta: number = MIN_DELTA_T): DeltaTime => {
    let dt = now - last

    // Time travel detection
    if (dt < 0) {
      getLogger().warn(`Clock skew detected: deltaT=${dt}ms, using minDelta`)
      dt = minDelta
    }

    // Ensure minimum delta to prevent division by zero
    return Math.max(dt, minDelta) as DeltaTime
  },

  /**
   * Clamp resistance to prevent Infinity.
   */
  clampResistance: (r: number, base: number): number => {
    if (!isSafeNumber(r)) return base
    return Math.min(Math.max(r, base), MAX_RESISTANCE)
  },

  /**
   * Apply Zeno guard to scar tissue.
   * Values below EPSILON become exactly 0.
   */
  cleanScar: (scar: number): number => {
    return clampToZero(sanitizePositive(scar))
  },
}
