/**
 * Atrion Wind Tunnel: LOD Controller (Game Scenario)
 *
 * Uses Atrion to dynamically adjust game LOD based on server pressure:
 * - R < 15Ω:  HIGH (60Hz) - Full quality
 * - R < 30Ω:  MEDIUM (30Hz) - Reduced quality
 * - R >= 30Ω: LOW (10Hz) - Survival mode
 *
 * This demonstrates "Soft Degradation" - instead of hard failure,
 * the system gracefully reduces quality to maintain playability.
 *
 * Run: npx tsx lab/game-lod/lod-controller.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3005'
const ROUTE_ID = 'game-server'

// LOD Thresholds
const THRESHOLDS = {
  HIGH: 15, // R < 15Ω → 60Hz
  MEDIUM: 30, // R < 30Ω → 30Hz
  // R >= 30Ω → 10Hz (LOW)
}

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
  budgetMisses: 0,
  avgLatency: 0,
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
    console.log(`🎯 LOD SWITCH: ${oldLOD} → ${level}`)
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

    // Report to Atrion
    // Latency pressure increases with frame budget misses
    const latencyPenalty = data.budgetMissed ? latencyMs * 2 : latencyMs
    guard.reportOutcome(ROUTE_ID, {
      latencyMs: latencyPenalty,
      isError: false,
      saturation: players / 100, // Normalize to 0-1
    })

    // Log
    const icon = data.budgetMissed ? '⚠️ ' : '✅'
    console.log(
      `${icon} Tick#${tickCount} | LOD:${currentLOD} | ${data.latency}ms/${data.frameBudget}ms | ${players}p`
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
  console.log(`\n🎮 GAME LOD CONTROLLER started`)
  console.log(`   ├─ Target:    ${SERVER_URL}`)
  console.log(`   ├─ Thresholds:`)
  console.log(`   │   ├─ R < 15Ω:  HIGH (60Hz)`)
  console.log(`   │   ├─ R < 30Ω:  MEDIUM (30Hz)`)
  console.log(`   │   └─ R >= 30Ω: LOW (10Hz)`)
  console.log(`   └─ Pattern:   Player count ramp-up\n`)

  // Phase 1: Low player count (10 players)
  console.log('📈 PHASE 1: 10 players (light load)\n')
  for (let i = 0; i < 30; i++) {
    await gameTick(10)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 1')

  // Phase 2: Medium player count (30 players)
  console.log('\n📈 PHASE 2: 30 players (medium load)\n')
  for (let i = 0; i < 30; i++) {
    await gameTick(30)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 2')

  // Phase 3: High player count (60 players)
  console.log('\n🔥 PHASE 3: 60 players (heavy load)\n')
  for (let i = 0; i < 30; i++) {
    await gameTick(60)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 3')

  // Phase 4: Stress test (100 players)
  console.log('\n💥 PHASE 4: 100 players (STRESS TEST)\n')
  for (let i = 0; i < 30; i++) {
    await gameTick(100)
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('PHASE 4')

  // Phase 5: Recovery (20 players)
  console.log('\n📉 PHASE 5: 20 players (recovery)\n')
  for (let i = 0; i < 30; i++) {
    await gameTick(20)
    await new Promise((r) => setTimeout(r, 100))
  }
  printStats('FINAL')

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
