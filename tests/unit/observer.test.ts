/**
 * Observer Unit Tests (v1.1)
 * Validates PhysicsObserver integration with updatePhysics
 */

import { describe, expect, it, vi } from 'vitest'
import {
  consoleObserver,
  createBootstrapState,
  createCollectorObserver,
  createCompositeObserver,
  createFilteredObserver,
  DEFAULT_CONFIG,
  DEFAULT_SLO,
  deriveWeights,
  silentObserver,
  updatePhysics,
  type PhysicsEvent,
  type PhysicsObserver,
  type PressureVector,
  type RouteState,
  type Timestamp,
} from '../../src/core/index.js'

describe('PhysicsObserver', () => {
  // Test setup
  const slo = DEFAULT_SLO
  const config = DEFAULT_CONFIG
  const weights = deriveWeights(slo)

  const zeroPressure: PressureVector = {
    latency: 0 as any,
    error: 0 as any,
    saturation: 0 as any,
  }

  const highPressure: PressureVector = {
    latency: 0.8 as any,
    error: 0.5 as any,
    saturation: 0.3 as any,
  }

  function getInitialState() {
    return createBootstrapState('test-route', zeroPressure, config, 1000 as Timestamp)
  }

  describe('Observer Integration', () => {
    it('should call observer.onUpdate on every updatePhysics call', () => {
      const onUpdate = vi.fn()
      const observer: PhysicsObserver = { onUpdate }

      let state: RouteState = getInitialState()
      state = updatePhysics(state, zeroPressure, weights, config, 1100 as Timestamp, observer)
      state = updatePhysics(state, zeroPressure, weights, config, 1200 as Timestamp, observer)
      state = updatePhysics(state, zeroPressure, weights, config, 1300 as Timestamp, observer)

      expect(onUpdate).toHaveBeenCalledTimes(3)
    })

    it('should not crash when observer is undefined', () => {
      let state: RouteState = getInitialState()
      expect(() => {
        state = updatePhysics(state, zeroPressure, weights, config, 1100 as Timestamp)
        state = updatePhysics(state, zeroPressure, weights, config, 1200 as Timestamp, undefined)
      }).not.toThrow()
    })

    it('should emit correct event data', () => {
      const events: PhysicsEvent[] = []
      const observer = createCollectorObserver(events)

      let state: RouteState = getInitialState()
      state = updatePhysics(state, highPressure, weights, config, 1100 as Timestamp, observer)

      expect(events).toHaveLength(1)
      const event = events[0]

      expect(event.routeId).toBe('test-route')
      expect(event.mode).toBe('BOOTSTRAP')
      expect(event.decision).toBe('BOOTSTRAP')
      expect(event.timestamp).toBe(1100)
      expect(event.pressureMagnitude).toBeGreaterThan(0)
      expect(typeof event.resistance).toBe('number')
      expect(typeof event.scarTissue).toBe('number')
    })

    it('should detect mode transitions', () => {
      const events: PhysicsEvent[] = []
      const observer = createCollectorObserver(events)

      let state: RouteState = getInitialState()
      // Bootstrap phase (default is 3 ticks)
      for (let i = 0; i < config.bootstrapTicks; i++) {
        state = updatePhysics(
          state,
          zeroPressure,
          weights,
          config,
          (1100 + i * 100) as Timestamp,
          observer
        )
      }

      // Find the transition event
      const transitionEvent = events.find((e) => e.modeTransition !== undefined)
      expect(transitionEvent).toBeDefined()
      expect(transitionEvent!.modeTransition).toEqual({
        from: 'BOOTSTRAP',
        to: 'OPERATIONAL',
      })
    })

    it('should emit SHED decision on circuit breaker mode', () => {
      const events: PhysicsEvent[] = []
      const observer = createCollectorObserver(events)

      // Fast-forward to operational mode
      let state: RouteState = getInitialState()
      for (let i = 0; i < config.bootstrapTicks; i++) {
        state = updatePhysics(
          state,
          zeroPressure,
          weights,
          config,
          (1000 + i * 100) as Timestamp,
          observer
        )
      }

      // Apply sustained high pressure to trigger circuit breaker
      const extremePressure: PressureVector = {
        latency: 0.99 as any,
        error: 0.99 as any,
        saturation: 0.99 as any,
      }

      // Continue with extreme pressure until circuit breaker triggers
      for (let i = 0; i < 20; i++) {
        state = updatePhysics(
          state,
          extremePressure,
          weights,
          config,
          (2000 + i * 100) as Timestamp,
          observer
        )
        if (state.mode === 'CIRCUIT_BREAKER') break
      }

      // Find SHED event
      const shedEvent = events.find((e) => e.decision === 'SHED')
      if (state.mode === 'CIRCUIT_BREAKER') {
        expect(shedEvent).toBeDefined()
        expect(shedEvent!.mode).toBe('CIRCUIT_BREAKER')
      }
    })
  })

  describe('Built-in Observers', () => {
    it('silentObserver should not throw', () => {
      const mockEvent = {
        routeId: 'test',
        mode: 'OPERATIONAL',
        resistance: 1.0,
        momentum: 0.001,
        scarTissue: 0,
        decision: 'FLOW',
        deltaT: 100,
        timestamp: 1000,
        pressureMagnitude: 0.5,
        tickCount: 5,
      } as PhysicsEvent

      expect(() => silentObserver.onUpdate(mockEvent)).not.toThrow()
    })

    it('consoleObserver should not throw', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockEvent = {
        routeId: 'test',
        mode: 'OPERATIONAL',
        resistance: 1.0,
        momentum: 0.001,
        scarTissue: 0,
        decision: 'FLOW',
        deltaT: 100,
        timestamp: 1000,
        pressureMagnitude: 0.5,
        tickCount: 5,
      } as PhysicsEvent

      expect(() => consoleObserver.onUpdate(mockEvent)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('createCompositeObserver should fan out to all observers', () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const fn3 = vi.fn()

      const composite = createCompositeObserver(
        { onUpdate: fn1 },
        { onUpdate: fn2 },
        { onUpdate: fn3 }
      )

      const mockEvent = {
        routeId: 'test',
        mode: 'OPERATIONAL',
        resistance: 1.0,
        momentum: 0.001,
        scarTissue: 0,
        decision: 'FLOW',
        deltaT: 100,
        timestamp: 1000,
        pressureMagnitude: 0.5,
        tickCount: 5,
      } as PhysicsEvent

      composite.onUpdate(mockEvent)

      expect(fn1).toHaveBeenCalledWith(mockEvent)
      expect(fn2).toHaveBeenCalledWith(mockEvent)
      expect(fn3).toHaveBeenCalledWith(mockEvent)
    })

    it('createFilteredObserver should only call inner when predicate matches', () => {
      const inner = vi.fn()
      const filtered = createFilteredObserver({ onUpdate: inner }, (e) => e.decision === 'SHED')

      const flowEvent = { decision: 'FLOW' } as PhysicsEvent
      const shedEvent = { decision: 'SHED' } as PhysicsEvent

      filtered.onUpdate(flowEvent)
      expect(inner).not.toHaveBeenCalled()

      filtered.onUpdate(shedEvent)
      expect(inner).toHaveBeenCalledWith(shedEvent)
    })

    it('createCollectorObserver should collect all events', () => {
      const collection: PhysicsEvent[] = []
      const collector = createCollectorObserver(collection)

      const event1 = { routeId: 'a' } as PhysicsEvent
      const event2 = { routeId: 'b' } as PhysicsEvent

      collector.onUpdate(event1)
      collector.onUpdate(event2)

      expect(collection).toHaveLength(2)
      expect(collection[0].routeId).toBe('a')
      expect(collection[1].routeId).toBe('b')
    })
  })
})
