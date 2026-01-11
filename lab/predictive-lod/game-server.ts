/**
 * Atrion Wind Tunnel: Game Server (Predictive LOD Scenario)
 *
 * Same as base game server, but with explicit saturation reporting
 * to enable predictive/anticipatory LOD decisions.
 *
 * Run: npx tsx lab/predictive-lod/game-server.ts
 */

import expressModule from 'express'

const express = (expressModule as any).default ?? expressModule
const app = express()
app.use(express.json())

const PORT = 3008

// --- GAME STATE ---
type LODLevel = 'HIGH' | 'MEDIUM' | 'LOW'

const state = {
  currentLOD: 'HIGH' as LODLevel,
  activePlayers: 0,
  tickCount: 0,
  playerHistory: [] as number[], // Track player count trend
  stats: {
    updates: 0,
    avgLatency: 0,
    lodChanges: [] as { tick: number; from: LODLevel; to: LODLevel }[],
  },
}

const HISTORY_WINDOW = 5 // Track last 5 ticks for trend

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

// --- GAME TICK ---
app.post('/tick', async (req: any, res: any) => {
  state.tickCount++
  state.stats.updates++
  const { players = 10 } = req.body
  state.activePlayers = players

  // Track player history for trend analysis
  state.playerHistory.push(players)
  if (state.playerHistory.length > HISTORY_WINDOW) {
    state.playerHistory.shift()
  }

  // Calculate saturation trend (derivative)
  let saturationTrend = 0
  if (state.playerHistory.length >= 2) {
    const recent = state.playerHistory.slice(-3)
    const oldAvg = recent.slice(0, -1).reduce((a, b) => a + b, 0) / (recent.length - 1)
    const newVal = recent[recent.length - 1]
    saturationTrend = (newVal - oldAvg) / 100 // Normalized per-tick change
  }

  // Simulate processing time
  const baseLatency = LOD_TICK_RATES[state.currentLOD] * 0.5
  const playerPenalty = players * 0.5
  const processingTime = baseLatency + playerPenalty + Math.random() * 5

  const loadFactor = players > 50 ? 1.5 : players > 30 ? 1.2 : 1.0
  const actualLatency = processingTime * loadFactor

  await new Promise((r) => setTimeout(r, actualLatency))

  // Update stats
  state.stats.avgLatency =
    (state.stats.avgLatency * (state.stats.updates - 1) + actualLatency) / state.stats.updates

  const frameBudget = LOD_TICK_RATES[state.currentLOD]
  const budgetMissed = actualLatency > frameBudget

  res.json({
    tick: state.tickCount,
    lod: state.currentLOD,
    players,
    latency: Math.round(actualLatency),
    frameBudget,
    budgetMissed,
    saturation: players / 100,
    saturationTrend, // NEW: Expose trend for predictive analysis
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
    playerHistory: state.playerHistory,
    lodChanges: state.stats.lodChanges,
  })
})

// --- RESET ---
app.post('/reset', (_req: any, res: any) => {
  state.currentLOD = 'HIGH'
  state.tickCount = 0
  state.playerHistory = []
  state.stats = { updates: 0, avgLatency: 0, lodChanges: [] }
  res.json({ status: 'reset' })
})

app.listen(PORT, () => {
  console.log(`\n🎮 PREDICTIVE LOD SERVER running on port ${PORT}`)
  console.log(`   ├─ Tick:   POST http://localhost:${PORT}/tick`)
  console.log(`   ├─ LOD:    POST http://localhost:${PORT}/lod`)
  console.log(`   ├─ Stats:  GET  http://localhost:${PORT}/stats`)
  console.log(`   └─ Mode:   Predictive LOD (trend analysis enabled)\n`)
})
