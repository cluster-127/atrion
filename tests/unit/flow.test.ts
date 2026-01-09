/**
 * Flow Decision Unit Tests
 */
import { describe, expect, it } from 'vitest'
import { createRequest, decideFlow, selectRoute } from '../../src/core/flow.js'
import type {
  CircuitBreakerState,
  Momentum,
  Ohms,
  OperationalState,
  RouteState,
  Scar,
  Timestamp,
} from '../../src/core/types.js'
import { VectorMath } from '../../src/core/vector.js'

// Helper to create test states
const createOperationalState = (routeId: string, resistance: number): OperationalState => ({
  routeId,
  mode: 'OPERATIONAL',
  pressure: VectorMath.zero(),
  previousPressure: VectorMath.zero(),
  momentum: 0 as Momentum,
  scarTissue: 0 as Scar,
  resistance: resistance as Ohms,
  tickCount: 10,
  lastUpdatedAt: 0 as Timestamp,
})

const createCircuitBreakerState = (routeId: string): CircuitBreakerState => ({
  routeId,
  mode: 'CIRCUIT_BREAKER',
  pressure: VectorMath.zero(),
  previousPressure: VectorMath.zero(),
  momentum: 0 as Momentum,
  scarTissue: 100 as Scar,
  resistance: 1000 as Ohms,
  tickCount: 50,
  lastUpdatedAt: 0 as Timestamp,
  recoveryStartedAt: 0 as Timestamp,
})

describe('decideFlow', () => {
  describe('OPERATIONAL state', () => {
    it('returns PASS when voltage > resistance', () => {
      const route = createOperationalState('route-1', 50)
      const request = createRequest('req-1', 100, 0)
      const decision = decideFlow(request, route)

      expect(decision.type).toBe('PASS')
      if (decision.type === 'PASS') {
        expect(decision.routeId).toBe('route-1')
      }
    })

    it('returns REJECT when voltage < resistance', () => {
      const route = createOperationalState('route-1', 100)
      const request = createRequest('req-1', 50, 0)
      const decision = decideFlow(request, route)

      expect(decision.type).toBe('REJECT')
      if (decision.type === 'REJECT') {
        expect(decision.reason).toBe('INSUFFICIENT_VOLTAGE')
      }
    })

    it('returns REJECT when voltage == resistance (boundary)', () => {
      const route = createOperationalState('route-1', 100)
      const request = createRequest('req-1', 100, 0)
      const decision = decideFlow(request, route)

      expect(decision.type).toBe('REJECT')
    })
  })

  describe('CIRCUIT_BREAKER state', () => {
    it('always rejects regardless of voltage', () => {
      const route = createCircuitBreakerState('route-1')
      const request = createRequest('req-1', 10000, 0) // Very high voltage

      const decision = decideFlow(request, route)

      expect(decision.type).toBe('REJECT')
      if (decision.type === 'REJECT') {
        expect(decision.reason).toBe('CIRCUIT_OPEN')
      }
    })
  })
})

describe('selectRoute', () => {
  it('returns null for empty routes array', () => {
    const result = selectRoute([])
    expect(result).toBeNull()
  })

  it('returns the only route when single route available', () => {
    const routes = [createOperationalState('route-1', 50)]
    const result = selectRoute(routes)

    expect(result).not.toBeNull()
    expect(result?.routeId).toBe('route-1')
  })

  it('filters out CIRCUIT_BREAKER routes', () => {
    const routes: RouteState[] = [
      createCircuitBreakerState('route-cb'),
      createOperationalState('route-op', 50),
    ]

    // Should always return the operational route
    for (let i = 0; i < 10; i++) {
      const result = selectRoute(routes)
      expect(result?.routeId).toBe('route-op')
    }
  })

  it('returns null when all routes are CIRCUIT_BREAKER', () => {
    const routes: RouteState[] = [
      createCircuitBreakerState('route-1'),
      createCircuitBreakerState('route-2'),
    ]

    const result = selectRoute(routes)
    expect(result).toBeNull()
  })

  it('prefers lower resistance routes (statistical)', () => {
    const lowR = createOperationalState('low', 10)
    const highR = createOperationalState('high', 100)
    const routes = [lowR, highR]

    const selections: Record<string, number> = { low: 0, high: 0 }

    // Run many trials
    for (let i = 0; i < 1000; i++) {
      const result = selectRoute(routes, 1.0)
      if (result) {
        selections[result.routeId]++
      }
    }

    // Low resistance should be selected more often
    expect(selections.low).toBeGreaterThan(selections.high)
    // At beta=1, with R=10 vs R=100, low should dominate
    expect(selections.low).toBeGreaterThan(900)
  })

  it('beta=0 gives uniform distribution', () => {
    const route1 = createOperationalState('r1', 10)
    const route2 = createOperationalState('r2', 100)
    const routes = [route1, route2]

    const selections: Record<string, number> = { r1: 0, r2: 0 }

    for (let i = 0; i < 1000; i++) {
      const result = selectRoute(routes, 0)
      if (result) {
        selections[result.routeId]++
      }
    }

    // Should be roughly 50/50 (within 10% tolerance)
    expect(selections.r1).toBeGreaterThan(400)
    expect(selections.r1).toBeLessThan(600)
  })
})

describe('createRequest', () => {
  it('creates request with correct properties', () => {
    const req = createRequest('test-req', 42, 1000)

    expect(req.requestId).toBe('test-req')
    expect(req.voltage).toBe(42)
    expect(req.timestamp).toBe(1000)
  })
})
