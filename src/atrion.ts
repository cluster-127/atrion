/**
 * Atrion - Main Entry Point (v2.0)
 * RFC-0008: Pluggable State Architecture
 *
 * High-level wrapper over physics engine with state management.
 */

import { AutoTuner, DEFAULT_AUTOTUNER_CONFIG, type AutoTunerConfig } from './core/auto-tuner.js'
import { DEFAULT_CONFIG, DEFAULT_SLO, deriveBaselines, deriveWeights } from './core/config.js'
import { normalizeTelemetry } from './core/normalize.js'
import { createBootstrapState, updatePhysics } from './core/physics.js'
import { StateManager } from './core/state/manager.js'
import { InMemoryProvider } from './core/state/providers/inmemory.js'
import type { PhysicsVector, StateProvider } from './core/state/types.js'
import type {
  Ohms,
  PhysicsConfig,
  PhysicsObserver,
  RouteState,
  SLOConfig,
  Timestamp,
} from './core/types.js'
import { isWasmAvailable } from './core/wasm/loader.js'

// ============================================================================
// TELEMETRY INPUT
// ============================================================================

/**
 * Raw telemetry from service instrumentation.
 */
export interface Telemetry {
  /** Response latency in milliseconds */
  latencyMs: number
  /** Error rate [0, 1] */
  errorRate?: number
  /** Resource saturation [0, 1] */
  saturation?: number
}

// ============================================================================
// ROUTE DECISION
// ============================================================================

/**
 * Decision returned by route() method.
 */
export interface RouteDecision {
  /** Whether request should proceed */
  readonly allow: boolean
  /** Current resistance (Ohms) */
  readonly resistance: Ohms
  /** Current operational mode */
  readonly mode: RouteState['mode']
  /** Human-readable reason */
  readonly reason: string
}

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Atrion constructor options.
 */
export interface AtrionOptions {
  /** State provider (default: InMemoryProvider) */
  provider?: StateProvider

  /** AutoTuner config or boolean (default: true) */
  autoTuner?: AutoTunerConfig | boolean

  /** Physics configuration override */
  config?: Partial<PhysicsConfig>

  /** SLO configuration for weight derivation */
  slo?: SLOConfig

  /** Observer for telemetry events */
  observer?: PhysicsObserver

  /**
   * Use WASM physics engine (experimental)
   *
   * Enables Rust/WASM physics core for 1000x performance improvement.
   * Requires browser/Node.js with WebAssembly support.
   *
   * @default false
   * @experimental v2.0-alpha
   */
  useWasm?: boolean

  /** Default voltage for requests (default: 100) */
  defaultVoltage?: number
}

// ============================================================================
// ATRION CLASS
// ============================================================================

/**
 * Main Atrion class.
 *
 * Wraps the physics engine with state management and convenient API.
 *
 * @example
 * ```typescript
 * const atrion = new Atrion()
 * await atrion.connect()
 *
 * const decision = atrion.route('api/checkout', { latencyMs: 45 })
 * if (!decision.allow) {
 *   return res.status(503).json({ error: decision.reason })
 * }
 * ```
 */
export class Atrion {
  private readonly manager: StateManager
  private readonly autoTuner: AutoTuner | undefined
  private readonly config: PhysicsConfig
  private readonly slo: SLOConfig
  private readonly observer?: PhysicsObserver
  private readonly defaultVoltage: number
  private readonly useWasm: boolean
  private wasmEngine: any = null // PhysicsEngine from WASM

  // Cached derived values
  private readonly weights: ReturnType<typeof deriveWeights>
  private readonly baselines: ReturnType<typeof deriveBaselines>

  // Route states (hot path)
  private readonly states: Map<string, RouteState> = new Map()

  constructor(options: AtrionOptions = {}) {
    // Provider & manager
    const provider = options.provider ?? new InMemoryProvider()
    this.manager = new StateManager(provider)

    // Config
    this.config = { ...DEFAULT_CONFIG, ...options.config }
    this.slo = options.slo ?? DEFAULT_SLO
    this.observer = options.observer
    this.defaultVoltage = options.defaultVoltage ?? 100

    // WASM (experimental v2.0-alpha)
    this.useWasm = options.useWasm === true && isWasmAvailable()
    if (options.useWasm && !isWasmAvailable()) {
      console.warn(
        'Atrion: WASM requested but WebAssembly not available. Falling back to TypeScript engine.',
      )
    }

    // Derived values
    this.weights = deriveWeights(this.slo)
    this.baselines = deriveBaselines(this.slo)

    // AutoTuner
    if (options.autoTuner === false) {
      this.autoTuner = undefined
    } else if (options.autoTuner === true || options.autoTuner === undefined) {
      this.autoTuner = new AutoTuner(DEFAULT_AUTOTUNER_CONFIG)
    } else {
      this.autoTuner = new AutoTuner(options.autoTuner)
    }
  }

  /**
   * Connect to state provider.
   * Must be called before using route().
   */
  async connect(): Promise<void> {
    await this.manager.connect()

    // Initialize WASM engine if enabled
    if (this.useWasm && !this.wasmEngine) {
      try {
        const { initWasm } = await import('./core/wasm/loader.js')
        this.wasmEngine = await initWasm(this.config, this.weights)
        console.log('Atrion: WASM physics engine initialized (v2.0-alpha)')
      } catch (error) {
        console.error('Atrion: WASM initialization failed, falling back to TypeScript:', error)
        // wasmEngine remains null, will use TypeScript fallback
      }
    }
  }

  /**
   * Disconnect from state provider.
   * Flushes cached state before disconnecting.
   */
  async disconnect(): Promise<void> {
    await this.manager.flushToProvider()
    await this.manager.disconnect()
  }

  /**
   * Make routing decision for a request.
   *
   * @param routeId - Route identifier (e.g., 'api/checkout')
   * @param telemetry - Current telemetry readings
   * @param voltage - Request priority (default: 100)
   * @returns Decision with allow/deny and resistance
   */
  route(routeId: string, telemetry: Telemetry, voltage?: number): RouteDecision {
    const now = Date.now() as Timestamp
    const V = voltage ?? this.defaultVoltage

    // Normalize telemetry
    const pressure = normalizeTelemetry(
      telemetry.latencyMs,
      telemetry.errorRate ?? 0,
      telemetry.saturation ?? 0,
      this.baselines,
      this.config.tanhScale,
    )

    // Get or create state
    let state = this.states.get(routeId)
    if (!state) {
      state = createBootstrapState(routeId, pressure, this.config, now)
      this.states.set(routeId, state)
    }

    // Update physics
    const newState = updatePhysics(
      state,
      pressure,
      this.weights,
      this.config,
      now,
      this.observer,
      this.autoTuner,
    )
    this.states.set(routeId, newState)

    // Sync to provider (fire-and-forget)
    this.syncToProvider(routeId, newState)

    // Make decision: V > R
    const R = newState.resistance
    const allow = newState.mode !== 'CIRCUIT_BREAKER' && V > R

    return {
      allow,
      resistance: R,
      mode: newState.mode,
      reason: this.deriveReason(newState, V),
    }
  }

  /**
   * Get current state for a route.
   */
  getState(routeId: string): RouteState | undefined {
    return this.states.get(routeId)
  }

  /**
   * Get all tracked route IDs.
   */
  getRoutes(): string[] {
    return [...this.states.keys()]
  }

  /**
   * Get AutoTuner statistics (if enabled).
   */
  getTunerStats() {
    return this.autoTuner?.getStats()
  }

  /**
   * Reset state for a route.
   */
  async resetRoute(routeId: string): Promise<void> {
    this.states.delete(routeId)
    await this.manager.delete(routeId)
  }

  /**
   * Provider name for debugging.
   */
  get providerName(): string {
    return this.manager.providerName
  }

  /**
   * Check if connected.
   */
  get isConnected(): boolean {
    return this.manager.isConnected
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private syncToProvider(routeId: string, state: RouteState): void {
    const vector: PhysicsVector = {
      scar: state.scarTissue,
      momentumScalar: state.mode !== 'BOOTSTRAP' ? (state.momentum as number) : 0,
      lastTick: state.tickCount,
      resistance: state.resistance,
    }
    this.manager.update(routeId, vector)
  }

  private deriveReason(state: RouteState, voltage: number): string {
    if (state.mode === 'CIRCUIT_BREAKER') {
      return 'Circuit breaker open'
    }
    if (voltage <= state.resistance) {
      return `Insufficient voltage: V=${voltage} ≤ R=${state.resistance.toFixed(1)}Ω`
    }
    return 'OK'
  }
}
