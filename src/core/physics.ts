/**
 * Atrion Physics Engine
 * Core physics calculations implementing RFC-0001 equations.
 * All functions are pure - no side effects.
 */

import { isSafeNumber, safeDivide, safeExp, sanitizePositive } from './guards.js'
import type {
  BootstrapState,
  CircuitBreakerState,
  DeltaTime,
  Momentum,
  Ohms,
  OperationalState,
  PhysicsConfig,
  PressureVector,
  RouteState,
  Scar,
  SensitivityWeights,
  Timestamp,
} from './types.js'
import { VectorMath } from './vector.js'

// Type cast helpers with safety
const asMomentum = (n: number): Momentum => (isSafeNumber(n) ? n : 0) as Momentum
const asScar = (n: number): Scar => sanitizePositive(n) as Scar
const asOhms = (n: number): Ohms => sanitizePositive(n) as Ohms

/**
 * Calculate momentum from pressure delta.
 * M = ||ΔP|| / Δt
 *
 * @param current - Current pressure vector
 * @param previous - Previous pressure vector
 * @param deltaT - Time delta
 * @returns Momentum magnitude (scalar, always >= 0)
 */
export function calculateMomentum(
  current: PressureVector,
  previous: PressureVector,
  deltaT: DeltaTime
): Momentum {
  const delta = VectorMath.subtract(current, previous)
  const magnitude = VectorMath.magnitude(delta)
  return asMomentum(safeDivide(magnitude, deltaT, 0))
}

/**
 * Update scar tissue with decay and potential trauma.
 * S(t) = S(t-1) * e^(-λΔt) + σ * I(||P|| > P_crit)
 *
 * @param currentScar - Current scar tissue value
 * @param pressure - Current pressure vector
 * @param config - Physics configuration
 * @param deltaT - Time delta
 * @returns Updated scar tissue value
 */
export function updateScar(
  currentScar: Scar,
  pressure: PressureVector,
  config: PhysicsConfig,
  deltaT: DeltaTime
): Scar {
  // Exponential decay with safe exp
  const decayed = sanitizePositive(currentScar) * safeExp(-config.decayRate * deltaT, 1)

  // Add trauma if critical
  const pressureMagnitude = VectorMath.magnitude(pressure)
  const trauma = pressureMagnitude > config.criticalPressure ? config.scarFactor : 0

  return asScar(Math.max(0, decayed + trauma))
}

/**
 * Calculate staleness penalty from time since last update.
 * U = κ * (now - lastUpdated) / 1000
 *
 * @param lastUpdatedAt - Timestamp of last update
 * @param now - Current timestamp
 * @param stalenessFactor - Penalty coefficient (κ)
 * @returns Staleness penalty
 */
export function calculateStaleness(
  lastUpdatedAt: Timestamp,
  now: Timestamp,
  stalenessFactor: number = 0.5
): number {
  const stalenessSeconds = (now - lastUpdatedAt) / 1000
  return stalenessFactor * stalenessSeconds
}

/**
 * Calculate total resistance (Ohm's Law of CDO).
 * R = R_base + (P^T · W) + μ||M|| + S + U
 *
 * @param pressure - Current pressure vector
 * @param momentum - Current momentum
 * @param scar - Current scar tissue
 * @param weights - Sensitivity weights
 * @param config - Physics configuration
 * @param staleness - Staleness penalty
 * @returns Total resistance
 */
export function calculateResistance(
  pressure: PressureVector,
  momentum: Momentum,
  scar: Scar,
  weights: SensitivityWeights,
  config: PhysicsConfig,
  staleness: number = 0
): Ohms {
  // Weighted pressure contribution: P^T · W
  const weightedPressure = VectorMath.scaleComponents(pressure, weights)
  const pressureContribution = VectorMath.sum(weightedPressure)

  // Damping contribution: μ * ||M||
  const dampingContribution = config.dampingFactor * momentum

  // Total impedance
  const total =
    config.baseResistance + pressureContribution + dampingContribution + scar + staleness

  // Ensure never below base
  return asOhms(Math.max(config.baseResistance, total))
}

/**
 * Create initial bootstrap state for a new route.
 */
export function createBootstrapState(
  routeId: string,
  initialPressure: PressureVector,
  config: PhysicsConfig,
  now: Timestamp
): BootstrapState {
  return {
    routeId,
    mode: 'BOOTSTRAP',
    pressure: initialPressure,
    previousPressure: undefined,
    momentum: undefined,
    scarTissue: asScar(0),
    resistance: asOhms(config.baseResistance * 1.2), // Conservative default
    tickCount: 0,
    lastUpdatedAt: now,
  }
}

/**
 * Main physics update function.
 * Transitions state machine and calculates new physics values.
 * Pure function - returns new state, does not mutate input.
 */
export function updatePhysics(
  state: RouteState,
  newPressure: PressureVector,
  weights: SensitivityWeights,
  config: PhysicsConfig,
  now: Timestamp
): RouteState {
  const tickCount = state.tickCount + 1
  const deltaT = (now - state.lastUpdatedAt) as DeltaTime

  // Bootstrap mode: collect data, don't compute full physics
  if (state.mode === 'BOOTSTRAP') {
    if (tickCount < config.bootstrapTicks) {
      return {
        ...state,
        pressure: newPressure,
        tickCount,
        lastUpdatedAt: now,
      }
    }

    // Transition to operational
    const momentum = asMomentum(0) // First tick has no momentum
    const scar = updateScar(state.scarTissue, newPressure, config, deltaT)
    const resistance = calculateResistance(newPressure, momentum, scar, weights, config)

    return {
      routeId: state.routeId,
      mode: 'OPERATIONAL',
      pressure: newPressure,
      previousPressure: state.pressure,
      momentum,
      scarTissue: scar,
      resistance,
      tickCount,
      lastUpdatedAt: now,
    } satisfies OperationalState
  }

  // Operational or Circuit Breaker: full physics
  const momentum = calculateMomentum(newPressure, state.previousPressure, deltaT)
  const scar = updateScar(state.scarTissue, newPressure, config, deltaT)
  const resistance = calculateResistance(newPressure, momentum, scar, weights, config)

  // Check for circuit breaker trigger
  const breakPoint = asOhms(config.baseResistance * config.breakMultiplier)

  if (state.mode === 'OPERATIONAL' && resistance >= breakPoint) {
    // Trigger circuit breaker
    return {
      routeId: state.routeId,
      mode: 'CIRCUIT_BREAKER',
      pressure: newPressure,
      previousPressure: state.pressure,
      momentum,
      scarTissue: scar,
      resistance,
      tickCount,
      lastUpdatedAt: now,
      recoveryStartedAt: now,
    } satisfies CircuitBreakerState
  }

  if (state.mode === 'CIRCUIT_BREAKER') {
    // Check for recovery conditions
    const pressureMag = VectorMath.magnitude(newPressure)
    const scarBelow = scar < config.scarFactor
    const pressureBelow = pressureMag < config.criticalPressure

    if (scarBelow && pressureBelow) {
      // Recover to operational
      return {
        routeId: state.routeId,
        mode: 'OPERATIONAL',
        pressure: newPressure,
        previousPressure: state.pressure,
        momentum,
        scarTissue: scar,
        resistance,
        tickCount,
        lastUpdatedAt: now,
      } satisfies OperationalState
    }

    // Stay in circuit breaker
    return {
      ...state,
      pressure: newPressure,
      previousPressure: state.pressure,
      momentum,
      scarTissue: scar,
      resistance,
      tickCount,
      lastUpdatedAt: now,
    }
  }

  // Stay operational
  return {
    routeId: state.routeId,
    mode: 'OPERATIONAL',
    pressure: newPressure,
    previousPressure: state.pressure,
    momentum,
    scarTissue: scar,
    resistance,
    tickCount,
    lastUpdatedAt: now,
  } satisfies OperationalState
}
