/**
 * Atrion AutoTuner Module (RFC-0008)
 *
 * Adaptive thresholding using statistical deviation (μ ± kσ).
 * Enables zero-config operation by learning traffic patterns.
 *
 * @see documentation/rfc/RFC-0008-adaptive-thresholds.md
 */

import type { Ohms } from './types.js'

/**
 * AutoTuner configuration
 */
export interface AutoTunerConfig {
  /** Rolling window size for EMA calculation (default: 100) */
  windowSize: number
  /** Sensitivity multiplier - k in (μ + kσ) (default: 3.0) */
  sensitivity: number
  /** Minimum threshold floor (safety net) */
  minFloor: Ohms
  /** Maximum threshold ceiling (anti-boiling-frog) */
  hardCeiling: Ohms
  /** Ticks before adaptive mode activates (default: 50) */
  warmupTicks: number
  /** Recovery point multiplier relative to break (default: 0.5) */
  recoveryMultiplier: number
}

/**
 * Statistics snapshot from AutoTuner
 */
export interface TunerStats {
  mean: number
  stdDev: number
  sampleCount: number
  isWarmedUp: boolean
}

/**
 * Default AutoTuner configuration
 */
export const DEFAULT_AUTOTUNER_CONFIG: AutoTunerConfig = {
  windowSize: 100,
  sensitivity: 3.0, // 3-sigma (99.7% of normal distribution)
  minFloor: 30 as Ohms, // Never break below 30Ω
  hardCeiling: 500 as Ohms, // Never break above 500Ω
  warmupTicks: 50, // Use static until 50 samples
  recoveryMultiplier: 0.5, // Recover at 50% of break
}

/**
 * EMA Accumulator for exponentially-weighted statistics
 *
 * Provides O(1) memory complexity with decay-weighted recent bias.
 * Ideal for dynamic traffic patterns (diurnal cycles).
 */
class EMAAccumulator {
  private mean = 0
  private variance = 0
  private count = 0
  private readonly alpha: number

  constructor(windowSize: number) {
    // α = 2 / (N + 1) — standard EMA smoothing factor
    this.alpha = 2 / (windowSize + 1)
  }

  /**
   * Update accumulator with new observation
   */
  update(x: number): void {
    this.count++

    if (this.count === 1) {
      this.mean = x
      this.variance = 0
      return
    }

    const delta = x - this.mean
    this.mean += this.alpha * delta

    // Exponential variance estimation
    this.variance = (1 - this.alpha) * (this.variance + this.alpha * delta * delta)
  }

  getMean(): number {
    return this.mean
  }

  getStdDev(): number {
    return Math.sqrt(Math.max(0, this.variance))
  }

  getCount(): number {
    return this.count
  }

  /**
   * Reset accumulator state
   */
  reset(): void {
    this.mean = 0
    this.variance = 0
    this.count = 0
  }
}

/**
 * AutoTuner - Adaptive threshold calculator
 *
 * Learns traffic patterns and computes dynamic break/recovery thresholds
 * using statistical deviation (μ + kσ).
 *
 * @example
 * const tuner = new AutoTuner()
 *
 * // Feed resistance observations
 * tuner.observe(currentResistance)
 *
 * // Get dynamic break threshold
 * const breakPoint = tuner.computeBreakPoint()
 *
 * // Get dynamic recovery threshold
 * const recoveryPoint = tuner.computeRecoveryPoint()
 */
export class AutoTuner {
  private readonly config: AutoTunerConfig
  private readonly accumulator: EMAAccumulator
  private readonly fallbackBreak: Ohms

  constructor(config: Partial<AutoTunerConfig> = {}, fallbackBreak: Ohms = 100 as Ohms) {
    this.config = { ...DEFAULT_AUTOTUNER_CONFIG, ...config }
    this.accumulator = new EMAAccumulator(this.config.windowSize)
    this.fallbackBreak = fallbackBreak
  }

  /**
   * Feed a resistance observation to the tuner
   */
  observe(resistance: Ohms): void {
    this.accumulator.update(resistance)
  }

  /**
   * Get current statistics
   */
  getStats(): TunerStats {
    return {
      mean: this.accumulator.getMean(),
      stdDev: this.accumulator.getStdDev(),
      sampleCount: this.accumulator.getCount(),
      isWarmedUp: this.accumulator.getCount() >= this.config.warmupTicks,
    }
  }

  /**
   * Compute dynamic break threshold
   *
   * Formula: clamp(μ + kσ, minFloor, hardCeiling)
   *
   * During warmup period, returns fallbackBreak.
   */
  computeBreakPoint(): Ohms {
    const stats = this.getStats()

    // Warmup: use static fallback
    if (!stats.isWarmedUp) {
      return this.fallbackBreak
    }

    // Dynamic threshold: μ + kσ
    const dynamicBreak = stats.mean + this.config.sensitivity * stats.stdDev

    // Apply safety clamps
    const clamped = Math.max(this.config.minFloor, Math.min(dynamicBreak, this.config.hardCeiling))

    return clamped as Ohms
  }

  /**
   * Compute dynamic recovery threshold
   *
   * Default: breakPoint * recoveryMultiplier
   * Alternative: μ (mean) level
   */
  computeRecoveryPoint(): Ohms {
    const breakPoint = this.computeBreakPoint()
    const recoveryPoint = breakPoint * this.config.recoveryMultiplier

    // Never below minFloor * 0.5
    const minRecovery = this.config.minFloor * 0.5
    return Math.max(minRecovery, recoveryPoint) as Ohms
  }

  /**
   * Check if resistance exceeds dynamic break threshold
   */
  shouldBreak(resistance: Ohms): boolean {
    return resistance >= this.computeBreakPoint()
  }

  /**
   * Check if resistance is below recovery threshold
   */
  shouldRecover(resistance: Ohms): boolean {
    return resistance < this.computeRecoveryPoint()
  }

  /**
   * Reset tuner state (e.g., after major config change)
   */
  reset(): void {
    this.accumulator.reset()
  }
}
