/**
 * Atrion Simulation Scenarios
 * Generators for synthetic pressure loads.
 */

export type PressureGenerator = (tick: number) => number

export const Scenarios = {
  /**
   * Silence (Baseline)
   */
  silence: (base: number = 0): PressureGenerator => {
    return () => Math.max(0, base)
  },

  /**
   * Spike: 0 -> Peak -> 0
   */
  spike: (start: number, end: number, peak: number, base: number = 0): PressureGenerator => {
    return (tick) => (tick >= start && tick < end ? peak : base)
  },

  /**
   * Sustained: Constant load
   */
  sustained: (level: number): PressureGenerator => {
    return () => Math.max(0, level)
  },

  /**
   * Oscillating: Sin wave
   * Enforces non-negative pressure via Math.max
   */
  oscillating: (period: number, amplitude: number, offset: number = 0): PressureGenerator => {
    return (tick) => {
      const val = offset + amplitude * Math.sin((tick / period) * 2 * Math.PI)
      return Math.max(0, val)
    }
  },

  /**
   * Ramp: Linear increase
   * Added safety cap to prevent Infinity/Unsafe values.
   */
  ramp: (start: number, slope: number, base: number = 0, cap: number = 100): PressureGenerator => {
    return (tick) => {
      if (tick < start) return base
      const val = base + (tick - start) * slope
      return Math.min(val, cap)
    }
  },

  /**
   * Recovery: High -> Low
   */
  recovery: (dropTick: number, high: number, low: number): PressureGenerator => {
    return (tick) => (tick < dropTick ? high : low)
  },

  /**
   * Composite Generator
   * Combines individual generators for the 3 vector components.
   */
  compose: (
    latency: PressureGenerator,
    error: PressureGenerator,
    saturation: PressureGenerator
  ) => {
    return (tick: number) => ({
      latency: latency(tick),
      error: error(tick),
      saturation: saturation(tick),
    })
  },
}
