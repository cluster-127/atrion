/**
 * In-Memory State Provider
 * RFC-0008: Pluggable State Architecture
 *
 * Default provider for single-process deployments.
 * Zero dependencies, synchronous operations wrapped in Promise for interface.
 */

import type { PhysicsVector, StateProvider } from '../types.js'

/**
 * In-memory state provider using Map storage.
 *
 * Features:
 * - Zero network latency
 * - No external dependencies
 * - State lost on process restart
 *
 * Use cases:
 * - Single-node deployments
 * - Development and testing
 * - Stateless workers (state per request)
 */
export class InMemoryProvider implements StateProvider {
  readonly name = 'InMemoryProvider'
  private readonly store: Map<string, PhysicsVector> = new Map()
  private connected = false

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.store.clear()
    this.connected = false
  }

  async getVector(routeId: string): Promise<PhysicsVector | null> {
    return this.store.get(routeId) ?? null
  }

  async updateVector(routeId: string, vector: PhysicsVector): Promise<void> {
    this.store.set(routeId, vector)
  }

  async deleteVector(routeId: string): Promise<void> {
    this.store.delete(routeId)
  }

  async listRoutes(): Promise<string[]> {
    return [...this.store.keys()]
  }

  // No subscribe() - single process doesn't need push notifications
}
