/**
 * Atrion State Manager
 * RFC-0008: Pluggable State Architecture
 *
 * Manages local cache with async provider sync.
 * Fast path reads from cache, background syncs to provider.
 */

import type { PhysicsVector, StateProvider } from './types.js'

/**
 * State Manager with local cache.
 *
 * Design principle: Local cache is authoritative for reads.
 * Provider sync happens asynchronously in background.
 *
 * This prevents network latency from affecting physics calculations
 * while still enabling cluster-wide state sharing.
 */
export class StateManager {
  private readonly provider: StateProvider
  private readonly cache: Map<string, PhysicsVector> = new Map()
  private connected = false

  constructor(provider: StateProvider) {
    this.provider = provider
  }

  /**
   * Initialize manager and connect to provider.
   */
  async connect(): Promise<void> {
    if (this.connected) return
    await this.provider.connect()
    this.connected = true
  }

  /**
   * Disconnect from provider and clear cache.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.provider.disconnect()
    this.cache.clear()
    this.connected = false
  }

  /**
   * Fast path: Read from local cache (microseconds).
   * Returns null if route not in cache.
   */
  getLocal(routeId: string): PhysicsVector | null {
    return this.cache.get(routeId) ?? null
  }

  /**
   * Check if route exists in local cache.
   */
  hasLocal(routeId: string): boolean {
    return this.cache.has(routeId)
  }

  /**
   * Update local cache and sync to provider.
   * Cache update is synchronous, provider sync is fire-and-forget.
   *
   * @param routeId - Route identifier
   * @param vector - New state vector
   * @param syncToProvider - Whether to sync to provider (default: true)
   */
  update(routeId: string, vector: PhysicsVector, syncToProvider: boolean = true): void {
    // Always update local cache synchronously
    this.cache.set(routeId, vector)

    // Fire-and-forget provider sync (don't await)
    if (syncToProvider && this.connected) {
      this.provider.updateVector(routeId, vector).catch((err) => {
        // Log but don't throw - provider failure shouldn't break physics
        console.warn(`[StateManager] Provider sync failed for ${routeId}:`, err)
      })
    }
  }

  /**
   * Sync a route from provider to local cache.
   * Used for initial load or cache refresh.
   */
  async syncFromProvider(routeId: string): Promise<PhysicsVector | null> {
    if (!this.connected) return null

    const vector = await this.provider.getVector(routeId)
    if (vector) {
      this.cache.set(routeId, vector)
    }
    return vector
  }

  /**
   * Force sync all cached routes to provider.
   * Used for graceful shutdown.
   */
  async flushToProvider(): Promise<void> {
    if (!this.connected) return

    const promises: Promise<void>[] = []
    for (const [routeId, vector] of this.cache) {
      promises.push(this.provider.updateVector(routeId, vector))
    }
    await Promise.allSettled(promises)
  }

  /**
   * Delete route from cache and provider.
   */
  async delete(routeId: string): Promise<void> {
    this.cache.delete(routeId)
    if (this.connected) {
      await this.provider.deleteVector(routeId)
    }
  }

  /**
   * Clear local cache (does not affect provider).
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get all cached route IDs.
   */
  getCachedRoutes(): string[] {
    return [...this.cache.keys()]
  }

  /**
   * Get provider name for debugging.
   */
  get providerName(): string {
    return this.provider.name
  }

  /**
   * Check if manager is connected.
   */
  get isConnected(): boolean {
    return this.connected
  }
}
