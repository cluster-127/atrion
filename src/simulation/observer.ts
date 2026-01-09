/**
 * Atrion Simulation Observer
 * Captures system state snapshots per tick for analysis.
 */

import type { RouteState } from '../core/types.js'

/**
 * Simulation Telemetry Record
 * Stores snapshot of physics state per tick.
 */
export interface TickRecord {
  readonly tick: number
  readonly input: {
    readonly error: number
    readonly latency: number
    readonly saturation: number
  }
  readonly output: {
    readonly resistance: number
    readonly momentum: number
    readonly scar: number
  }
  readonly meta: {
    readonly mode: string
  }
}

export class SimulationObserver {
  private history: TickRecord[] = []

  /**
   * Capture system state at a specific tick.
   */
  record(
    tick: number,
    state: RouteState,
    inputs: { error: number; latency: number; saturation: number }
  ): void {
    // Handle discriminated union for momentum
    // In BOOTSTRAP, momentum is undefined. Treat as 0 for graphing.
    const momentumVal = state.mode === 'BOOTSTRAP' ? 0 : state.momentum

    this.history.push({
      tick,
      input: {
        error: inputs.error,
        latency: inputs.latency,
        saturation: inputs.saturation,
      },
      output: {
        resistance: state.resistance,
        momentum: momentumVal,
        scar: state.scarTissue,
      },
      meta: {
        mode: state.mode,
      },
    })
  }

  /**
   * Extract data series for plotting (e.g. asciichart).
   */
  getSeries(
    key: 'resistance' | 'momentum' | 'scar' | 'error' | 'latency' | 'saturation'
  ): number[] {
    switch (key) {
      case 'error':
        return this.history.map((h) => h.input.error)
      case 'latency':
        return this.history.map((h) => h.input.latency)
      case 'saturation':
        return this.history.map((h) => h.input.saturation)
      default:
        return this.history.map((h) => h.output[key])
    }
  }

  getHistory(): ReadonlyArray<TickRecord> {
    return this.history
  }

  /**
   * Validation Helper: Maximum resistance reached.
   */
  maxResistance(): number {
    return Math.max(...this.history.map((h) => h.output.resistance))
  }

  /**
   * Validation Helper: Final resistance level.
   */
  finalResistance(): number {
    if (this.history.length === 0) return 0
    return this.history[this.history.length - 1].output.resistance
  }

  /**
   * Reset history for reuse.
   */
  reset(): void {
    this.history = []
  }
}
