/**
 * Atrion Wrapper Class (v1.1)
 *
 * Minimal class wrapper for integrating Atrion into applications.
 * Provides canAccept/reportOutcome pattern for request lifecycle.
 *
 * Copy this file and customize for your needs.
 *
 * NOTE: This example uses relative imports for repo compilation.
 * In your project, replace with: import { ... } from 'atrion'
 */

import {
  createBootstrapState,
  DEFAULT_CONFIG,
  DEFAULT_SLO,
  deriveWeights,
  normalizeTelemetry,
  updatePhysics,
  type NormalizedPressure,
  type PhysicsConfig,
  type PhysicsObserver,
  type PressureVector,
  type RouteState,
  type SensitivityWeights,
  type SLOConfig,
  type Timestamp,
} from '../src/core/index.js'

/**
 * Raw telemetry from your application
 */
export interface Telemetry {
  /** Response latency in milliseconds */
  latencyMs: number
  /** Whether this request resulted in an error (5xx) */
  isError: boolean
  /** Optional: Queue depth / concurrent requests (0-1 normalized) */
  saturation?: number
}

/**
 * Atrion Guard - Per-route traffic admission control.
 *
 * @example
 * const guard = new AtrionGuard()
 *
 * // Before handling request
 * if (!guard.canAccept('api/users')) {
 *   return res.status(503).json({ error: 'Service unavailable' })
 * }
 *
 * // After request completes
 * guard.reportOutcome('api/users', { latencyMs: 45, isError: false })
 */
export class AtrionGuard {
  private states = new Map<string, RouteState>()
  private readonly config: PhysicsConfig
  private readonly weights: SensitivityWeights
  private readonly observer?: PhysicsObserver

  // Baselines for normalization (derived from SLO)
  private readonly baselineLatencyMs: number
  private readonly targetErrorRate: number
  private readonly baselineSaturation: number

  constructor(options?: {
    slo?: SLOConfig
    config?: Partial<PhysicsConfig>
    observer?: PhysicsObserver
  }) {
    const slo = options?.slo ?? DEFAULT_SLO

    // Merge user config with defaults
    this.config = { ...DEFAULT_CONFIG, ...options?.config }
    this.weights = deriveWeights(slo)
    this.observer = options?.observer

    // Store baselines for proper normalization
    this.baselineLatencyMs = slo.baselineLatencyMs
    this.targetErrorRate = slo.targetErrorRate
    this.baselineSaturation = 0.5 // 50% saturation as baseline
  }

  /**
   * Check if a route can accept traffic.
   *
   * Call this BEFORE processing a request.
   *
   * @param routeId - Unique identifier for the route (e.g., 'GET:/api/users')
   * @returns true if route is healthy, false if shedding
   */
  canAccept(routeId: string): boolean {
    const state = this.getOrCreateState(routeId)

    // Hard rejection: Circuit breaker is open
    if (state.mode === 'CIRCUIT_BREAKER') {
      return false
    }

    // Soft rejection: Resistance approaching break threshold (80%)
    const softThreshold = this.config.baseResistance * this.config.breakMultiplier * 0.8
    if (state.resistance > softThreshold) {
      return false
    }

    return true
  }

  /**
   * Report request outcome to update physics.
   *
   * Call this AFTER request completes (success or error).
   *
   * @param routeId - Same identifier used in canAccept()
   * @param telemetry - Request telemetry (raw values, normalization handled internally)
   */
  reportOutcome(routeId: string, telemetry: Telemetry): void {
    const state = this.getOrCreateState(routeId)
    const now = Date.now() as Timestamp

    // Normalize raw telemetry to pressure vector using SLO-derived baselines
    // normalizeTelemetry handles the conversion from raw ms to [-1, 1] range
    const pressure: PressureVector = normalizeTelemetry(
      telemetry.latencyMs,
      telemetry.isError ? 1.0 : 0.0,
      telemetry.saturation ?? 0,
      {
        latencyMs: this.baselineLatencyMs,
        errorRate: this.targetErrorRate,
        saturation: this.baselineSaturation,
      }
    )

    // Update physics engine
    const nextState = updatePhysics(state, pressure, this.weights, this.config, now, this.observer)

    this.states.set(routeId, nextState)
  }

  /**
   * Get current state for a route (for debugging/monitoring)
   */
  getState(routeId: string): RouteState | undefined {
    return this.states.get(routeId)
  }

  /**
   * Get current resistance for a route
   */
  getResistance(routeId: string): number {
    return this.states.get(routeId)?.resistance ?? this.config.baseResistance
  }

  /**
   * Get current mode for a route
   */
  getMode(routeId: string): string {
    return this.states.get(routeId)?.mode ?? 'BOOTSTRAP'
  }

  /**
   * Create initial state for a new route
   */
  private getOrCreateState(routeId: string): RouteState {
    if (!this.states.has(routeId)) {
      // Zero pressure - no stress at initialization
      const zeroPressure: PressureVector = {
        latency: 0 as NormalizedPressure,
        error: 0 as NormalizedPressure,
        saturation: 0 as NormalizedPressure,
      }

      this.states.set(
        routeId,
        createBootstrapState(routeId, zeroPressure, this.config, Date.now() as Timestamp)
      )
    }
    return this.states.get(routeId)!
  }
}
