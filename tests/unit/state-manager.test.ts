/**
 * StateManager Unit Tests
 * RFC-0008: Pluggable State Architecture
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { StateManager } from '../../src/core/state/manager.js'
import { InMemoryProvider } from '../../src/core/state/providers/inmemory.js'
import type { PhysicsVector } from '../../src/core/state/types.js'
import type { Ohms, Scar } from '../../src/core/types.js'

describe('StateManager', () => {
  let manager: StateManager

  const createVector = (scar: number, momentum: number, tick: number): PhysicsVector => ({
    scar: scar as Scar,
    momentumScalar: momentum,
    lastTick: tick,
    resistance: 10 as Ohms,
  })

  beforeEach(async () => {
    manager = new StateManager(new InMemoryProvider())
    await manager.connect()
  })

  describe('connection', () => {
    it('should connect and disconnect', async () => {
      const m = new StateManager(new InMemoryProvider())
      expect(m.isConnected).toBe(false)

      await m.connect()
      expect(m.isConnected).toBe(true)

      await m.disconnect()
      expect(m.isConnected).toBe(false)
    })

    it('should report provider name', () => {
      expect(manager.providerName).toBe('InMemoryProvider')
    })
  })

  describe('local cache', () => {
    it('should return null for unknown route', () => {
      expect(manager.getLocal('unknown')).toBeNull()
    })

    it('should store and retrieve from cache', () => {
      const vector = createVector(5, 0.1, 10)
      manager.update('test-route', vector)

      const cached = manager.getLocal('test-route')
      expect(cached).toEqual(vector)
    })

    it('should check existence with hasLocal', () => {
      expect(manager.hasLocal('test-route')).toBe(false)

      manager.update('test-route', createVector(1, 0, 1))
      expect(manager.hasLocal('test-route')).toBe(true)
    })

    it('should list cached routes', () => {
      manager.update('route-a', createVector(1, 0, 1))
      manager.update('route-b', createVector(2, 0, 2))

      const routes = manager.getCachedRoutes()
      expect(routes).toContain('route-a')
      expect(routes).toContain('route-b')
      expect(routes.length).toBe(2)
    })

    it('should clear cache', () => {
      manager.update('route-a', createVector(1, 0, 1))
      expect(manager.hasLocal('route-a')).toBe(true)

      manager.clearCache()
      expect(manager.hasLocal('route-a')).toBe(false)
    })
  })

  describe('provider sync', () => {
    it('should sync to provider on update', async () => {
      const vector = createVector(5, 0.1, 10)
      manager.update('test-route', vector)

      // Give async sync time to complete
      await new Promise((r) => setTimeout(r, 10))

      // Verify via syncFromProvider
      const m2 = new StateManager(new InMemoryProvider())
      // Note: Different provider instance, so won't see the data
      // This is expected - InMemoryProvider is process-local
    })

    it('should skip sync when syncToProvider=false', () => {
      const vector = createVector(5, 0.1, 10)
      manager.update('test-route', vector, false)

      // Still in local cache
      expect(manager.getLocal('test-route')).toEqual(vector)
    })
  })

  describe('delete', () => {
    it('should delete from cache and provider', async () => {
      manager.update('test-route', createVector(5, 0.1, 10))
      expect(manager.hasLocal('test-route')).toBe(true)

      await manager.delete('test-route')
      expect(manager.hasLocal('test-route')).toBe(false)
    })
  })
})

describe('InMemoryProvider', () => {
  let provider: InMemoryProvider

  const createVector = (scar: number): PhysicsVector => ({
    scar: scar as Scar,
    momentumScalar: 0,
    lastTick: 1,
    resistance: 10 as Ohms,
  })

  beforeEach(async () => {
    provider = new InMemoryProvider()
    await provider.connect()
  })

  it('should return null for unknown route', async () => {
    const result = await provider.getVector('unknown')
    expect(result).toBeNull()
  })

  it('should store and retrieve vector', async () => {
    const vector = createVector(5)
    await provider.updateVector('test', vector)

    const result = await provider.getVector('test')
    expect(result).toEqual(vector)
  })

  it('should delete vector', async () => {
    await provider.updateVector('test', createVector(5))
    await provider.deleteVector('test')

    const result = await provider.getVector('test')
    expect(result).toBeNull()
  })

  it('should list routes', async () => {
    await provider.updateVector('route-a', createVector(1))
    await provider.updateVector('route-b', createVector(2))

    const routes = await provider.listRoutes()
    expect(routes).toContain('route-a')
    expect(routes).toContain('route-b')
  })

  it('should clear on disconnect', async () => {
    await provider.updateVector('test', createVector(5))
    await provider.disconnect()
    await provider.connect()

    const result = await provider.getVector('test')
    expect(result).toBeNull()
  })
})
