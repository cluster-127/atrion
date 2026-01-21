/**
 * Atrion - Conditioned Deterministic Orchestration
 * Main entry point
 */

// v1.x API (preserved for backward compatibility)
export * from './core/index.js'

// v2.0 API
export { Atrion } from './atrion.js'
export type { AtrionOptions, RouteDecision, Telemetry } from './atrion.js'

// State module
export { StateManager } from './core/state/index.js'
export type { ConflictStrategy, PhysicsVector, StateProvider } from './core/state/index.js'
export { InMemoryProvider } from './core/state/providers/inmemory.js'
export { RedisStateProvider } from './core/state/providers/redis.js'
export type { RedisOptions } from './core/state/providers/redis.js'
