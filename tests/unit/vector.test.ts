/**
 * VectorMath Unit Tests
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type {
  NormalizedPressure,
  PressureVector,
  SensitivityWeights,
} from '../../src/core/types.js'
import { VectorMath } from '../../src/core/vector.js'

const asPressure = (n: number): NormalizedPressure => n as NormalizedPressure
const createVector = (lat: number, err: number, sat: number): PressureVector => ({
  latency: asPressure(lat),
  error: asPressure(err),
  saturation: asPressure(sat),
})

describe('VectorMath', () => {
  describe('magnitude', () => {
    it('returns 0 for zero vector', () => {
      const v = VectorMath.zero()
      expect(VectorMath.magnitude(v)).toBe(0)
    })

    it('calculates correct Euclidean norm', () => {
      const v = createVector(3, 4, 0)
      expect(VectorMath.magnitude(v)).toBe(5)
    })

    it('is always non-negative (property)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1, max: 1, noNaN: true }),
          fc.float({ min: -1, max: 1, noNaN: true }),
          fc.float({ min: -1, max: 1, noNaN: true }),
          (lat, err, sat) => {
            const v = createVector(lat, err, sat)
            return VectorMath.magnitude(v) >= 0
          }
        )
      )
    })
  })

  describe('subtract', () => {
    it('returns zero for identical vectors', () => {
      const v = createVector(0.5, 0.3, 0.2)
      const delta = VectorMath.subtract(v, v)
      expect(VectorMath.magnitude(delta)).toBe(0)
    })

    it('calculates correct delta', () => {
      const v1 = createVector(0.8, 0.5, 0.3)
      const v2 = createVector(0.2, 0.1, 0.1)
      const delta = VectorMath.subtract(v1, v2)
      expect(delta.latency).toBeCloseTo(0.6, 10)
      expect(delta.error).toBeCloseTo(0.4, 10)
      expect(delta.saturation).toBeCloseTo(0.2, 10)
    })
  })

  describe('scaleComponents (Hadamard)', () => {
    it('applies weights correctly', () => {
      const v = createVector(0.5, 0.4, 0.3)
      const w: SensitivityWeights = { wLatency: 2, wError: 3, wSaturation: 4 }
      const result = VectorMath.scaleComponents(v, w)
      expect(result.latency).toBeCloseTo(1.0, 10)
      expect(result.error).toBeCloseTo(1.2, 10)
      expect(result.saturation).toBeCloseTo(1.2, 10)
    })

    it('with zero weights returns zero', () => {
      const v = createVector(0.5, 0.5, 0.5)
      const w: SensitivityWeights = { wLatency: 0, wError: 0, wSaturation: 0 }
      const result = VectorMath.scaleComponents(v, w)
      expect(VectorMath.sum(result)).toBe(0)
    })
  })

  describe('sum', () => {
    it('returns sum of components', () => {
      const v = createVector(0.1, 0.2, 0.3)
      expect(VectorMath.sum(v)).toBeCloseTo(0.6, 10)
    })
  })

  describe('clamp', () => {
    it('clamps values exceeding bounds', () => {
      const v = createVector(1.5, -1.5, 0.5)
      const clamped = VectorMath.clamp(v)
      expect(clamped.latency).toBe(1)
      expect(clamped.error).toBe(-1)
      expect(clamped.saturation).toBe(0.5)
    })

    it('preserves in-bound values', () => {
      const v = createVector(0.5, -0.3, 0.8)
      const clamped = VectorMath.clamp(v)
      expect(clamped.latency).toBe(0.5)
      expect(clamped.error).toBe(-0.3)
      expect(clamped.saturation).toBe(0.8)
    })
  })

  describe('dot', () => {
    it('returns correct dot product', () => {
      const v1 = createVector(1, 0, 0)
      const v2 = createVector(0, 1, 0)
      expect(VectorMath.dot(v1, v2)).toBe(0)
    })

    it('dot with self equals magnitude squared', () => {
      // RFC-0004 §3.4: Effective Zero Consistency
      // Due to floating point rounding, we accept EPSILON tolerance
      const EPSILON = 1e-9
      fc.assert(
        fc.property(
          fc.float({ min: -1, max: 1, noNaN: true }),
          fc.float({ min: -1, max: 1, noNaN: true }),
          fc.float({ min: -1, max: 1, noNaN: true }),
          (lat, err, sat) => {
            const v = createVector(lat, err, sat)
            const dot = VectorMath.dot(v, v)
            const mag = VectorMath.magnitude(v)
            const magSq = mag * mag
            // Invariant: |dot(v,v) - magnitude²| < EPSILON
            return Math.abs(dot - magSq) < EPSILON
          }
        )
      )
    })
  })
})
