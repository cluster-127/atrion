/**
 * In-Memory State Provider
 * RFC-0008: Pluggable State Architecture
 *
 * Default provider for single-process deployments.
 * Zero dependencies, synchronous operations wrapped in Promise for interface.
 */

import type { PhysicsVector, StateProvider } from '../types.js'

/**
 * Options for InMemoryProvider.
 */
export interface InMemoryOptions {
  /**
   * Maximum number of routes to store.
   * When exceeded, oldest routes are evicted (LRU).
   * Default: no limit (undefined).
   */
  maxRoutes?: number
}

/**
 * In-memory state provider using Map storage with optional LRU eviction.
 *
 * Features:
 * - Zero network latency
 * - No external dependencies
 * - State lost on process restart
 * - Optional LRU eviction for memory management
 *
 * Use cases:
 * - Single-node deployments
 * - Development and testing
 * - Stateless workers (state per request)
 */
export class InMemoryProvider implements StateProvider {
  readonly name = 'InMemoryProvider'
  private readonly store: Map<string, PhysicsVector> = new Map()
  private readonly maxRoutes: number | undefined
  private connected = false

  constructor(options: InMemoryOptions = {}) {
    this.maxRoutes = options.maxRoutes
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.store.clear()
    this.connected = false
  }

  async getVector(routeId: string): Promise<PhysicsVector | null> {
    const vector = this.store.get(routeId)
    if (vector) {
      // LRU: Move to end (most recently used)
      this.store.delete(routeId)
      this.store.set(routeId, vector)
    }
    return vector ?? null
  }

  async updateVector(routeId: string, vector: PhysicsVector): Promise<void> {
    // LRU eviction if at capacity
    if (this.maxRoutes && this.store.size >= this.maxRoutes && !this.store.has(routeId)) {
      // Delete oldest (first in Map iteration order)
      const oldestKey = this.store.keys().next().value
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }
    this.store.set(routeId, vector)
  }

  async deleteVector(routeId: string): Promise<void> {
    this.store.delete(routeId)
  }

  async listRoutes(): Promise<string[]> {
    return [...this.store.keys()]
  }

  /**
   * Get current number of stored routes.
   */
  get size(): number {
    return this.store.size
  }

  // No subscribe() - single process doesn't need push notifications
}
