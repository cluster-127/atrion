/**
 * Atrion Core Type Definitions v1.1
 * Based on RFC-0004: Implementation Guidelines
 * Refined based on peer review.
 */

// ============================================================================
// 1. BRANDED PRIMITIVES
// ============================================================================

declare const __brand: unique symbol
type Brand<B> = { [__brand]: B }

/**
 * System Clock Timestamp (Absolute Time)
 * Not to be confused with DeltaTime.
 */
export type Timestamp = number & Brand<'Timestamp'>

/**
 * Time delta in milliseconds or ticks
 * Domain: (0, ∞)
 */
export type DeltaTime = number & Brand<'DeltaTime'>

/**
 * Request Priority / Potential Energy
 * Domain: [0, ∞)
 */
export type Volts = number & Brand<'Volts'>

/**
 * Impedance / Total Resistance
 * Domain: [0, ∞)
 */
export type Ohms = number & Brand<'Ohms'>

/**
 * Normalized Pressure Component
 * Generated via tanh normalization.
 * Domain: [-1, 1]
 */
export type NormalizedPressure = number & Brand<'Pressure'>

/**
 * Rate of change in pressure per tick
 * Domain: [0, ∞)
 */
export type Momentum = number & Brand<'Momentum'>

/**
 * Accumulated historical trauma
 * Domain: [0, ∞)
 */
export type Scar = number & Brand<'Scar'>

// ============================================================================
// 2. VECTOR DEFINITIONS
// ============================================================================

/**
 * 3D Vector representing system stress.
 * All components are normalized via tanh.
 */
export interface PressureVector {
  readonly latency: NormalizedPressure
  readonly error: NormalizedPressure
  readonly saturation: NormalizedPressure
}

/**
 * Diagonal Weight Matrix for Sensitivity
 * Derived from SLOs via log transform.
 */
export interface SensitivityWeights {
  readonly wLatency: number
  readonly wError: number
  readonly wSaturation: number
}

// ============================================================================
// 3. STATE MACHINE (Discriminated Unions)
// ============================================================================

export type OperationalMode = 'BOOTSTRAP' | 'OPERATIONAL' | 'CIRCUIT_BREAKER'

/**
 * Common fields present in all states
 */
interface BaseRouteState {
  readonly routeId: string
  readonly mode: OperationalMode
  readonly pressure: PressureVector
  readonly scarTissue: Scar
  readonly resistance: Ohms
  readonly lastUpdatedAt: Timestamp
}

/**
 * BOOTSTRAP: Observer Mode
 * Gathering baseline data. No momentum calculation yet.
 */
export interface BootstrapState extends BaseRouteState {
  readonly mode: 'BOOTSTRAP'
  readonly tickCount: number
  readonly momentum: undefined
  readonly previousPressure: undefined
}

/**
 * OPERATIONAL: Full Physics Mode
 * Ohm's law active, Momentum active.
 */
export interface OperationalState extends BaseRouteState {
  readonly mode: 'OPERATIONAL'
  readonly tickCount: number
  readonly momentum: Momentum
  readonly previousPressure: PressureVector
}

/**
 * CIRCUIT_BREAKER: Safety Valve
 * Hard cutoff. Waiting for recovery conditions.
 */
export interface CircuitBreakerState extends BaseRouteState {
  readonly mode: 'CIRCUIT_BREAKER'
  readonly tickCount: number
  readonly momentum: Momentum
  readonly previousPressure: PressureVector
  readonly recoveryStartedAt: Timestamp
}

/**
 * Union of all possible route states.
 * Use type narrowing via `state.mode` for safe access.
 */
export type RouteState = BootstrapState | OperationalState | CircuitBreakerState

// ============================================================================
// 4. BASELINES (For Normalization)
// ============================================================================

/**
 * Baseline values for telemetry normalization.
 * Used by normalizeTelemetry() to calculate deviation.
 */
export interface Baselines {
  readonly latencyMs: number
  readonly errorRate: number
  readonly saturation: number
}

// ============================================================================
// 5. CONFIGURATION INTERFACES
// ============================================================================

/**
 * Physics Engine Tuning Parameters
 * See RFC-0002 for derivation logic.
 */
export interface PhysicsConfig {
  /** Static topological cost (R_base) */
  readonly baseResistance: Ohms

  /** Forgiveness rate (Lambda) ∈ (0, 1) */
  readonly decayRate: number

  /** Trauma weight (Sigma) - dimensionless */
  readonly scarFactor: number

  /** Momentum penalty (Mu) - dimensionless */
  readonly dampingFactor: number

  /** Threshold for trauma accumulation (P_crit) */
  readonly criticalPressure: NormalizedPressure

  /** Safety valve trigger multiplier (Gamma) */
  readonly breakMultiplier: number

  /** Warm-up period in ticks */
  readonly bootstrapTicks: number

  /** Minimum sampling interval */
  readonly minDeltaT: DeltaTime

  /**
   * Global steepness factor (k) for tanh normalization.
   * Controls how aggressively raw metrics map to [-1, 1].
   * See RFC-0004 §4.1
   */
  readonly tanhScale: number
}

/**
 * Service Level Objectives used to derive Sensitivity Weights
 */
export interface SLOConfig {
  readonly baselineLatencyMs: number
  readonly maxAcceptableLatencyMs: number
  readonly targetErrorRate: number
  readonly criticality: {
    readonly latency: number // 0-10
    readonly error: number // 0-10
    readonly saturation: number // 0-10
  }
}

// ============================================================================
// 5. FLOW DECISION TYPES
// ============================================================================

/**
 * Request with priority voltage
 */
export interface Request {
  readonly requestId: string
  readonly voltage: Volts
  readonly timestamp: Timestamp
}

/**
 * Flow decision result
 */
export type FlowDecision =
  | { readonly type: 'PASS'; readonly routeId: string }
  | { readonly type: 'REJECT'; readonly reason: 'INSUFFICIENT_VOLTAGE' | 'CIRCUIT_OPEN' }
  | { readonly type: 'REDIRECT'; readonly targetRouteId: string }
