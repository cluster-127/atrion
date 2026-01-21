/**
 * Redis State Provider
 * RFC-0008: Pluggable State Architecture
 *
 * Basic pub/sub sync with Last-Write-Wins conflict resolution.
 * "Stores truth, but doesn't understand."
 *
 * NOTE: This is the open-source provider. For smart conflict resolution
 * (Gamma Blending), consider Atrion Cloud.
 *
 * @requires ioredis as peer dependency
 */

import { ConnectionError, DependencyError } from '../../errors.js'
import type { PhysicsVector, StateProvider } from '../types.js'

/**
 * Redis connection options.
 */
export interface RedisOptions {
  /** Redis connection URL or host */
  url?: string
  host?: string
  port?: number
  password?: string
  /** Key prefix for Atrion state (default: 'atrion:') */
  keyPrefix?: string
  /** PubSub channel for state updates (default: 'atrion:sync') */
  channel?: string
}

// Dynamic import type for ioredis (peer dependency)
type RedisClient = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  del(key: string): Promise<number>
  keys(pattern: string): Promise<string[]>
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string): Promise<void>
  on(event: 'message', callback: (channel: string, message: string) => void): void
  quit(): Promise<string>
  duplicate(): RedisClient
}

/**
 * Redis State Provider with basic pub/sub sync.
 *
 * Features:
 * - Durable: State survives process restart
 * - Deterministic: Last-Write-Wins based on lastTick
 * - Predictable: No adaptive logic
 *
 * Limitations (by design):
 * - No conflict resolution (LWW only)
 * - No epistemic weighting
 * - No self-correction
 *
 * For smart sync, see Atrion Cloud.
 */
export class RedisStateProvider implements StateProvider {
  readonly name = 'RedisStateProvider'

  private readonly options: Required<Pick<RedisOptions, 'keyPrefix' | 'channel'>> & RedisOptions
  private client: RedisClient | null = null
  private subscriber: RedisClient | null = null
  private subscriptions: Map<string, (vector: PhysicsVector) => void> = new Map()

  constructor(options: RedisOptions = {}) {
    this.options = {
      ...options,
      keyPrefix: options.keyPrefix ?? 'atrion:state:',
      channel: options.channel ?? 'atrion:sync',
    }
  }

  /**
   * Ensure client is connected, throw if not.
   */
  private ensureConnected(): RedisClient {
    if (!this.client) {
      throw new ConnectionError(this.name)
    }
    return this.client
  }

  async connect(): Promise<void> {
    // Dynamic import ioredis (peer dependency)
    let RedisConstructor: any
    try {
      const ioredis = await import('ioredis')
      RedisConstructor = ioredis.default ?? ioredis
    } catch {
      throw new DependencyError('ioredis', 'npm install ioredis')
    }

    // Create client
    this.client = new RedisConstructor(
      this.options.url ?? {
        host: this.options.host ?? 'localhost',
        port: this.options.port ?? 6379,
        password: this.options.password,
      },
    ) as RedisClient

    // Create subscriber for pub/sub
    this.subscriber = this.client.duplicate()
    await this.subscriber.subscribe(this.options.channel)

    // Handle incoming sync messages
    this.subscriber.on('message', (_channel, message) => {
      try {
        const { routeId, vector } = JSON.parse(message) as {
          routeId: string
          vector: PhysicsVector
        }
        const callback = this.subscriptions.get(routeId)
        if (callback) {
          callback(vector)
        }
      } catch {
        // Ignore malformed messages - graceful degradation
      }
    })
  }

  async disconnect(): Promise<void> {
    this.subscriptions.clear()
    if (this.subscriber) {
      await this.subscriber.quit()
      this.subscriber = null
    }
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }

  async getVector(routeId: string): Promise<PhysicsVector | null> {
    const client = this.ensureConnected()
    const key = this.options.keyPrefix + routeId
    const data = await client.get(key)

    if (!data) return null

    try {
      return JSON.parse(data) as PhysicsVector
    } catch {
      return null // Graceful degradation for malformed data
    }
  }

  async updateVector(routeId: string, vector: PhysicsVector): Promise<void> {
    const client = this.ensureConnected()
    const key = this.options.keyPrefix + routeId
    const data = JSON.stringify(vector)

    // Store in Redis
    await client.set(key, data)

    // Publish to other nodes (fire-and-forget)
    await client.publish(this.options.channel, JSON.stringify({ routeId, vector }))
  }

  async deleteVector(routeId: string): Promise<void> {
    const client = this.ensureConnected()
    const key = this.options.keyPrefix + routeId
    await client.del(key)
  }

  async listRoutes(): Promise<string[]> {
    const client = this.ensureConnected()
    const keys = await client.keys(this.options.keyPrefix + '*')
    return keys.map((key) => key.slice(this.options.keyPrefix.length))
  }

  /**
   * Subscribe to remote state changes.
   * Callback fires when another node updates this route.
   *
   * Note: This is basic pub/sub - no conflict resolution.
   * Last write wins based on timestamp.
   */
  subscribe(routeId: string, callback: (vector: PhysicsVector) => void): () => void {
    this.subscriptions.set(routeId, callback)
    return () => {
      this.subscriptions.delete(routeId)
    }
  }
}
