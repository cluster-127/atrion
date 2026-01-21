/**
 * Atrion State Module
 * RFC-0008: Pluggable State Architecture
 */

// Types
export type { ConflictStrategy, PhysicsVector, StateProvider } from './types.js'

// Manager
export { StateManager } from './manager.js'

// Providers (re-exported from providers/)
export { InMemoryProvider } from './providers/inmemory.js'
export { RedisStateProvider } from './providers/redis.js'
export type { RedisOptions } from './providers/redis.js'
