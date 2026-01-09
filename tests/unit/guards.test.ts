/**
 * Guards Module Unit Tests
 * Tests for 5 critical edge cases
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clampToZero,
  EPSILON,
  isSafeNumber,
  normalizeZero,
  PhysicsGuard,
  safeDivide,
  safeExp,
  sanitizePositive,
  sanitizePressure,
  toSafeNumber,
} from '../../src/core/guards.js'
import { resetLogger, setLogger, type Logger } from '../../src/core/logger.js'
import type { Timestamp } from '../../src/core/types.js'

describe('isSafeNumber', () => {
  it('returns true for regular numbers', () => {
    expect(isSafeNumber(0)).toBe(true)
    expect(isSafeNumber(42)).toBe(true)
    expect(isSafeNumber(-3.14)).toBe(true)
    expect(isSafeNumber(Number.MAX_VALUE)).toBe(true)
  })

  it('returns false for NaN', () => {
    expect(isSafeNumber(NaN)).toBe(false)
  })

  it('returns false for Infinity', () => {
    expect(isSafeNumber(Infinity)).toBe(false)
    expect(isSafeNumber(-Infinity)).toBe(false)
  })

  it('returns false for non-numbers', () => {
    expect(isSafeNumber(undefined)).toBe(false)
    expect(isSafeNumber(null)).toBe(false)
    expect(isSafeNumber('42')).toBe(false)
    expect(isSafeNumber({})).toBe(false)
    expect(isSafeNumber(BigInt(42))).toBe(false)
  })
})

describe('toSafeNumber', () => {
  it('returns number as-is if safe', () => {
    expect(toSafeNumber(42)).toBe(42)
  })

  it('returns fallback for NaN', () => {
    expect(toSafeNumber(NaN, 99)).toBe(99)
  })

  it('returns fallback for Infinity', () => {
    expect(toSafeNumber(Infinity, 0)).toBe(0)
  })

  it('converts safe BigInt to number', () => {
    expect(toSafeNumber(BigInt(42))).toBe(42)
  })

  it('returns fallback for BigInt outside safe range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1000)
    expect(toSafeNumber(huge, -1)).toBe(-1)
  })

  it('parses string to number', () => {
    expect(toSafeNumber('3.14')).toBeCloseTo(3.14)
    expect(toSafeNumber('not-a-number', 0)).toBe(0)
  })
})

describe('Edge Case #1: safeDivide (Division by Zero)', () => {
  it('handles normal division', () => {
    expect(safeDivide(10, 2)).toBe(5)
  })

  it('returns fallback for division by zero', () => {
    expect(safeDivide(10, 0, 999)).toBe(999)
  })

  it('returns fallback when numerator is NaN', () => {
    expect(safeDivide(NaN, 2, -1)).toBe(-1)
  })

  it('returns fallback when denominator is NaN', () => {
    expect(safeDivide(10, NaN, -1)).toBe(-1)
  })

  it('returns fallback when result would be Infinity', () => {
    expect(safeDivide(Number.MAX_VALUE, 0.0001, 0)).toBe(0)
  })
})

describe('Edge Case #2: safeExp (Infinity Propagation)', () => {
  it('handles normal exponential', () => {
    expect(safeExp(0)).toBe(1)
    expect(safeExp(1)).toBeCloseTo(Math.E)
  })

  it('clamps large positive exponents to MAX_VALUE', () => {
    const result = safeExp(1000)
    expect(result).toBe(Number.MAX_VALUE)
  })

  it('returns 0 for large negative exponents (underflow)', () => {
    const result = safeExp(-1000)
    expect(result).toBe(0)
  })

  it('returns fallback for NaN input', () => {
    expect(safeExp(NaN, 99)).toBe(99)
  })
})

describe('Edge Case #3: clampToZero (Denormalized Numbers)', () => {
  it('preserves normal values', () => {
    expect(clampToZero(0.1)).toBe(0.1)
    expect(clampToZero(-0.1)).toBe(-0.1)
  })

  it('clamps very small values to zero', () => {
    expect(clampToZero(1e-15)).toBe(0)
    expect(clampToZero(-1e-15)).toBe(0)
  })

  it('clamps values smaller than EPSILON', () => {
    expect(clampToZero(EPSILON / 2)).toBe(0)
  })

  it('preserves values at EPSILON boundary', () => {
    expect(clampToZero(EPSILON * 2)).not.toBe(0)
  })
})

describe('Edge Case #4: normalizeZero (-0 handling)', () => {
  it('converts -0 to +0', () => {
    const result = normalizeZero(-0)
    expect(Object.is(result, 0)).toBe(true) // Not -0
    expect(Object.is(result, -0)).toBe(false)
  })

  it('preserves non-zero values', () => {
    expect(normalizeZero(42)).toBe(42)
    expect(normalizeZero(-42)).toBe(-42)
  })
})

describe('Edge Case #5: PhysicsGuard.safeDeltaT (Time Travel)', () => {
  let mockWarn: ReturnType<typeof vi.fn>
  let mockLogger: Logger

  beforeEach(() => {
    mockWarn = vi.fn()
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: mockWarn,
      error: vi.fn(),
    }
    setLogger(mockLogger)
  })

  afterEach(() => {
    resetLogger()
  })

  it('calculates normal time delta', () => {
    const result = PhysicsGuard.safeDeltaT(100 as Timestamp, 50 as Timestamp)
    expect(result).toBe(50)
  })

  it('enforces minimum delta', () => {
    const result = PhysicsGuard.safeDeltaT(100 as Timestamp, 100 as Timestamp, 5)
    expect(result).toBe(5)
  })

  it('handles negative delta (clock skew) gracefully', () => {
    const result = PhysicsGuard.safeDeltaT(50 as Timestamp, 100 as Timestamp, 10)
    expect(result).toBe(10)
    expect(mockWarn).toHaveBeenCalled()
  })
})

describe('PhysicsGuard.sanitizeVector', () => {
  let mockWarn: ReturnType<typeof vi.fn>
  let mockLogger: Logger

  beforeEach(() => {
    mockWarn = vi.fn()
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: mockWarn,
      error: vi.fn(),
    }
    setLogger(mockLogger)
  })

  afterEach(() => {
    resetLogger()
  })

  it('preserves valid vectors', () => {
    const v = { latency: 0.5, error: -0.3, saturation: 0.8 } as any
    const result = PhysicsGuard.sanitizeVector(v, 'test')
    expect(result.latency).toBe(0.5)
    expect(result.error).toBe(-0.3)
    expect(result.saturation).toBe(0.8)
  })

  it('replaces NaN components with 0', () => {
    const v = { latency: NaN, error: 0.5, saturation: 0.3 } as any
    const result = PhysicsGuard.sanitizeVector(v, 'test')
    expect(result.latency).toBe(0)
    expect(mockWarn).toHaveBeenCalled()
  })

  it('clamps out-of-range components', () => {
    const v = { latency: 1.5, error: -1.5, saturation: 0.5 } as any
    const result = PhysicsGuard.sanitizeVector(v, 'test')
    expect(result.latency).toBe(1)
    expect(result.error).toBe(-1)
  })
})

describe('PhysicsGuard.clampResistance', () => {
  it('preserves normal resistance', () => {
    expect(PhysicsGuard.clampResistance(100, 10)).toBe(100)
  })

  it('clamps to MAX_RESISTANCE ceiling', () => {
    expect(PhysicsGuard.clampResistance(Infinity, 10)).toBe(10)
  })

  it('enforces minimum at base', () => {
    expect(PhysicsGuard.clampResistance(5, 10)).toBe(10)
  })
})

describe('sanitizePressure', () => {
  it('clamps to [-1, 1]', () => {
    expect(sanitizePressure(1.5)).toBe(1)
    expect(sanitizePressure(-1.5)).toBe(-1)
    expect(sanitizePressure(0.5)).toBe(0.5)
  })
})

describe('sanitizePositive', () => {
  it('clamps to [0, ∞)', () => {
    expect(sanitizePositive(-5)).toBe(0)
    expect(sanitizePositive(5)).toBe(5)
    expect(sanitizePositive(NaN, 99)).toBe(99)
  })
})
