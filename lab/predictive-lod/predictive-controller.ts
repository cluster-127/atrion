/**
 * Atrion Wind Tunnel: Predictive LOD Controller
 *
 * Uses saturation TREND (derivative) to anticipate load increases
 * and switch LOD BEFORE resistance thresholds are hit.
 *
 * Key innovation:
 * - Tracks d(saturation)/dt over rolling window
 * - Pre-emptively degrades when trend exceeds threshold
 * - Prevents damage accumulation by acting proactively
 *
 * Run: npx tsx lab/predictive-lod/predictive-controller.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3008'
const ROUTE_ID = 'predictive-lod'

// Standard LOD resistance thresholds
const THRESHOLDS = {
  HIGH: 15,
  MEDIUM: 30,
}

// PREDICTIVE: Trend threshold for anticipatory switch
// If saturation is increasing by more than this per tick, pre-degrade
const TREND_THRESHOLD = 0.05 // 5% saturation increase per tick triggers prediction

// Initialize Atrion
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATE ---
type LODLevel = 'HIGH' | 'MEDIUM' | 'LOW'
let currentLOD: LODLevel = 'HIGH'
let tickCount = 0

const stats = {
  ticks: 0,
  lodChanges: 0,
  predictiveSwitches: 0, // Switches triggered by trend, not resistance
  reactiveSwitches: 0, // Standard resistance-based switches
  budgetMisses: 0,
  avgLatency: 0,
}

// Track saturation trend locally
const saturationHistory: number[] = []
const TREND_WINDOW = 5

function calculateLocalTrend(): number {
  if (saturationHistory.length < 2) return 0

  const recent = saturationHistory.slice(-TREND_WINDOW)
  if (recent.length < 2) return 0

  // Linear regression slope approximation
  const n = recent.length
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += recent[i]
    sumXY += i * recent[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return isNaN(slope) ? 0 : slope
}

// --- LOD DECISION ENGINE (PREDICTIVE) ---
function decideLOD(resistance: number, trend: number): { level: LODLevel; reason: string } {
  // PREDICTIVE: If trend is strongly positive, pre-degrade
  if (trend > TREND_THRESHOLD) {
    if (currentLOD === 'HIGH') {
      return { level: 'MEDIUM', reason: 'PREDICTIVE (trend)' }
    }
    if (currentLOD === 'MEDIUM') {
      return { level: 'LOW', reason: 'PREDICTIVE (trend)' }
    }
  }

  // REACTIVE: Standard resistance-based decision
  if (resistance >= THRESHOLDS.MEDIUM) {
    return { level: 'LOW', reason: 'REACTIVE (R≥30Ω)' }
  }
  if (resistance >= THRESHOLDS.HIGH) {
    return { level: 'MEDIUM', reason: 'REACTIVE (R≥15Ω)' }
  }

  return { level: 'HIGH', reason: 'NOMINAL' }
}

async function setLOD(level: LODLevel, reason: string): Promise<void> {
  if (level === currentLOD) return

  try {
    await axios.post(`${SERVER_URL}/lod`, { level })
    const oldLOD = currentLOD
    currentLOD = level
    stats.lodChanges++

    if (reason.startsWith('PREDICTIVE')) {
      stats.predictiveSwitches++
    } else if (reason.startsWith('REACTIVE')) {
      stats.reactiveSwitches++
    }

    console.log(`🎯 LOD SWITCH: ${oldLOD} → ${level} [${reason}] (tick #${tickCount})`)
  } catch (err) {
    console.log(`❌ Failed to set LOD: ${level}`)
  }
}

// --- GAME LOOP ---
async function gameTick(players: number): Promise<void> {
  tickCount++
  stats.ticks++

  const start = Date.now()

  try {
    const response = await axios.post(`${SERVER_URL}/tick`, { players }, { timeout: 5000 })
    const latencyMs = Date.now() - start
    const data = response.data

    stats.avgLatency = (stats.avgLatency * (stats.ticks - 1) + latencyMs) / stats.ticks

    if (data.budgetMissed) {
      stats.budgetMisses++
    }

    // Track saturation for local trend calculation
    saturationHistory.push(data.saturation)
    if (saturationHistory.length > TREND_WINDOW * 2) {
      saturationHistory.shift()
    }

    // Report to Atrion
    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: false,
      saturation: data.saturation,
    })

    const trend = calculateLocalTrend()
    const serverTrend = data.saturationTrend ?? 0

    // Log
    const icon = data.budgetMissed ? '⚠️ ' : '✅'
    console.log(
      `${icon} Tick#${tickCount} | LOD:${currentLOD} | ${data.latency}ms | ${players}p | trend:${(
        trend * 100
      ).toFixed(1)}%/tick`
    )

    // --- PREDICTIVE LOD DECISION ---
    const resistance = guard.getResistance(ROUTE_ID)
    const decision = decideLOD(resistance, trend)

    if (decision.level !== currentLOD) {
      await setLOD(decision.level, decision.reason)
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    guard.reportOutcome(ROUTE_ID, { latencyMs, isError: true })
    console.log(`🔥 Tick#${tickCount} FAILED (${latencyMs}ms)`)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  console.log(`\n🔮 PREDICTIVE LOD CONTROLLER started`)
  console.log(`   ├─ Target:    ${SERVER_URL}`)
  console.log(`   ├─ Thresholds (reactive):`)
  console.log(`   │   ├─ R < 15Ω:  HIGH (60Hz)`)
  console.log(`   │   ├─ R < 30Ω:  MEDIUM (30Hz)`)
  console.log(`   │   └─ R >= 30Ω: LOW (10Hz)`)
  console.log(`   ├─ Trend Threshold: ${TREND_THRESHOLD * 100}%/tick`)
  console.log(`   └─ Pattern:   Gradual ramp-up (tests prediction)\n`)

  // Phase 1: Stable low load
  console.log('📈 PHASE 1: Stable 10 players\n')
  for (let i = 0; i < 15; i++) {
    await gameTick(10)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('STABLE')

  // Phase 2: Gradual ramp-up (should trigger PREDICTIVE switch)
  console.log('\n📈 PHASE 2: Gradual ramp-up (10 → 60 players)\n')
  for (let i = 0; i < 20; i++) {
    const players = 10 + i * 2.5 // 10 → 60 over 20 ticks
    await gameTick(Math.round(players))
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('RAMP-UP')

  // Phase 3: Spike (tests combo of predictive + reactive)
  console.log('\n💥 PHASE 3: Sudden spike to 100 players\n')
  for (let i = 0; i < 15; i++) {
    await gameTick(100)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('SPIKE')

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 PREDICTIVE LOD RESULTS')
  console.log('='.repeat(60))
  console.log(`   Total LOD switches:     ${stats.lodChanges}`)
  console.log(`   ├─ Predictive:          ${stats.predictiveSwitches}`)
  console.log(`   └─ Reactive:            ${stats.reactiveSwitches}`)
  console.log('')
  if (stats.predictiveSwitches > 0) {
    console.log(`   ✅ SUCCESS: Predictive switching activated!`)
  } else {
    console.log(`   ⚠️  No predictive switches (trend threshold may need tuning)`)
  }
  console.log('='.repeat(60))

  console.log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printStats(label: string) {
  const resistance = guard.getResistance(ROUTE_ID)
  const trend = calculateLocalTrend()
  const budgetMissRate =
    stats.ticks > 0 ? ((stats.budgetMisses / stats.ticks) * 100).toFixed(1) : '0'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${label}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`   Ticks:         ${stats.ticks}`)
  console.log(`   Current LOD:   ${currentLOD}`)
  console.log(
    `   LOD Changes:   ${stats.lodChanges} (${stats.predictiveSwitches}P / ${stats.reactiveSwitches}R)`
  )
  console.log(`   Budget Misses: ${stats.budgetMisses} (${budgetMissRate}%)`)
  console.log(`   Resistance:    ${resistance.toFixed(1)}Ω`)
  console.log(`   Current Trend: ${(trend * 100).toFixed(2)}%/tick`)
  console.log(`${'='.repeat(60)}\n`)
}

runSimulation()
