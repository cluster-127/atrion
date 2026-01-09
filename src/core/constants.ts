/**
 * ATRION PHYSICS CONSTANTS
 * Defines the boundary between Signal and Noise.
 *
 * See RFC-0004 §3.5 for theoretical foundation.
 */

// =============================================================================
// 1. NOISE FLOOR: Absolute Zero Threshold
// =============================================================================

/**
 * The resolution limit of the physics engine.
 *
 * Anything below this is floating-point artifact, not signal.
 * - 1e-9 ms latency difference = CPU clock jitter
 * - 1e-9 error rate = statistical noise
 *
 * Used by: clampToZero(), magnitude(), dot()
 */
export const PHYSICS_EPSILON = 1e-9

// =============================================================================
// 2. OPERATIONAL DEADBAND: Inertia Threshold
// =============================================================================

/**
 * The minimum change that triggers operational response.
 *
 * Changes smaller than this are "stable state vibration".
 * System maintains inertia instead of reacting.
 *
 * Prevents: Micro-flapping, oscillation from noise
 * Used by: Momentum damping, Flow decision hysteresis
 */
export const MIN_SIGNIFICANT_CHANGE = 1e-4

// =============================================================================
// 3. SAFETY CEILING: Infinity Prevention
// =============================================================================

/**
 * Maximum allowed resistance value.
 *
 * Prevents Infinity propagation through calculations.
 * Any resistance above this is clamped.
 */
export const MAX_SAFE_RESISTANCE = 1e6

// =============================================================================
// SIGNAL CLASSIFICATION TABLE
// =============================================================================
//
// | Magnitude Range      | Class          | Motor Response        |
// |----------------------|----------------|----------------------|
// | |v| < 1e-9           | NOISE          | Treat as 0           |
// | 1e-9 ≤ |v| < 1e-4    | MICRO-TREMOR   | Calculate, dampen    |
// | 1e-4 ≤ |v| < 1.0     | SIGNAL         | Full response        |
// | |v| ≥ 1.0            | SATURATION     | Clamp to bounds      |
//
// =============================================================================
