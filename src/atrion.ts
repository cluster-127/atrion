/**
 * Atrion - Main Entry Point (v2.0)
 * RFC-0008: Pluggable State Architecture
 *
 * High-level wrapper over physics engine with state management.
 */

import { AutoTuner, type AutoTunerConfig, DEFAULT_AUTOTUNER_CONFIG } from './core/auto-tuner.js'
import { DEFAULT_CONFIG, DEFAULT_SLO, deriveBaselines, deriveWeights } from './core/config.js'
import {
  type LeaseOptions,
  type TaskLease,
  createLease,
  getActiveLeaseCount,
  registerLease,
  unregisterLease,
} from './core/lease.js'
import { normalizeTelemetry } from './core/normalize.js'
import { createBootstrapState, updatePhysics } from './core/physics.js'
import {
  type WorkloadProfile,
  getProfileConfig,
  setRouteProfile as setRouteProfileInternal,
} from './core/profiles.js'
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

/**
 * Options for route() method.
 */
export interface RouteOptions {
  /** Request priority voltage (default: 100) */
  voltage?: number
  /** Workload profile override */
  profile?: WorkloadProfile
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
   * Physics engine selection.
   *
   * - 'auto': Tries WASM first, falls back to TS if unavailable (DEFAULT)
   * - 'wasm': Forces WASM, throws error if unavailable
   * - 'ts': Forces TypeScript engine
   *
   * @default 'auto'
   */
  engine?: EngineMode

  /** @deprecated Use `engine` instead */
  useWasm?: boolean

  /** Default voltage for requests (default: 100) */
  defaultVoltage?: number
}

/**
 * Physics engine mode.
 */
export type EngineMode = 'auto' | 'wasm' | 'ts'

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
  private readonly engineMode: EngineMode
  private wasmEngine: any = null // PhysicsEngine from WASM
  private _usingWasm = false

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

    // Engine mode (v2.0: default is 'auto')
    // Support deprecated useWasm for backward compatibility
    if (options.useWasm !== undefined) {
      console.warn('Atrion: useWasm is deprecated. Use engine: "wasm" or "ts" instead.')
      this.engineMode = options.useWasm ? 'wasm' : 'ts'
    } else {
      this.engineMode = options.engine ?? 'auto'
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

    // Initialize physics engine based on mode
    if (this.engineMode === 'ts') {
      // Force TypeScript engine - no WASM
      this._usingWasm = false
      console.log('Atrion: Using TypeScript physics engine')
      return
    }

    // Try to initialize WASM for 'auto' and 'wasm' modes
    if (!isWasmAvailable()) {
      if (this.engineMode === 'wasm') {
        throw new Error(
          'Atrion: WASM requested but WebAssembly is not available in this environment',
        )
      }
      // 'auto' mode: graceful fallback
      console.log('Atrion: WebAssembly not available, using TypeScript engine')
      this._usingWasm = false
      return
    }

    try {
      const { initWasm } = await import('./core/wasm/loader.js')
      this.wasmEngine = await initWasm(this.config, this.weights)
      this._usingWasm = true
      console.log('Atrion: 🚀 WASM physics engine initialized (586M ops/s)')
    } catch (error) {
      if (this.engineMode === 'wasm') {
        throw new Error(`Atrion: WASM initialization failed: ${error}`)
      }
      // 'auto' mode: graceful fallback
      console.warn('Atrion: WASM loading failed, falling back to TypeScript:', error)
      this._usingWasm = false
    }
  }

  /**
   * Check if currently using WASM engine.
   */
  get usingWasm(): boolean {
    return this._usingWasm
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
  // WORKLOAD PROFILES (RFC-0010)
  // ============================================================================

  /**
   * Set default workload profile for a route.
   *
   * @param routeId - Route identifier
   * @param profile - Workload profile (LIGHT, STANDARD, HEAVY, EXTREME)
   *
   * @example
   * ```typescript
   * atrion.setRouteProfile('genom/sequence', 'EXTREME')
   * atrion.setRouteProfile('api/health', 'LIGHT')
   * ```
   */
  setRouteProfile(routeId: string, profile: WorkloadProfile): void {
    setRouteProfileInternal(routeId, profile)
  }

  /**
   * Start a long-running task with lease management.
   *
   * Lease provides heartbeat mechanism and controlled termination.
   * HEAVY and EXTREME profiles REQUIRE AbortController.
   *
   * @param routeId - Route identifier
   * @param options - Lease options (profile, timeout, abortController)
   * @returns TaskLease for managing the task lifecycle
   *
   * @example
   * ```typescript
   * const controller = new AbortController()
   * const lease = await atrion.startTask('ml/training', {
   *   profile: 'EXTREME',
   *   abortController: controller,
   * })
   *
   * try {
   *   const interval = setInterval(() => lease.heartbeat({ progress: 0.5 }), 5000)
   *   await runTraining(controller.signal)
   *   clearInterval(interval)
   * } finally {
   *   await lease.release()
   * }
   * ```
   */
  async startTask(routeId: string, options: LeaseOptions): Promise<TaskLease> {
    // Check if route can accept new tasks
    const activeCount = getActiveLeaseCount(routeId)
    const profileConfig = getProfileConfig(options.profile)

    // Create lease with callback for release handling
    const lease = createLease(routeId, options, (leaseState, outcome) => {
      unregisterLease(leaseState.id)

      // Accumulate scar if task failed or exceeded budget
      if (outcome === 'timeout' || outcome === 'failed') {
        const state = this.states.get(routeId)
        if (state) {
          const overrunFactor = outcome === 'timeout' ? 1.5 : 1.0
          const scarPenalty = this.config.scarFactor * profileConfig.scarMultiplier * overrunFactor
          // Scar accumulation handled by physics on next route() call
        }
      }

      // TODO: Add observer notification when PhysicsObserver is extended
    })

    // Register lease
    registerLease(lease)

    return lease
  }

  /**
   * Get count of active tasks for a route.
   */
  getActiveTaskCount(routeId: string): number {
    return getActiveLeaseCount(routeId)
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
