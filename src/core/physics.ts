/**
 * Atrion Physics Engine
 * Core physics calculations implementing RFC-0001 equations.
 * All functions are pure - no side effects.
 */

import type { AutoTuner } from './auto-tuner.js'
import { isSafeNumber, safeDivide, safeExp, sanitizePositive } from './guards.js'
import type {
  BootstrapState,
  CircuitBreakerState,
  DeltaTime,
  Momentum,
  ObserverDecision,
  Ohms,
  OperationalState,
  PhysicsConfig,
  PhysicsEvent,
  PhysicsObserver,
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
  deltaT: DeltaTime,
): Momentum {
  const delta = VectorMath.subtract(current, previous)
  const magnitude = VectorMath.magnitude(delta)
  return asMomentum(safeDivide(magnitude, deltaT, 0))
}

/**
 * Update scar tissue with decay and potential trauma.
 * S(t) = S(t-1) * e^(-λΔt) + σ * I(||P+|| > P_crit)
 *
 * AARS: Time constants use SI units (seconds) for readable config values.
 * deltaT arrives in milliseconds, converted internally.
 *
 * CHECK VALVE FIX: Only POSITIVE pressure (stress above baseline) causes trauma.
 * "Silence" (performance better than baseline) does not cause scarring.
 * This prevents the "silence is trauma" paradox where negative deviation
 * from baseline was incorrectly counted as stress.
 *
 * @param currentScar - Current scar tissue value
 * @param pressure - Current pressure vector
 * @param config - Physics configuration
 * @param deltaT - Time delta in milliseconds
 * @returns Updated scar tissue value
 */
export function updateScar(
  currentScar: Scar,
  pressure: PressureVector,
  config: PhysicsConfig,
  deltaT: DeltaTime,
): Scar {
  // UNIT CONVERSION: Milliseconds -> Seconds
  // Without this, e^(-0.1 * 100) = e^(-10) ≈ 0 erases memory instantly
  const dtSeconds = deltaT / 1000

  // Exponential decay with safe exp
  // decayRate = 0.1 means "10% decay per second"
  const decayed = sanitizePositive(currentScar) * safeExp(-config.decayRate * dtSeconds, 1)

  // CHECK VALVE: Only positive pressure components cause trauma
  // Negative values (performance better than baseline) are clamped to 0
  // This is the "semi-permeable membrane" - stress flows in, relief doesn't cause damage
  const positiveStressMagnitude = Math.sqrt(
    Math.max(0, pressure.latency) ** 2 +
      Math.max(0, pressure.error) ** 2 +
      Math.max(0, pressure.saturation) ** 2,
  )

  // Add trauma only if positive stress exceeds threshold
  const trauma = positiveStressMagnitude > config.criticalPressure ? config.scarFactor : 0

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
  stalenessFactor: number = 0.5,
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
  staleness: number = 0,
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
  now: Timestamp,
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
 * Derive decision from mode for observer events.
 */
function deriveDecision(mode: RouteState['mode']): ObserverDecision {
  switch (mode) {
    case 'BOOTSTRAP':
      return 'BOOTSTRAP'
    case 'CIRCUIT_BREAKER':
      return 'SHED'
    case 'OPERATIONAL':
      return 'FLOW'
  }
}

/**
 * Emit physics event to observer if provided.
 * Uses setImmediate to prevent blocking the main physics loop.
 */
function emitEvent(
  observer: PhysicsObserver | undefined,
  prevState: RouteState,
  nextState: RouteState,
  pressure: PressureVector,
  deltaT: DeltaTime,
  now: Timestamp,
): void {
  if (!observer) return

  const pressureMagnitude = VectorMath.magnitude(pressure)
  const decision = deriveDecision(nextState.mode)

  const event: PhysicsEvent = {
    routeId: nextState.routeId,
    mode: nextState.mode,
    resistance: nextState.resistance,
    momentum: nextState.mode !== 'BOOTSTRAP' ? nextState.momentum : undefined,
    scarTissue: nextState.scarTissue,
    decision,
    deltaT,
    timestamp: now,
    pressureMagnitude,
    tickCount: nextState.tickCount,
    modeTransition:
      prevState.mode !== nextState.mode ? { from: prevState.mode, to: nextState.mode } : undefined,
  }

  // Non-blocking observer notification
  setImmediate(() => observer.onUpdate(event))
}

/**
 * Main physics update function.
 * Transitions state machine and calculates new physics values.
 * Pure function - returns new state, does not mutate input.
 *
 * @param state - Current route state
 * @param newPressure - New pressure vector from telemetry
 * @param weights - Sensitivity weights derived from SLOs
 * @param config - Physics configuration
 * @param now - Current timestamp
 * @param observer - Optional observer for telemetry (v1.1)
 * @param autoTuner - Optional AutoTuner for adaptive thresholds (v1.2)
 * @returns Updated route state
 */
export function updatePhysics(
  state: RouteState,
  newPressure: PressureVector,
  weights: SensitivityWeights,
  config: PhysicsConfig,
  now: Timestamp,
  observer?: PhysicsObserver,
  autoTuner?: AutoTuner,
): RouteState {
  const tickCount = state.tickCount + 1
  const deltaT = (now - state.lastUpdatedAt) as DeltaTime

  // Bootstrap mode: collect data, don't compute full physics
  if (state.mode === 'BOOTSTRAP') {
    if (tickCount < config.bootstrapTicks) {
      const nextState: RouteState = {
        ...state,
        pressure: newPressure,
        tickCount,
        lastUpdatedAt: now,
      }
      emitEvent(observer, state, nextState, newPressure, deltaT, now)
      return nextState
    }

    // Transition to operational
    const momentum = asMomentum(0) // First tick has no momentum
    const scar = updateScar(state.scarTissue, newPressure, config, deltaT)
    const resistance = calculateResistance(newPressure, momentum, scar, weights, config)

    const nextState: OperationalState = {
      routeId: state.routeId,
      mode: 'OPERATIONAL',
      pressure: newPressure,
      previousPressure: state.pressure,
      momentum,
      scarTissue: scar,
      resistance,
      tickCount,
      lastUpdatedAt: now,
    }
    emitEvent(observer, state, nextState, newPressure, deltaT, now)
    return nextState
  }

  // Operational or Circuit Breaker: full physics
  const momentum = calculateMomentum(newPressure, state.previousPressure, deltaT)
  const scar = updateScar(state.scarTissue, newPressure, config, deltaT)
  const resistance = calculateResistance(newPressure, momentum, scar, weights, config)

  // Feed resistance to AutoTuner for learning
  autoTuner?.observe(resistance)

  // Check for circuit breaker trigger (adaptive or static threshold)
  const breakPoint = autoTuner
    ? autoTuner.computeBreakPoint()
    : asOhms(config.baseResistance * config.breakMultiplier)

  if (state.mode === 'OPERATIONAL' && resistance >= breakPoint) {
    // Trigger circuit breaker
    const nextState: CircuitBreakerState = {
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
    }
    emitEvent(observer, state, nextState, newPressure, deltaT, now)
    return nextState
  }

  if (state.mode === 'CIRCUIT_BREAKER') {
    // Check for recovery conditions
    const pressureMag = VectorMath.magnitude(newPressure)
    const scarBelow = scar < config.scarFactor
    const pressureBelow = pressureMag < config.criticalPressure

    // Resistance-based recovery (adaptive or 50% of break threshold)
    // This fixes the CB hysteresis issue where scar decays slowly
    const recoveryThreshold = autoTuner
      ? autoTuner.computeRecoveryPoint()
      : asOhms(config.baseResistance * config.breakMultiplier * 0.5)
    const resistanceBelow = resistance < recoveryThreshold

    // Recovery: Original conditions OR resistance dropped sufficiently
    if ((scarBelow && pressureBelow) || resistanceBelow) {
      // Recover to operational
      const nextState: OperationalState = {
        routeId: state.routeId,
        mode: 'OPERATIONAL',
        pressure: newPressure,
        previousPressure: state.pressure,
        momentum,
        scarTissue: scar,
        resistance,
        tickCount,
        lastUpdatedAt: now,
      }
      emitEvent(observer, state, nextState, newPressure, deltaT, now)
      return nextState
    }

    // Stay in circuit breaker
    const nextState: RouteState = {
      ...state,
      pressure: newPressure,
      previousPressure: state.pressure,
      momentum,
      scarTissue: scar,
      resistance,
      tickCount,
      lastUpdatedAt: now,
    }
    emitEvent(observer, state, nextState, newPressure, deltaT, now)
    return nextState
  }

  // Stay operational
  const nextState: OperationalState = {
    routeId: state.routeId,
    mode: 'OPERATIONAL',
    pressure: newPressure,
    previousPressure: state.pressure,
    momentum,
    scarTissue: scar,
    resistance,
    tickCount,
    lastUpdatedAt: now,
  }
  emitEvent(observer, state, nextState, newPressure, deltaT, now)
  return nextState
}
