/**
 * Atrion State Provider Types
 * RFC-0008: Pluggable State Architecture
 *
 * Design principle: "Stores truth, but doesn't understand."
 * Providers are mechanical - adaptive logic belongs in commercial layer.
 */

import type { Ohms, Scar } from '../types.js'

// ============================================================================
// PHYSICS VECTOR (Minimal, as per user review)
// ============================================================================

/**
 * Minimal state vector for cluster synchronization.
 *
 * Design decisions:
 * - `momentumScalar` not full vector (RFC-0004 compliant)
 * - `lastTick` is engine tick count, not wall clock (avoids clock skew)
 * - No derived values (resistance computed locally)
 */
export interface PhysicsVector {
  /** Accumulated historical trauma */
  readonly scar: Scar

  /** Momentum magnitude (scalar, not vector) */
  readonly momentumScalar: number

  /** Engine tick count at last update (not wall clock) */
  readonly lastTick: number

  /** Last computed resistance (for observability only) */
  readonly resistance: Ohms
}

// ============================================================================
// STATE PROVIDER INTERFACE
// ============================================================================

/**
 * Storage abstraction for physics state.
 *
 * Implementations:
 * - InMemoryProvider (default, free) - Map-based, single process
 * - RedisStateProvider (free) - Basic pub/sub, LWW conflict resolution
 * - ClusterProvider (commercial) - Gamma blending, adaptive sync
 *
 * Contract:
 * - `connect()` must be called before use
 * - `disconnect()` must be called on shutdown
 * - All operations are async (even InMemory, for interface consistency)
 * - `subscribe()` is optional (not all providers support push)
 */
export interface StateProvider {
  /** Provider name for debugging */
  readonly name: string

  /**
   * Initialize provider and establish connections.
   * Must be called before any other operations.
   */
  connect(): Promise<void>

  /**
   * Cleanup resources on shutdown.
   * Safe to call multiple times.
   */
  disconnect(): Promise<void>

  /**
   * Retrieve state vector for a route.
   * Returns null if route has no state (cold start).
   */
  getVector(routeId: string): Promise<PhysicsVector | null>

  /**
   * Persist state vector update.
   * Implementation decides sync vs async write behavior.
   */
  updateVector(routeId: string, vector: PhysicsVector): Promise<void>

  /**
   * Delete state for a route.
   * Used for cleanup and testing.
   */
  deleteVector(routeId: string): Promise<void>

  /**
   * List all known route IDs.
   * May be expensive for large state sets.
   */
  listRoutes(): Promise<string[]>

  /**
   * Subscribe to remote state changes (optional).
   * Only implemented by providers that support push notifications.
   *
   * @returns Unsubscribe function
   */
  subscribe?(routeId: string, callback: (vector: PhysicsVector) => void): () => void
}

// ============================================================================
// CONFLICT RESOLUTION (Documentation)
// ============================================================================

/**
 * Conflict Resolution Strategies
 *
 * InMemoryProvider:
 * - No conflicts (single process)
 *
 * RedisStateProvider (open-source):
 * - Last-Write-Wins (LWW) based on lastTick
 * - Deterministic, predictable, but NOT adaptive
 * - "Stores truth, but doesn't understand"
 *
 * ClusterProvider (commercial):
 * - Gamma Blending: S_merged = γ × S_cluster + (1 - γ) × S_local
 * - Epistemic weighting based on observation confidence
 * - Self-correcting over time
 */
export type ConflictStrategy = 'LWW' | 'GAMMA_BLEND'
