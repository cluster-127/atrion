/**
 * Atrion Built-in Observers (v1.1)
 * Pre-built PhysicsObserver implementations for common use cases.
 */

import type { PhysicsEvent, PhysicsObserver } from './types.js'

/**
 * Console observer for debugging.
 * Prints emoji-prefixed decision logs with key metrics.
 *
 * @example
 * import { updatePhysics, consoleObserver } from 'atrion'
 * updatePhysics(state, pressure, weights, config, now, consoleObserver)
 * // Output: ✅ [OPER] R:  1.2Ω | M:0.003 | S:0.00
 */
export const consoleObserver: PhysicsObserver = {
  onUpdate(event: PhysicsEvent): void {
    // Decision emoji
    const emoji = event.decision === 'FLOW' ? '✅' : event.decision === 'SHED' ? '🚫' : '🔄'

    // Mode abbreviation (first 4 chars)
    const mode = event.mode.substring(0, 4).toUpperCase()

    // Formatted values
    const r = event.resistance.toFixed(1).padStart(6)
    const m = (event.momentum ?? 0).toFixed(3)
    const s = event.scarTissue.toFixed(2)
    const p = event.pressureMagnitude.toFixed(3)

    // Mode transition indicator
    const transition = event.modeTransition
      ? ` [${event.modeTransition.from} → ${event.modeTransition.to}]`
      : ''

    console.log(`${emoji} [${mode}] R:${r}Ω | M:${m} | S:${s} | P:${p}${transition}`)
  },
}

/**
 * Silent observer for benchmarking.
 * Has zero output, useful for measuring observer overhead.
 */
export const silentObserver: PhysicsObserver = {
  onUpdate(_event: PhysicsEvent): void {
    // Intentionally empty - for benchmarking observer overhead
  },
}

/**
 * Creates a composite observer that fans out to multiple observers.
 * Useful for sending telemetry to multiple destinations simultaneously.
 *
 * @example
 * const observer = createCompositeObserver(
 *   consoleObserver,
 *   metricsObserver,
 *   fileObserver
 * )
 */
export function createCompositeObserver(...observers: PhysicsObserver[]): PhysicsObserver {
  return {
    onUpdate(event: PhysicsEvent): void {
      for (const observer of observers) {
        observer.onUpdate(event)
      }
    },
  }
}

/**
 * Creates a filtering observer that only calls the inner observer
 * when the predicate returns true.
 *
 * @example
 * // Only log when shedding traffic
 * const shedOnlyObserver = createFilteredObserver(
 *   consoleObserver,
 *   (event) => event.decision === 'SHED'
 * )
 */
export function createFilteredObserver(
  inner: PhysicsObserver,
  predicate: (event: PhysicsEvent) => boolean
): PhysicsObserver {
  return {
    onUpdate(event: PhysicsEvent): void {
      if (predicate(event)) {
        inner.onUpdate(event)
      }
    },
  }
}

/**
 * Creates an observer that collects events into an array.
 * Useful for testing and replay scenarios.
 *
 * @example
 * const events: PhysicsEvent[] = []
 * const collector = createCollectorObserver(events)
 */
export function createCollectorObserver(collection: PhysicsEvent[]): PhysicsObserver {
  return {
    onUpdate(event: PhysicsEvent): void {
      collection.push(event)
    },
  }
}
