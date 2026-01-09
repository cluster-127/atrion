/**
 * H3: Auto-Routing (Survival of the Fittest)
 *
 * Amaç:
 * Birden fazla rotanın yarıştığı bir ortamda, Fizik Motorunun (Resistance)
 * trafiği otomatik olarak "En Sağlıklı" rotaya yönlendirdiğini kanıtlamak.
 *
 * Hipotez:
 * "Fizik motoru tarafından üretilen dinamik Direnç (R) değerleri, trafiği
 * otomatik olarak 'sağlıklı' rotalara yönlendirmek için yeterli sinyali üretir.
 * Manuel kural yazmaya gerek kalmadan, sistem en az dirençli yolu
 * (Path of Least Resistance) kendisi bulur."
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

describe('H3: Auto-Routing Dynamics', () => {
  // CONFIG A: Performanslı ama Kırılgan (Primary)
  // Base R: 10 Ohm (Hızlı)
  const CONFIG_PRIMARY: PhysicsConfig = {
    baseResistance: 10 as Ohms,
    decayRate: 0.5, // Orta iyileşme
    scarFactor: 5, // Travmaya duyarlı
    dampingFactor: 10,
    criticalPressure: 0.4 as NormalizedPressure,
    breakMultiplier: 100,
    bootstrapTicks: 1,
    minDeltaT: 100 as DeltaTime,
    tanhScale: 1.0,
  }

  // CONFIG B: Yavaş ama Stabil (Secondary/Failover)
  // Base R: 25 Ohm (Daha yavaş, normalde tercih edilmez)
  const CONFIG_SECONDARY: PhysicsConfig = {
    baseResistance: 25 as Ohms, // High Base Resistance
    decayRate: 0.5,
    scarFactor: 1, // Travmaya az duyarlı (Sağlam)
    dampingFactor: 5,
    criticalPressure: 0.8 as NormalizedPressure, // Zor tetiklenir
    breakMultiplier: 100,
    bootstrapTicks: 1,
    minDeltaT: 100 as DeltaTime,
    tanhScale: 1.0,
  }

  const SLO: SLOConfig = {
    baselineLatencyMs: 50,
    maxAcceptableLatencyMs: 200,
    targetErrorRate: 0.01,
    criticality: { latency: 5, error: 10, saturation: 5 },
  }

  it('should shift traffic from Primary to Secondary during failure', () => {
    // SENARYO:
    // Tick 0-10: Normal (Primary çalışıyor)
    // Tick 10-30: PRIMARY FAILURE (Spike) -> Secondary hala sağlam
    // Tick 30+: Recovery

    // Primary Rota Senaryosu: Krize giriyor
    const scenarioPrimary = Scenarios.compose(
      Scenarios.silence(),
      Scenarios.spike(10, 30, 0.9, 0), // Ağır hasar
      Scenarios.silence()
    )

    // Secondary Rota Senaryosu: Hep stabil
    const scenarioSecondary = Scenarios.compose(
      Scenarios.silence(),
      Scenarios.silence(), // Hiç hata yok
      Scenarios.silence()
    )

    // İki simülasyonu paralel koşturuyoruz
    const simA = runSimulation({
      durationTicks: 50,
      config: CONFIG_PRIMARY,
      slo: SLO,
      scenario: scenarioPrimary,
    })
    const simB = runSimulation({
      durationTicks: 50,
      config: CONFIG_SECONDARY,
      slo: SLO,
      scenario: scenarioSecondary,
    })

    const resA = simA.getSeries('resistance')
    const resB = simB.getSeries('resistance')

    // --- ANALİZ ---

    // 1. Barış Zamanı (Tick 5)
    // Primary (10 Ohm) < Secondary (25 Ohm) olmalı
    // Trafik Primary'de.
    expect(resA[5]).toBeLessThan(resB[5])
    console.log(
      `[Peace] Primary: ${resA[5].toFixed(1)}Ω vs Secondary: ${resB[5].toFixed(
        1
      )}Ω -> Winner: PRIMARY`
    )

    // 2. Savaş Zamanı (Tick 20 - Krizin ortası)
    // Primary Spikeladı -> Direnç fırlamalı
    // Secondary Sabit -> Direnç 25
    // Beklenti: Primary > Secondary (Traffic Shift)
    const peakResA = resA[20]
    const peakResB = resB[20]

    expect(peakResA).toBeGreaterThan(peakResB)
    console.log(
      `[War]   Primary: ${peakResA.toFixed(1)}Ω vs Secondary: ${peakResB.toFixed(
        1
      )}Ω -> Winner: SECONDARY`
    )

    // 3. Routing Olasılık Hesabı (Conductance Based)
    // P(A) = (1/Ra) / (1/Ra + 1/Rb)
    const conductanceA = 1 / peakResA
    const conductanceB = 1 / peakResB
    const totalConductance = conductanceA + conductanceB
    const probB = conductanceB / totalConductance // B'nin seçilme şansı

    console.log(`[War]   Traffic Probability for Secondary: ${(probB * 100).toFixed(1)}%`)

    // Kriz anında trafiğin çoğu (%50'den fazlası) Secondary'ye akmalı
    expect(probB).toBeGreaterThan(0.5)
  })

  it('should return traffic to Primary after recovery (with Hysteresis)', () => {
    // Primary iyileştiğinde trafik hemen dönmemeli (titreşimi önlemek için),
    // ama eventually dönmeli.

    const scenarioPrimary = Scenarios.compose(
      Scenarios.silence(),
      Scenarios.spike(10, 30, 0.9, 0),
      Scenarios.silence()
    )

    // Secondary hep temiz (compose ile 3 generator)
    const scenarioSecondary = Scenarios.compose(
      Scenarios.silence(),
      Scenarios.silence(),
      Scenarios.silence()
    )

    const simA = runSimulation({
      durationTicks: 60,
      config: CONFIG_PRIMARY,
      slo: SLO,
      scenario: scenarioPrimary,
    })
    const simB = runSimulation({
      durationTicks: 60,
      config: CONFIG_SECONDARY,
      slo: SLO,
      scenario: scenarioSecondary,
    })

    const resA = simA.getSeries('resistance')
    const resB = simB.getSeries('resistance')

    // Tick 35 (Kriz yeni bitti)
    // Primary input 0 ama Scar var. Direnç hala yüksek olabilir.
    // Bu, "Flapping"i önleyen sigortadır. Secondary hala cazip olabilir.
    console.log(`[Post-War] Tick 35 -> Primary: ${resA[35].toFixed(1)}Ω`)

    // Tick 59 (Tam İyileşme)
    // Primary iyileşmiş olmalı ve tekrar Secondary'den daha düşük dirence inmeli.
    // 10 Ohm (Primary Base) < 25 Ohm (Secondary Base)
    const finalA = resA[59]
    const finalB = resB[59]

    expect(finalA).toBeLessThan(finalB)
    console.log(
      `[Recovery] Primary: ${finalA.toFixed(1)}Ω vs Secondary: ${finalB.toFixed(
        1
      )}Ω -> Winner: PRIMARY`
    )
  })
})
