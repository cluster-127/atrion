/**
 * Atrion Clock Interface
 * Provides time abstraction for deterministic testing.
 */

import type { DeltaTime, Timestamp } from './types.js'

/**
 * Clock interface for time abstraction
 */
export interface Clock {
  now(): Timestamp
}

/**
 * Virtual clock for deterministic simulation
 * Time advances only when explicitly called
 */
export class VirtualClock implements Clock {
  private tick: number

  constructor(initialTick: number = 0) {
    this.tick = initialTick
  }

  now(): Timestamp {
    return this.tick as Timestamp
  }

  advance(delta: number = 1): void {
    this.tick += delta
  }

  set(tick: number): void {
    this.tick = tick
  }

  deltaFrom(previous: Timestamp): DeltaTime {
    return (this.tick - previous) as DeltaTime
  }
}

/**
 * Real clock for production use
 */
export class RealClock implements Clock {
  now(): Timestamp {
    return Date.now() as Timestamp
  }

  deltaFrom(previous: Timestamp): DeltaTime {
    return (Date.now() - previous) as DeltaTime
  }
}
