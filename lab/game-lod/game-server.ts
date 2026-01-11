/**
 * Atrion Wind Tunnel: Game Server (LOD Scenario)
 *
 * Simulates an MMO/Metaverse game server with:
 * - Position updates at configurable tick rates
 * - Dynamic LOD based on server load
 * - Natural latency increase under load
 *
 * LOD Levels:
 * - HIGH:   60Hz updates, full detail
 * - MEDIUM: 30Hz updates, reduced detail
 * - LOW:    10Hz updates, minimal detail
 *
 * Run: npx tsx lab/game-lod/game-server.ts
 */

import expressModule from 'express'

const express = (expressModule as any).default ?? expressModule
const app = express()
app.use(express.json())

const PORT = 3005

// --- GAME STATE ---
type LODLevel = 'HIGH' | 'MEDIUM' | 'LOW'

const state = {
  currentLOD: 'HIGH' as LODLevel,
  activePlayers: 0,
  tickCount: 0,
  stats: {
    updates: 0,
    avgLatency: 0,
    lodChanges: [] as { tick: number; from: LODLevel; to: LODLevel }[],
  },
}

// LOD tick rates (ms between updates)
const LOD_TICK_RATES: Record<LODLevel, number> = {
  HIGH: 16, // 60Hz
  MEDIUM: 33, // 30Hz
  LOW: 100, // 10Hz
}

// --- SET LOD ENDPOINT ---
app.post('/lod', (req: any, res: any) => {
  const { level } = req.body
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(level)) {
    return res.status(400).json({ error: 'Invalid LOD level' })
  }

  const oldLOD = state.currentLOD
  if (oldLOD !== level) {
    state.currentLOD = level
    state.stats.lodChanges.push({ tick: state.tickCount, from: oldLOD, to: level })
    console.log(`🎮 LOD Changed: ${oldLOD} → ${level}`)
  }

  res.json({
    lod: state.currentLOD,
    tickRate: LOD_TICK_RATES[state.currentLOD],
    hz: Math.round(1000 / LOD_TICK_RATES[state.currentLOD]),
  })
})

// --- GAME TICK (Position Update) ---
app.post('/tick', async (req: any, res: any) => {
  state.tickCount++
  state.stats.updates++
  const { players = 10 } = req.body
  state.activePlayers = players

  // Simulate processing time based on player count and LOD
  const baseLatency = LOD_TICK_RATES[state.currentLOD] * 0.5
  const playerPenalty = players * 0.5 // 0.5ms per player
  const processingTime = baseLatency + playerPenalty + Math.random() * 5

  // Under heavy load, latency increases
  const loadFactor = players > 50 ? 1.5 : players > 30 ? 1.2 : 1.0
  const actualLatency = processingTime * loadFactor

  await new Promise((r) => setTimeout(r, actualLatency))

  // Update running average
  state.stats.avgLatency =
    (state.stats.avgLatency * (state.stats.updates - 1) + actualLatency) / state.stats.updates

  // Check if we're missing frame budget
  const frameBudget = LOD_TICK_RATES[state.currentLOD]
  const budgetMissed = actualLatency > frameBudget

  res.json({
    tick: state.tickCount,
    lod: state.currentLOD,
    players,
    latency: Math.round(actualLatency),
    frameBudget,
    budgetMissed,
  })
})

// --- STATS ---
app.get('/stats', (_req: any, res: any) => {
  res.json({
    currentLOD: state.currentLOD,
    tickRate: LOD_TICK_RATES[state.currentLOD] + 'ms',
    hz: Math.round(1000 / LOD_TICK_RATES[state.currentLOD]) + 'Hz',
    tickCount: state.tickCount,
    activePlayers: state.activePlayers,
    avgLatency: Math.round(state.stats.avgLatency) + 'ms',
    lodChanges: state.stats.lodChanges,
  })
})

// --- RESET ---
app.post('/reset', (_req: any, res: any) => {
  state.currentLOD = 'HIGH'
  state.tickCount = 0
  state.stats = { updates: 0, avgLatency: 0, lodChanges: [] }
  res.json({ status: 'reset' })
})

app.listen(PORT, () => {
  console.log(`\n🎮 GAME SERVER running on port ${PORT}`)
  console.log(`   ├─ Tick:   POST http://localhost:${PORT}/tick`)
  console.log(`   ├─ LOD:    POST http://localhost:${PORT}/lod`)
  console.log(`   ├─ Stats:  GET  http://localhost:${PORT}/stats`)
  console.log(`   └─ Mode:   Dynamic LOD (60Hz → 30Hz → 10Hz)\n`)
})
