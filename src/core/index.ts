/**
 * Atrion Core Module
 * Public API exports
 */

// Types
export type {
  BootstrapState,
  CircuitBreakerState,
  DeltaTime,
  FlowDecision,
  Momentum,
  NormalizedPressure,
  ObserverDecision,
  Ohms,
  OperationalMode,
  OperationalState,
  PhysicsConfig,
  PhysicsEvent,
  PhysicsObserver,
  PressureVector,
  Request,
  RouteState,
  SLOConfig,
  Scar,
  SensitivityWeights,
  Timestamp,
  Volts,
} from './types.js'

// Vector utilities
export { VectorMath } from './vector.js'

// Clock
export { RealClock, VirtualClock } from './clock.js'
export type { Clock } from './clock.js'

// Normalization
export {
  isValidPressure,
  isValidPressureVector,
  normalize,
  normalizeTelemetry,
} from './normalize.js'

// Configuration
export {
  DEFAULT_CONFIG,
  DEFAULT_SLO,
  deriveBaselines,
  deriveWeights,
  floatEquals,
} from './config.js'

// Constants (Signal vs Noise boundaries)
export { MAX_SAFE_RESISTANCE, MIN_SIGNIFICANT_CHANGE, PHYSICS_EPSILON } from './constants.js'

// Guards (defensive programming)
export {
  // Constants
  EPSILON,
  MAX_RESISTANCE,
  MIN_DELTA_T,
  // Composite guard
  PhysicsGuard,
  clampToZero,
  // Primitive guards
  isSafeNumber,
  normalizeZero,
  safeClamp,
  safeDivide,
  safeExp,
  safeTanh,
  sanitizePositive,
  // Pressure guards
  sanitizePressure,
  toSafeNumber,
} from './guards.js'

// Physics engine
export {
  calculateMomentum,
  calculateResistance,
  calculateStaleness,
  createBootstrapState,
  updatePhysics,
  updateScar,
} from './physics.js'

// Flow decision
export { createRequest, decideFlow, selectRoute } from './flow.js'

// Logger
export {
  consoleLogger,
  createLogger,
  getLogger,
  resetLogger,
  setLogger,
  silentLogger,
} from './logger.js'
export type { LogLevel, Logger } from './logger.js'

// Observers (v1.1)
export {
  consoleObserver,
  createCollectorObserver,
  createCompositeObserver,
  createFilteredObserver,
  silentObserver,
} from './observers.js'

// AutoTuner (RFC-0008: Adaptive Thresholds)
export { AutoTuner, DEFAULT_AUTOTUNER_CONFIG } from './auto-tuner.js'
export type { AutoTunerConfig, TunerStats } from './auto-tuner.js'
