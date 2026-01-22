/**
 * Task Lease Management (RFC-0010)
 *
 * Manages long-running task lifecycles with heartbeat and expiration.
 */

import {
  type ProfileConfig,
  type WorkloadProfile,
  getProfileConfig,
  requiresAbortController,
} from './profiles.js'
import type { Timestamp } from './types.js'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for starting a long-running task.
 */
export interface LeaseOptions {
  /** Workload profile (determines baseline expectations) */
  profile: WorkloadProfile | ProfileConfig

  /** Custom timeout in milliseconds (overrides profile default) */
  timeout?: number

  /** AbortController for task termination (REQUIRED for HEAVY/EXTREME) */
  abortController?: AbortController

  /** Custom metadata for observability */
  metadata?: Record<string, unknown>
}

/**
 * Heartbeat payload for updating task progress.
 */
export interface HeartbeatPayload {
  /** Progress 0.0 - 1.0 */
  progress?: number

  /** Current memory usage in bytes */
  memoryBytes?: number

  /** Custom status message */
  status?: string
}

/**
 * Lease outcome when released or expired.
 */
export type LeaseOutcome = 'completed' | 'failed' | 'timeout' | 'aborted'

/**
 * Task lease representing an active long-running task.
 */
export interface TaskLease {
  /** Unique lease identifier */
  readonly id: string

  /** Associated route ID */
  readonly routeId: string

  /** Workload profile */
  readonly profile: WorkloadProfile

  /** Timestamp when lease was acquired */
  readonly startedAt: Timestamp

  /** Timestamp when lease will expire */
  readonly expiresAt: Timestamp

  /** Whether task is still active */
  readonly isActive: boolean

  /** Send heartbeat to keep lease alive */
  heartbeat(payload?: HeartbeatPayload): void

  /** Release lease (must be called when task completes) */
  release(outcome?: LeaseOutcome): Promise<void>

  /** Get remaining time in milliseconds */
  remainingMs(): number
}

// ============================================================================
// LEASE IMPLEMENTATION
// ============================================================================

/**
 * Internal lease state.
 */
interface LeaseState {
  id: string
  routeId: string
  profile: WorkloadProfile
  profileConfig: ProfileConfig
  startedAt: Timestamp
  expiresAt: Timestamp
  lastHeartbeat: Timestamp
  abortController?: AbortController
  isActive: boolean
  outcome?: LeaseOutcome
  progress: number
  onRelease: (lease: LeaseState, outcome: LeaseOutcome) => void
}

/**
 * Create a new task lease.
 */
export function createLease(
  routeId: string,
  options: LeaseOptions,
  onRelease: (lease: LeaseState, outcome: LeaseOutcome) => void,
): TaskLease {
  const profileConfig = getProfileConfig(options.profile)
  const profileName = typeof options.profile === 'string' ? options.profile : 'CUSTOM'

  // Validate AbortController requirement
  if (requiresAbortController(profileName) && !options.abortController) {
    throw new Error(
      `AbortController is required for ${profileName} profile. ` +
        'Long-running tasks must be terminable.',
    )
  }

  const now = Date.now() as Timestamp
  const timeout = options.timeout ?? profileConfig.maxDurationMs
  const expiresAt = (now + timeout) as Timestamp

  const state: LeaseState = {
    id: generateLeaseId(),
    routeId,
    profile: profileName,
    profileConfig,
    startedAt: now,
    expiresAt,
    lastHeartbeat: now,
    abortController: options.abortController,
    isActive: true,
    progress: 0,
    onRelease,
  }

  // Set up expiration timer
  const expirationTimer = setTimeout(() => {
    if (state.isActive) {
      handleExpiration(state)
    }
  }, timeout)

  // Set up heartbeat monitoring for HEAVY/EXTREME
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  if (profileConfig.heartbeatRequired) {
    heartbeatTimer = setInterval(() => {
      checkHeartbeat(state)
    }, profileConfig.heartbeatIntervalMs * 2) // Grace period
  }

  const lease: TaskLease = {
    get id() {
      return state.id
    },
    get routeId() {
      return state.routeId
    },
    get profile() {
      return state.profile
    },
    get startedAt() {
      return state.startedAt
    },
    get expiresAt() {
      return state.expiresAt
    },
    get isActive() {
      return state.isActive
    },

    heartbeat(payload?: HeartbeatPayload): void {
      if (!state.isActive) {
        throw new Error('Cannot heartbeat: lease is no longer active')
      }
      state.lastHeartbeat = Date.now() as Timestamp
      if (payload?.progress !== undefined) {
        state.progress = payload.progress
      }
    },

    async release(outcome: LeaseOutcome = 'completed'): Promise<void> {
      if (!state.isActive) {
        return // Already released
      }

      state.isActive = false
      state.outcome = outcome
      clearTimeout(expirationTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer)

      state.onRelease(state, outcome)
    },

    remainingMs(): number {
      return Math.max(0, state.expiresAt - Date.now())
    },
  }

  return lease
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Generate unique lease ID.
 */
function generateLeaseId(): string {
  return `lease-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Handle lease expiration.
 */
function handleExpiration(state: LeaseState): void {
  if (!state.isActive) return

  state.isActive = false
  state.outcome = 'timeout'

  // Trigger AbortController if available
  if (state.abortController) {
    state.abortController.abort()
  }

  state.onRelease(state, 'timeout')
}

/**
 * Check if heartbeat is stale.
 */
function checkHeartbeat(state: LeaseState): void {
  if (!state.isActive) return

  const heartbeatAge = Date.now() - state.lastHeartbeat
  const maxAge = state.profileConfig.heartbeatIntervalMs * 3 // 3x grace period

  if (heartbeatAge > maxAge) {
    // Heartbeat timeout - treat as abandoned
    handleExpiration(state)
  }
}

// ============================================================================
// LEASE MANAGER
// ============================================================================

/**
 * Active leases by ID.
 */
const activeLeases = new Map<string, TaskLease>()

/**
 * Get active lease by ID.
 */
export function getActiveLease(leaseId: string): TaskLease | undefined {
  return activeLeases.get(leaseId)
}

/**
 * Get all active leases for a route.
 */
export function getLeasesForRoute(routeId: string): TaskLease[] {
  return Array.from(activeLeases.values()).filter(
    (lease) => lease.routeId === routeId && lease.isActive,
  )
}

/**
 * Register a lease (internal use).
 */
export function registerLease(lease: TaskLease): void {
  activeLeases.set(lease.id, lease)
}

/**
 * Unregister a lease (internal use).
 */
export function unregisterLease(leaseId: string): void {
  activeLeases.delete(leaseId)
}

/**
 * Get count of active leases for a route.
 */
export function getActiveLeaseCount(routeId: string): number {
  return getLeasesForRoute(routeId).length
}

/**
 * Clear all leases (for testing).
 */
export function clearAllLeases(): void {
  for (const lease of activeLeases.values()) {
    if (lease.isActive) {
      lease.release('aborted')
    }
  }
  activeLeases.clear()
}
