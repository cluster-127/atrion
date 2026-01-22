/**
 * Unit tests for Task Lease API (RFC-0010)
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllLeases,
  createLease,
  getActiveLeaseCount,
  registerLease,
  unregisterLease,
} from '../../src/core/lease'

describe('Lease API (RFC-0010)', () => {
  afterEach(() => {
    clearAllLeases()
    vi.useRealTimers()
  })

  describe('createLease', () => {
    it('should create lease with STANDARD profile', () => {
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {})

      expect(lease.id).toMatch(/^lease-/)
      expect(lease.routeId).toBe('api/test')
      expect(lease.profile).toBe('STANDARD')
      expect(lease.isActive).toBe(true)
    })

    it('should throw if HEAVY without AbortController', () => {
      expect(() => {
        createLease('heavy/task', { profile: 'HEAVY' }, () => {})
      }).toThrow('AbortController is required for HEAVY profile')
    })

    it('should throw if EXTREME without AbortController', () => {
      expect(() => {
        createLease('extreme/task', { profile: 'EXTREME' }, () => {})
      }).toThrow('AbortController is required for EXTREME profile')
    })

    it('should create lease with AbortController for HEAVY', () => {
      const controller = new AbortController()
      const lease = createLease(
        'heavy/ok',
        { profile: 'HEAVY', abortController: controller },
        () => {},
      )

      expect(lease.isActive).toBe(true)
      expect(lease.profile).toBe('HEAVY')
    })
  })

  describe('Heartbeat', () => {
    it('should update heartbeat successfully', () => {
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {})

      expect(() => lease.heartbeat()).not.toThrow()
      expect(() => lease.heartbeat({ progress: 0.5 })).not.toThrow()
    })

    it('should throw if heartbeat after release', async () => {
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {})
      await lease.release()

      expect(() => lease.heartbeat()).toThrow('lease is no longer active')
    })
  })

  describe('Release', () => {
    it('should deactivate lease on release', async () => {
      let releaseCalled = false
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {
        releaseCalled = true
      })

      await lease.release()

      expect(lease.isActive).toBe(false)
      expect(releaseCalled).toBe(true)
    })

    it('should be idempotent', async () => {
      let callCount = 0
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {
        callCount++
      })

      await lease.release()
      await lease.release()
      await lease.release()

      expect(callCount).toBe(1)
    })

    it('should pass outcome to callback', async () => {
      let receivedOutcome: string | undefined
      const lease = createLease('api/test', { profile: 'STANDARD' }, (_, outcome) => {
        receivedOutcome = outcome
      })

      await lease.release('failed')

      expect(receivedOutcome).toBe('failed')
    })
  })

  describe('Expiration', () => {
    it('should calculate remaining time correctly', () => {
      const lease = createLease('api/test', { profile: 'STANDARD', timeout: 10_000 }, () => {})

      const remaining = lease.remainingMs()
      expect(remaining).toBeGreaterThan(9_500)
      expect(remaining).toBeLessThanOrEqual(10_000)
    })

    it('should trigger AbortController on timeout', async () => {
      vi.useFakeTimers()
      const controller = new AbortController()
      let aborted = false
      controller.signal.addEventListener('abort', () => {
        aborted = true
      })

      createLease(
        'heavy/test',
        { profile: 'HEAVY', abortController: controller, timeout: 1000 },
        () => {},
      )

      vi.advanceTimersByTime(1001)

      expect(aborted).toBe(true)
    })
  })

  describe('Lease Registry', () => {
    it('should track registered leases', () => {
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {})
      registerLease(lease)

      expect(getActiveLeaseCount('api/test')).toBe(1)
    })

    it('should decrement count on unregister', () => {
      const lease = createLease('api/test', { profile: 'STANDARD' }, () => {})
      registerLease(lease)
      unregisterLease(lease.id)

      expect(getActiveLeaseCount('api/test')).toBe(0)
    })

    it('should track multiple leases per route', () => {
      const lease1 = createLease('api/test', { profile: 'STANDARD' }, () => {})
      const lease2 = createLease('api/test', { profile: 'STANDARD' }, () => {})
      registerLease(lease1)
      registerLease(lease2)

      expect(getActiveLeaseCount('api/test')).toBe(2)
    })
  })
})
