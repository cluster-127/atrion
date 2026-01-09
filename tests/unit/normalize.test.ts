/**
 * Normalization Unit Tests
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { isValidPressure, normalize, normalizeTelemetry } from '../../src/core/normalize.js'
import type { NormalizedPressure } from '../../src/core/types.js'

describe('normalize', () => {
  it('returns 0 when raw equals baseline', () => {
    const result = normalize(100, 100)
    expect(result).toBeCloseTo(0, 10)
  })

  it('returns positive when raw > baseline', () => {
    const result = normalize(200, 100)
    expect(result).toBeGreaterThan(0)
  })

  it('returns negative when raw < baseline', () => {
    const result = normalize(50, 100)
    expect(result).toBeLessThan(0)
  })

  it('is always bounded to [-1, 1] (property)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 1, max: 1000, noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
        (raw, baseline, scale) => {
          const result = normalize(raw, baseline, scale)
          return result >= -1 && result <= 1
        }
      )
    )
  })

  it('higher scale means sharper transition', () => {
    const lowScale = normalize(200, 100, 1)
    const highScale = normalize(200, 100, 5)
    expect(Math.abs(highScale)).toBeGreaterThan(Math.abs(lowScale))
  })
})

describe('normalizeTelemetry', () => {
  it('creates valid pressure vector', () => {
    const baselines = { latencyMs: 100, errorRate: 0.01, saturation: 0.5 }
    const result = normalizeTelemetry(100, 0.01, 0.5, baselines)
    expect(isValidPressure(result.latency)).toBe(true)
    expect(isValidPressure(result.error)).toBe(true)
    expect(isValidPressure(result.saturation)).toBe(true)
  })

  it('returns zero vector for baseline values', () => {
    const baselines = { latencyMs: 100, errorRate: 0.01, saturation: 0.5 }
    const result = normalizeTelemetry(100, 0.01, 0.5, baselines)
    expect(result.latency).toBeCloseTo(0, 5)
    expect(result.error).toBeCloseTo(0, 5)
    expect(result.saturation).toBeCloseTo(0, 5)
  })
})

describe('isValidPressure', () => {
  it('returns true for valid values', () => {
    expect(isValidPressure(0 as NormalizedPressure)).toBe(true)
    expect(isValidPressure(1 as NormalizedPressure)).toBe(true)
    expect(isValidPressure(-1 as NormalizedPressure)).toBe(true)
  })

  it('returns false for out-of-bound values', () => {
    expect(isValidPressure(1.1 as NormalizedPressure)).toBe(false)
    expect(isValidPressure(-1.1 as NormalizedPressure)).toBe(false)
  })
})
