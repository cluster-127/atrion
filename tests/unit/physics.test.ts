/**
 * Physics Engine Unit Tests
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_SLO, deriveWeights } from '../../src/core/config.js'
import {
  calculateMomentum,
  calculateResistance,
  createBootstrapState,
  updatePhysics,
  updateScar,
} from '../../src/core/physics.js'
import type {
  DeltaTime,
  Momentum,
  NormalizedPressure,
  PressureVector,
  Scar,
  Timestamp,
} from '../../src/core/types.js'
import { VectorMath } from '../../src/core/vector.js'

const asPressure = (n: number): NormalizedPressure => n as NormalizedPressure
const createVector = (lat: number, err: number, sat: number): PressureVector => ({
  latency: asPressure(lat),
  error: asPressure(err),
  saturation: asPressure(sat),
})

describe('calculateMomentum', () => {
  it('returns 0 for identical pressures', () => {
    const p = createVector(0.5, 0.3, 0.2)
    const m = calculateMomentum(p, p, 1 as DeltaTime)
    expect(m).toBe(0)
  })

  it('scales inversely with deltaT', () => {
    const prev = VectorMath.zero()
    const curr = createVector(0.5, 0, 0)
    const m1 = calculateMomentum(curr, prev, 1 as DeltaTime)
    const m2 = calculateMomentum(curr, prev, 2 as DeltaTime)
    expect(m1).toBeCloseTo(m2 * 2, 10)
  })

  it('is always non-negative (property)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1, max: 1, noNaN: true }),
        fc.float({ min: -1, max: 1, noNaN: true }),
        (p1, p2) => {
          const prev = createVector(p1, 0, 0)
          const curr = createVector(p2, 0, 0)
          const m = calculateMomentum(curr, prev, 1 as DeltaTime)
          return m >= 0
        }
      )
    )
  })
})

describe('updateScar', () => {
  it('decays when no trauma', () => {
    const config = { ...DEFAULT_CONFIG, criticalPressure: 0.9 as NormalizedPressure }
    const lowPressure = createVector(0.1, 0.1, 0.1)
    const newScar = updateScar(5 as Scar, lowPressure, config, 1 as DeltaTime)
    expect(newScar).toBeLessThan(5)
  })

  it('increases when critical', () => {
    const config = { ...DEFAULT_CONFIG, criticalPressure: 0.3 as NormalizedPressure }
    const highPressure = createVector(0.5, 0.5, 0.5)
    const newScar = updateScar(0 as Scar, highPressure, config, 1 as DeltaTime)
    expect(newScar).toBeGreaterThan(0)
  })

  it('never goes negative (property)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: -1, max: 1, noNaN: true }),
        (scar, pressure) => {
          const p = createVector(pressure, 0, 0)
          const config = { ...DEFAULT_CONFIG, criticalPressure: 0.99 as NormalizedPressure }
          const newScar = updateScar(scar as Scar, p, config, 1 as DeltaTime)
          return newScar >= 0
        }
      )
    )
  })
})

describe('calculateResistance', () => {
  const weights = deriveWeights(DEFAULT_SLO)

  it('never below baseResistance (property)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 10, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (pressure, momentum, scar) => {
          const p = createVector(pressure, 0, 0)
          const r = calculateResistance(
            p,
            momentum as Momentum,
            scar as Scar,
            weights,
            DEFAULT_CONFIG
          )
          return r >= DEFAULT_CONFIG.baseResistance
        }
      )
    )
  })

  it('increases with higher pressure', () => {
    const low = createVector(0.1, 0.1, 0.1)
    const high = createVector(0.9, 0.9, 0.9)
    const rLow = calculateResistance(low, 0 as Momentum, 0 as Scar, weights, DEFAULT_CONFIG)
    const rHigh = calculateResistance(high, 0 as Momentum, 0 as Scar, weights, DEFAULT_CONFIG)
    expect(rHigh).toBeGreaterThan(rLow)
  })

  it('increases with higher momentum', () => {
    const p = createVector(0.5, 0.5, 0.5)
    const rLow = calculateResistance(p, 0.1 as Momentum, 0 as Scar, weights, DEFAULT_CONFIG)
    const rHigh = calculateResistance(p, 1.0 as Momentum, 0 as Scar, weights, DEFAULT_CONFIG)
    expect(rHigh).toBeGreaterThan(rLow)
  })

  it('increases with higher scar', () => {
    const p = createVector(0.5, 0.5, 0.5)
    const rLow = calculateResistance(p, 0 as Momentum, 1 as Scar, weights, DEFAULT_CONFIG)
    const rHigh = calculateResistance(p, 0 as Momentum, 10 as Scar, weights, DEFAULT_CONFIG)
    expect(rHigh).toBeGreaterThan(rLow)
  })
})

describe('updatePhysics', () => {
  const weights = deriveWeights(DEFAULT_SLO)

  it('stays in bootstrap for initial ticks', () => {
    const state = createBootstrapState('route-1', VectorMath.zero(), DEFAULT_CONFIG, 0 as Timestamp)
    const newState = updatePhysics(
      state,
      VectorMath.zero(),
      weights,
      DEFAULT_CONFIG,
      1 as Timestamp
    )
    expect(newState.mode).toBe('BOOTSTRAP')
  })

  it('transitions to operational after bootstrap', () => {
    let state = createBootstrapState('route-1', VectorMath.zero(), DEFAULT_CONFIG, 0 as Timestamp)

    // Run through bootstrap period
    for (let i = 1; i <= DEFAULT_CONFIG.bootstrapTicks; i++) {
      state = updatePhysics(
        state,
        VectorMath.zero(),
        weights,
        DEFAULT_CONFIG,
        i as Timestamp
      ) as typeof state
    }

    expect(state.mode).toBe('OPERATIONAL')
  })
})
