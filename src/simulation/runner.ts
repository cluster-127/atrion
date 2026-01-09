/**
 * Atrion Simulation Runner
 * Tick-based simulation loop with VirtualClock.
 */

import { VirtualClock } from '../core/clock.js'
import { deriveBaselines, deriveWeights } from '../core/config.js'
import { normalizeTelemetry } from '../core/normalize.js'
import { createBootstrapState, updatePhysics } from '../core/physics.js'
import type { Baselines, PhysicsConfig, RouteState, SLOConfig } from '../core/types.js'
import { VectorMath } from '../core/vector.js'
import { SimulationObserver } from './observer.js'
import { Scenarios } from './scenarios.js'

export interface SimulationOptions {
  readonly durationTicks: number
  readonly config: PhysicsConfig
  readonly slo: SLOConfig
  readonly scenario: ReturnType<typeof Scenarios.compose>
}

export function runSimulation(options: SimulationOptions): SimulationObserver {
  const { durationTicks, config, slo, scenario } = options

  const clock = new VirtualClock()
  const observer = new SimulationObserver()

  // Derive weights and baselines from SLO
  const weights = deriveWeights(slo)
  const baselines: Baselines = deriveBaselines(slo)

  // Initialize state with zero pressure - will transition through state machine
  const initialPressure = VectorMath.zero()
  let state: RouteState = createBootstrapState('sim-route-01', initialPressure, config, clock.now())

  // Fixed time step for simulation stability
  const stepDelta = config.minDeltaT

  for (let i = 0; i < durationTicks; i++) {
    const currentTick = i + 1
    clock.advance(stepDelta)

    // 1. Generate Raw Input
    const rawInputs = scenario(currentTick)

    // 2. Normalize Input (Applies tanh & Guards)
    // normalizeTelemetry expects individual values, not an object
    const pressureVec = normalizeTelemetry(
      rawInputs.latency,
      rawInputs.error,
      rawInputs.saturation,
      baselines,
      config.tanhScale
    )

    // 3. Physics Update
    // updatePhysics expects: (state, pressure, weights, config, now)
    state = updatePhysics(state, pressureVec, weights, config, clock.now())

    // 4. Record Telemetry
    observer.record(currentTick, state, rawInputs)
  }

  return observer
}
