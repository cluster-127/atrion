/**
 * Atrion Wind Tunnel: LOD Controller V2 (Soft Degradation Delay Fix)
 *
 * Enhanced controller that incorporates budget miss rate into stress signal,
 * enabling faster LOD switches when frame budget is consistently missed.
 *
 * Key difference from V1:
 * - Uses `budgetMissRate` from server response to amplify stress signal
 * - Configurable `BUDGET_MISS_WEIGHT` to tune sensitivity
 *
 * Run: npx tsx lab/game-lod-v2/lod-controller.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3006'
const ROUTE_ID = 'game-server-v2'

// LOD Thresholds (same as V1)
const THRESHOLDS = {
  HIGH: 15, // R < 15Ω → 60Hz
  MEDIUM: 30, // R < 30Ω → 30Hz
  // R >= 30Ω → 10Hz (LOW)
}

// NEW: Budget miss weight - amplifies stress when frames are missed
// Higher value = faster LOD switch when budget is missed
const BUDGET_MISS_WEIGHT = 3.0

// Initialize Atrion
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATE ---
type LODLevel = 'HIGH' | 'MEDIUM' | 'LOW'
let currentLOD: LODLevel = 'HIGH'
let tickCount = 0
let firstLODSwitchTick: number | null = null

const stats = {
  ticks: 0,
  lodChanges: 0,
  budgetMisses: 0,
  avgLatency: 0,
  firstSwitchTick: null as number | null,
}

// --- LOD DECISION ENGINE ---
function decideLOD(resistance: number): LODLevel {
  if (resistance < THRESHOLDS.HIGH) return 'HIGH'
  if (resistance < THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

async function setLOD(level: LODLevel): Promise<void> {
  if (level === currentLOD) return

  try {
    await axios.post(`${SERVER_URL}/lod`, { level })
    const oldLOD = currentLOD
    currentLOD = level
    stats.lodChanges++

    if (firstLODSwitchTick === null) {
      firstLODSwitchTick = tickCount
      stats.firstSwitchTick = tickCount
    }

    console.log(`🎯 LOD SWITCH: ${oldLOD} → ${level} (tick #${tickCount})`)
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

    // Update running average
    stats.avgLatency = (stats.avgLatency * (stats.ticks - 1) + latencyMs) / stats.ticks

    // Track budget misses
    if (data.budgetMissed) {
      stats.budgetMisses++
    }

    // --- V2 ENHANCEMENT: Stress amplification based on budget miss rate ---
    // If budgetMissRate is high, we amplify the latency signal to force faster R increase
    const budgetMissRate = data.budgetMissRate ?? 0
    const stressAmplifier = 1 + budgetMissRate * BUDGET_MISS_WEIGHT

    const amplifiedLatency = latencyMs * stressAmplifier

    guard.reportOutcome(ROUTE_ID, {
      latencyMs: amplifiedLatency,
      isError: false,
      saturation: players / 100, // Normalize to 0-1
    })

    // Log
    const icon = data.budgetMissed ? '⚠️ ' : '✅'
    const missRateStr = (budgetMissRate * 100).toFixed(0)
    console.log(
      `${icon} Tick#${tickCount} | LOD:${currentLOD} | ${data.latency}ms/${
        data.frameBudget
      }ms | ${players}p | miss:${missRateStr}% | amp:${stressAmplifier.toFixed(2)}x`
    )
  } catch (err) {
    const latencyMs = Date.now() - start
    guard.reportOutcome(ROUTE_ID, { latencyMs, isError: true })
    console.log(`🔥 Tick#${tickCount} FAILED (${latencyMs}ms)`)
  }

  // --- LOD DECISION ---
  const resistance = guard.getResistance(ROUTE_ID)
  const targetLOD = decideLOD(resistance)

  if (targetLOD !== currentLOD) {
    await setLOD(targetLOD)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  console.log(`\n🎮 GAME LOD CONTROLLER V2 (Soft Degradation Fix)`)
  console.log(`   ├─ Target:    ${SERVER_URL}`)
  console.log(`   ├─ Thresholds:`)
  console.log(`   │   ├─ R < 15Ω:  HIGH (60Hz)`)
  console.log(`   │   ├─ R < 30Ω:  MEDIUM (30Hz)`)
  console.log(`   │   └─ R >= 30Ω: LOW (10Hz)`)
  console.log(`   ├─ Budget Miss Weight: ${BUDGET_MISS_WEIGHT}x`)
  console.log(`   └─ Pattern:   Player count ramp-up (testing faster response)\n`)

  // Phase 1: Low player count (10 players)
  console.log('📈 PHASE 1: 10 players (baseline)\n')
  for (let i = 0; i < 20; i++) {
    await gameTick(10)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 1')

  // Phase 2: Medium player count (30 players) - V1 failed to switch here
  console.log('\n📈 PHASE 2: 30 players (V1 failed here)\n')
  for (let i = 0; i < 20; i++) {
    await gameTick(30)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 2')

  // Phase 3: High player count (60 players)
  console.log('\n🔥 PHASE 3: 60 players (heavy load)\n')
  for (let i = 0; i < 20; i++) {
    await gameTick(60)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 3')

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 V2 RESULTS')
  console.log('='.repeat(60))
  if (stats.firstSwitchTick !== null) {
    console.log(`   First LOD switch at tick: #${stats.firstSwitchTick}`)
    console.log(`   ✅ SUCCESS: Switch occurred within ${stats.firstSwitchTick} ticks`)
  } else {
    console.log(`   ❌ FAIL: No LOD switch occurred!`)
  }
  console.log('='.repeat(60))

  console.log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printStats(label: string) {
  const resistance = guard.getResistance(ROUTE_ID)
  const budgetMissRate =
    stats.ticks > 0 ? ((stats.budgetMisses / stats.ticks) * 100).toFixed(1) : '0'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${label}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`   Ticks:         ${stats.ticks}`)
  console.log(`   Current LOD:   ${currentLOD}`)
  console.log(`   LOD Changes:   ${stats.lodChanges}`)
  console.log(`   Budget Misses: ${stats.budgetMisses} (${budgetMissRate}%)`)
  console.log(`   Avg Latency:   ${stats.avgLatency.toFixed(1)}ms`)
  console.log(`   Resistance:    ${resistance.toFixed(1)}Ω`)
  console.log(`${'='.repeat(60)}\n`)
}

runSimulation()
