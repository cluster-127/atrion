/**
 * Unit tests for Workload Profiles (RFC-0010)
 */

import { describe, expect, it } from 'vitest'
import {
  PROFILE_CONFIGS,
  calculateProfilePressure,
  clearRouteProfiles,
  getProfileConfig,
  getRouteProfile,
  requiresAbortController,
  requiresHeartbeat,
  setRouteProfile,
} from '../../src/core/profiles'

describe('Workload Profiles (RFC-0010)', () => {
  describe('Profile Configurations', () => {
    it('should have correct baseline for LIGHT profile', () => {
      expect(PROFILE_CONFIGS.LIGHT.baselineLatencyMs).toBe(10)
      expect(PROFILE_CONFIGS.LIGHT.heartbeatRequired).toBe(false)
    })

    it('should have correct baseline for STANDARD profile', () => {
      expect(PROFILE_CONFIGS.STANDARD.baselineLatencyMs).toBe(100)
      expect(PROFILE_CONFIGS.STANDARD.heartbeatRequired).toBe(false)
    })

    it('should have correct baseline for HEAVY profile', () => {
      expect(PROFILE_CONFIGS.HEAVY.baselineLatencyMs).toBe(5_000)
      expect(PROFILE_CONFIGS.HEAVY.heartbeatRequired).toBe(true)
    })

    it('should have correct baseline for EXTREME profile', () => {
      expect(PROFILE_CONFIGS.EXTREME.baselineLatencyMs).toBe(60_000)
      expect(PROFILE_CONFIGS.EXTREME.heartbeatRequired).toBe(true)
    })
  })

  describe('getProfileConfig', () => {
    it('should return config for named profile', () => {
      const config = getProfileConfig('HEAVY')
      expect(config.baselineLatencyMs).toBe(5_000)
    })

    it('should return custom config when passed object', () => {
      const custom = {
        baselineLatencyMs: 500,
        maxDurationMs: 10_000,
        heartbeatRequired: false,
        heartbeatIntervalMs: 0,
        scarMultiplier: 1.0,
      }
      const config = getProfileConfig(custom)
      expect(config.baselineLatencyMs).toBe(500)
    })

    it('should default CUSTOM to STANDARD', () => {
      const config = getProfileConfig('CUSTOM')
      expect(config.baselineLatencyMs).toBe(PROFILE_CONFIGS.STANDARD.baselineLatencyMs)
    })
  })

  describe('AbortController Requirements', () => {
    it('should not require AbortController for LIGHT', () => {
      expect(requiresAbortController('LIGHT')).toBe(false)
    })

    it('should not require AbortController for STANDARD', () => {
      expect(requiresAbortController('STANDARD')).toBe(false)
    })

    it('should require AbortController for HEAVY', () => {
      expect(requiresAbortController('HEAVY')).toBe(true)
    })

    it('should require AbortController for EXTREME', () => {
      expect(requiresAbortController('EXTREME')).toBe(true)
    })
  })

  describe('Heartbeat Requirements', () => {
    it('should not require heartbeat for LIGHT', () => {
      expect(requiresHeartbeat('LIGHT')).toBe(false)
    })

    it('should require heartbeat for HEAVY', () => {
      expect(requiresHeartbeat('HEAVY')).toBe(true)
    })
  })

  describe('Profile Pressure Calculation', () => {
    it('should return 0 pressure when at baseline', () => {
      const pressure = calculateProfilePressure(100, PROFILE_CONFIGS.STANDARD)
      expect(pressure).toBe(0)
    })

    it('should calculate positive pressure for above baseline', () => {
      const pressure = calculateProfilePressure(200, PROFILE_CONFIGS.STANDARD)
      expect(pressure).toBe(1) // 200/100 - 1 = 1
    })

    it('should return 0 for below baseline (no negative pressure)', () => {
      const pressure = calculateProfilePressure(50, PROFILE_CONFIGS.STANDARD)
      expect(pressure).toBe(0) // Below baseline is fine
    })

    it('should scale relative to baseline', () => {
      const lightPressure = calculateProfilePressure(50, PROFILE_CONFIGS.LIGHT)
      const heavyPressure = calculateProfilePressure(50, PROFILE_CONFIGS.HEAVY)

      // 50ms is 5x over LIGHT baseline (10ms), so pressure = 4
      expect(lightPressure).toBe(4)
      // 50ms is well under HEAVY baseline (5000ms), so pressure = 0
      expect(heavyPressure).toBe(0)
    })
  })

  describe('Route Profile Registry', () => {
    it('should default to STANDARD for unknown routes', () => {
      expect(getRouteProfile('unknown/route')).toBe('STANDARD')
    })

    it('should store and retrieve route profiles', () => {
      setRouteProfile('test/heavy', 'HEAVY')
      expect(getRouteProfile('test/heavy')).toBe('HEAVY')
      clearRouteProfiles()
    })

    it('should clear all route profiles', () => {
      setRouteProfile('test/a', 'LIGHT')
      setRouteProfile('test/b', 'EXTREME')
      clearRouteProfiles()
      expect(getRouteProfile('test/a')).toBe('STANDARD')
      expect(getRouteProfile('test/b')).toBe('STANDARD')
    })
  })
})
