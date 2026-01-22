/**
 * Workload Profiles (RFC-0010)
 *
 * Defines profile types for heterogeneous workloads.
 * Pressure = deviation from expectation, not absolute magnitude.
 */

// ============================================================================
// PROFILE TYPES
// ============================================================================

/**
 * Workload profile categories.
 *
 * Each profile has different baseline expectations:
 * - LIGHT: Health checks, simple queries (10ms baseline)
 * - STANDARD: REST APIs, CRUD operations (100ms baseline)
 * - HEAVY: Video processing, complex queries (5s baseline)
 * - EXTREME: ML training, genome sequencing (60s baseline)
 * - CUSTOM: User-defined baselines
 */
export type WorkloadProfile = 'LIGHT' | 'STANDARD' | 'HEAVY' | 'EXTREME' | 'CUSTOM'

/**
 * Configuration for each workload profile.
 */
export interface ProfileConfig {
  /** Expected baseline latency in milliseconds */
  readonly baselineLatencyMs: number

  /** Maximum allowed duration before lease expires */
  readonly maxDurationMs: number

  /** Whether heartbeat is required during execution */
  readonly heartbeatRequired: boolean

  /** Heartbeat interval in milliseconds (if required) */
  readonly heartbeatIntervalMs: number

  /** Multiplier for scar accumulation (lower = more tolerant) */
  readonly scarMultiplier: number
}

// ============================================================================
// DEFAULT PROFILE CONFIGURATIONS
// ============================================================================

/**
 * Default configurations for each profile type.
 */
export const PROFILE_CONFIGS: Record<Exclude<WorkloadProfile, 'CUSTOM'>, ProfileConfig> = {
  LIGHT: {
    baselineLatencyMs: 10,
    maxDurationMs: 1_000, // 1 second
    heartbeatRequired: false,
    heartbeatIntervalMs: 0,
    scarMultiplier: 2.0, // Very sensitive to deviation
  },

  STANDARD: {
    baselineLatencyMs: 100,
    maxDurationMs: 30_000, // 30 seconds
    heartbeatRequired: false,
    heartbeatIntervalMs: 0,
    scarMultiplier: 1.0, // Normal sensitivity
  },

  HEAVY: {
    baselineLatencyMs: 5_000, // 5 seconds
    maxDurationMs: 300_000, // 5 minutes
    heartbeatRequired: true,
    heartbeatIntervalMs: 5_000, // Every 5 seconds
    scarMultiplier: 0.5, // More tolerant
  },

  EXTREME: {
    baselineLatencyMs: 60_000, // 1 minute
    maxDurationMs: 3_600_000, // 1 hour
    heartbeatRequired: true,
    heartbeatIntervalMs: 10_000, // Every 10 seconds
    scarMultiplier: 0.2, // Very tolerant
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get profile configuration by name.
 *
 * @param profile - Profile name or custom config
 * @returns ProfileConfig for the given profile
 */
export function getProfileConfig(profile: WorkloadProfile | ProfileConfig): ProfileConfig {
  if (typeof profile === 'object') {
    return profile // Custom config passed directly
  }

  if (profile === 'CUSTOM') {
    // Default CUSTOM to STANDARD until overridden
    return PROFILE_CONFIGS.STANDARD
  }

  return PROFILE_CONFIGS[profile]
}

/**
 * Check if profile requires AbortController.
 *
 * HEAVY and EXTREME profiles REQUIRE AbortController for task termination.
 */
export function requiresAbortController(profile: WorkloadProfile): boolean {
  return profile === 'HEAVY' || profile === 'EXTREME'
}

/**
 * Check if profile requires heartbeat.
 */
export function requiresHeartbeat(profile: WorkloadProfile): boolean {
  if (profile === 'CUSTOM') return false
  return PROFILE_CONFIGS[profile].heartbeatRequired
}

/**
 * Calculate pressure adjustment based on profile.
 *
 * Normalizes actual latency against profile baseline.
 */
export function calculateProfilePressure(actualLatencyMs: number, profile: ProfileConfig): number {
  const deviation = actualLatencyMs / profile.baselineLatencyMs - 1
  return Math.max(0, deviation) // Only positive deviation creates pressure
}

// ============================================================================
// ROUTE PROFILE REGISTRY
// ============================================================================

/**
 * Per-route profile assignments.
 */
const routeProfiles = new Map<string, WorkloadProfile>()

/**
 * Set default profile for a route.
 */
export function setRouteProfile(routeId: string, profile: WorkloadProfile): void {
  routeProfiles.set(routeId, profile)
}

/**
 * Get profile for a route.
 */
export function getRouteProfile(routeId: string): WorkloadProfile {
  return routeProfiles.get(routeId) ?? 'STANDARD'
}

/**
 * Clear all route profile assignments.
 */
export function clearRouteProfiles(): void {
  routeProfiles.clear()
}
