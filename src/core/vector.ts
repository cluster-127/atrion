/**
 * Atrion VectorMath Utilities
 * Pure functions for PressureVector operations.
 *
 * This module is the "Gatekeeper" for branded type arithmetic.
 * All unsafe casts are encapsulated here.
 */

import { clampToZero, safeDivide } from './guards.js'
import type { NormalizedPressure, PressureVector, SensitivityWeights } from './types.js'

// Type Cast Helper (unsafe operations isolated here)
const asPressure = (n: number): NormalizedPressure => n as NormalizedPressure

export const VectorMath = {
  /**
   * Euclidean Magnitude (||v||)
   * Used for Momentum Scalar Calculation.
   * Guarded: clampToZero prevents denormalized results (AARS 3.3)
   */
  magnitude: (v: PressureVector): number => {
    const sumSq = v.latency ** 2 + v.error ** 2 + v.saturation ** 2
    return Math.sqrt(clampToZero(sumSq))
  },

  /**
   * Vector Addition (v1 + v2)
   * Used for Predictive Extrapolation
   */
  add: (v1: PressureVector, v2: PressureVector): PressureVector => {
    return {
      latency: asPressure(v1.latency + v2.latency),
      error: asPressure(v1.error + v2.error),
      saturation: asPressure(v1.saturation + v2.saturation),
    }
  },

  /**
   * Vector Subtraction (v1 - v2)
   * Used for Delta P calculation
   */
  subtract: (cur: PressureVector, prev: PressureVector): PressureVector => {
    return {
      latency: asPressure(cur.latency - prev.latency),
      error: asPressure(cur.error - prev.error),
      saturation: asPressure(cur.saturation - prev.saturation),
    }
  },

  /**
   * Scalar Multiplication (v * k)
   */
  scale: (v: PressureVector, scalar: number): PressureVector => {
    return {
      latency: asPressure(v.latency * scalar),
      error: asPressure(v.error * scalar),
      saturation: asPressure(v.saturation * scalar),
    }
  },

  /**
   * Scalar Division (v / s)
   * Used for Momentum over Time (dP / dt).
   * Guarded: safeDivide prevents NaN/Infinity (AARS 3.1)
   */
  divide: (v: PressureVector, scalar: number): PressureVector => {
    return {
      latency: asPressure(safeDivide(v.latency, scalar, 0)),
      error: asPressure(safeDivide(v.error, scalar, 0)),
      saturation: asPressure(safeDivide(v.saturation, scalar, 0)),
    }
  },

  /**
   * Dot Product (v1 · v2)
   * Used for Stability Analysis (Divergence check: P · M).
   *
   * CONSISTENCY: Clamped to zero per RFC-0004 §3.5.
   * Enforces mathematical consistency: ||v||=0 => v·v=0
   * Prevents "phantom energy" in stability analysis.
   * See: Noise Floor Argument - values < EPSILON are noise, not signal.
   */
  dot: (v1: PressureVector, v2: PressureVector): number => {
    const result = v1.latency * v2.latency + v1.error * v2.error + v1.saturation * v2.saturation
    return clampToZero(result)
  },

  /**
   * Hadamard Product (Element-wise multiplication)
   * Used for applying Sensitivity Weights (P^T · W)
   * CRITICAL for RFC-0001 §4 Impedance Law
   */
  scaleComponents: (v: PressureVector, w: SensitivityWeights): PressureVector => {
    return {
      latency: asPressure(v.latency * w.wLatency),
      error: asPressure(v.error * w.wError),
      saturation: asPressure(v.saturation * w.wSaturation),
    }
  },

  /**
   * Sum of components
   * Used after Hadamard to get scalar pressure contribution
   */
  sum: (v: PressureVector): number => {
    return v.latency + v.error + v.saturation
  },

  /**
   * Clamp each component to [-1, 1]
   * Used after extrapolation to ensure bounds
   */
  clamp: (v: PressureVector): PressureVector => {
    const clampValue = (x: number) => Math.max(-1, Math.min(1, x))
    return {
      latency: asPressure(clampValue(v.latency)),
      error: asPressure(clampValue(v.error)),
      saturation: asPressure(clampValue(v.saturation)),
    }
  },

  /**
   * Zero Vector
   */
  zero: (): PressureVector => ({
    latency: asPressure(0),
    error: asPressure(0),
    saturation: asPressure(0),
  }),
} as const
