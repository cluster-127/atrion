/**
 * H2: Entropy Prevents Deadlock (Fixed for Physics v2)
 *
 * Bu test, Atrion'un "kinci" bir sistem olmadığını, sadece "temkinli" olduğunu kanıtlar.
 * Impulse (Dirac Delta) pattern ile sönümleme fiziği test edilir.
 */

import { describe, expect, it } from 'vitest'
import type {
  DeltaTime,
  NormalizedPressure,
  Ohms,
  PhysicsConfig,
  SLOConfig,
} from '../../src/core/types.js'
import { runSimulation } from '../../src/simulation/runner.js'
import { Scenarios } from '../../src/simulation/scenarios.js'

describe('H2: Entropy & Self-Healing', () => {
  // Hyper-Metabolic Config: Hızlı İyileşme
  const H2_CONFIG: PhysicsConfig = {
    baseResistance: 10 as Ohms,
    decayRate: 2.0, // Saniyede %200 sönümleme (Hızlı test için)
    scarFactor: 5,
    dampingFactor: 0,
    criticalPressure: 0.5 as NormalizedPressure,
    breakMultiplier: 100,
    bootstrapTicks: 1, // Warm-up
    minDeltaT: 100 as DeltaTime,
    tanhScale: 1.0,
  }

  const SLO: SLOConfig = {
    baselineLatencyMs: 50,
    maxAcceptableLatencyMs: 100,
    targetErrorRate: 0.01,
    criticality: { latency: 0, error: 10, saturation: 0 },
  }

  it('should naturally decay scar tissue (Impulse Test)', () => {
    // AMAÇ: Tek bir darbe (Impulse) sonrası doğal sönümlemeyi ölçmek.
    // Half-Life testi için fırın hemen kapanmalı.

    const scenario = Scenarios.compose(
      Scenarios.silence(), // Tick 0-2: Warmup
      Scenarios.spike(2, 3, 1.0, 0), // Tick 2-3: IMPULSE (Sadece 1 Tick Trauma)
      Scenarios.silence() // Tick 3+:  Recovery
    )

    const observer = runSimulation({
      durationTicks: 25, // Kısa ve net
      config: H2_CONFIG,
      slo: SLO,
      scenario,
    })

    const scar = observer.getSeries('scar')

    // 1. Darbe Anı (Tick 2 veya 3)
    // Impulse olduğu için max scar'ı hemen buluruz.
    const peakScar = Math.max(...scar)
    const peakIndex = scar.indexOf(peakScar)

    console.log(`Impulse Peak: ${peakScar.toFixed(3)} at tick ${peakIndex}`)

    // 2. Recovery Phase
    const recoveryPhase = scar.slice(peakIndex + 1)
    const finalScar = recoveryPhase[recoveryPhase.length - 1]

    console.log(`Final Scar: ${finalScar.toFixed(3)}`)

    // ASSERTIONS

    // A. Travma oluştu mu?
    expect(peakScar).toBeGreaterThan(1.0)

    // B. İyileşme gerçekleşti mi?
    expect(finalScar).toBeLessThan(peakScar)
    expect(finalScar).toBeLessThan(0.1) // Neredeyse sıfırlanmalı
  })

  it('should verify Half-Life physics', () => {
    // Teorik Hesap:
    // lambda = 2.0, dt = 0.1s
    // Decay Factor per tick = e^(-0.2) ≈ 0.8187
    // Half Life (ticks) = ln(2) / 0.2 ≈ 3.46 tick

    const scenario = Scenarios.compose(
      Scenarios.silence(),
      Scenarios.spike(2, 3, 1.0, 0), // Impulse
      Scenarios.silence()
    )

    const observer = runSimulation({
      durationTicks: 20,
      config: H2_CONFIG,
      slo: SLO,
      scenario,
    })

    const scar = observer.getSeries('scar')
    const peakScar = Math.max(...scar)
    const peakIndex = scar.indexOf(peakScar)

    const targetScar = peakScar / 2

    // Aramaya pik noktasından SONRA başla
    const recoverySlice = scar.slice(peakIndex)
    const ticksToHalf = recoverySlice.findIndex((s) => s <= targetScar)

    console.log(`Peak: ${peakScar.toFixed(3)}, Target: ${targetScar.toFixed(3)}`)
    console.log(`Measured Half-Life: ${ticksToHalf} ticks`)

    // Beklenti: 3 veya 4 tick
    expect(ticksToHalf).toBeGreaterThanOrEqual(3)
    expect(ticksToHalf).toBeLessThanOrEqual(5)
  })
})
