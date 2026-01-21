/**
 * Atrion Class Unit Tests
 * RFC-0008: Pluggable State Architecture
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Atrion } from '../../src/atrion.js'
import { InMemoryProvider } from '../../src/core/state/providers/inmemory.js'

describe('Atrion', () => {
  let atrion: Atrion

  beforeEach(async () => {
    atrion = new Atrion({
      provider: new InMemoryProvider(),
      autoTuner: false, // Disable for predictable tests
    })
    await atrion.connect()
  })

  afterEach(async () => {
    await atrion.disconnect()
  })

  describe('connection', () => {
    it('should report connection status', () => {
      expect(atrion.isConnected).toBe(true)
    })

    it('should report provider name', () => {
      expect(atrion.providerName).toBe('InMemoryProvider')
    })
  })

  describe('route()', () => {
    it('should allow request with low latency', () => {
      const decision = atrion.route('api/test', { latencyMs: 10 })

      expect(decision.allow).toBe(true)
      expect(decision.mode).toBe('BOOTSTRAP')
      expect(decision.reason).toBe('OK')
    })

    it('should track route state', () => {
      atrion.route('api/test', { latencyMs: 10 })

      const state = atrion.getState('api/test')
      expect(state).toBeDefined()
      expect(state?.routeId).toBe('api/test')
    })

    it('should list tracked routes', () => {
      atrion.route('api/a', { latencyMs: 10 })
      atrion.route('api/b', { latencyMs: 20 })

      const routes = atrion.getRoutes()
      expect(routes).toContain('api/a')
      expect(routes).toContain('api/b')
    })

    it('should transition to operational after bootstrap', () => {
      // Default bootstrapTicks is 10
      for (let i = 0; i < 11; i++) {
        atrion.route('api/test', { latencyMs: 10 })
      }

      const state = atrion.getState('api/test')
      expect(state?.mode).toBe('OPERATIONAL')
    })

    it('should calculate resistance based on telemetry', () => {
      // Multiple calls to observe resistance changes
      atrion.route('api/test', { latencyMs: 10 })
      const lowLatencyState = atrion.getState('api/test')

      atrion.route('api/test', { latencyMs: 500 })
      const highLatencyState = atrion.getState('api/test')

      // Resistance increases with worse telemetry
      expect(highLatencyState!.resistance).toBeGreaterThanOrEqual(lowLatencyState!.resistance)
    })
  })

  describe('resetRoute()', () => {
    it('should reset route state', async () => {
      atrion.route('api/test', { latencyMs: 10 })
      expect(atrion.getState('api/test')).toBeDefined()

      await atrion.resetRoute('api/test')
      expect(atrion.getState('api/test')).toBeUndefined()
    })
  })

  describe('AutoTuner integration', () => {
    it('should return undefined stats when disabled', () => {
      expect(atrion.getTunerStats()).toBeUndefined()
    })

    it('should return stats when enabled', async () => {
      const withTuner = new Atrion({ autoTuner: true })
      await withTuner.connect()

      withTuner.route('api/test', { latencyMs: 10 })
      const stats = withTuner.getTunerStats()

      expect(stats).toBeDefined()
      await withTuner.disconnect()
    })
  })

  describe('options', () => {
    it('should use default config when not provided', async () => {
      const a = new Atrion()
      await a.connect()

      const decision = a.route('test', { latencyMs: 10 })
      expect(decision).toBeDefined()

      await a.disconnect()
    })

    it('should use custom SLO config', async () => {
      const a = new Atrion({
        slo: {
          baselineLatencyMs: 50,
          maxAcceptableLatencyMs: 200,
          targetErrorRate: 0.01,
          criticality: { latency: 8, error: 10, saturation: 5 },
        },
      })
      await a.connect()

      const decision = a.route('test', { latencyMs: 100 })
      expect(decision).toBeDefined()

      await a.disconnect()
    })
  })
})
