/**
 * Atrion Wind Tunnel: Chaos Server
 *
 * A deliberately unstable server for testing Atrion's fault tolerance.
 *
 * Behavior:
 * - 30% chance: Latency spike (500ms - 2500ms)
 * - 10% chance: 500 error (simulated DB failure)
 * - 60% chance: Normal response
 *
 * Run: npx tsx lab/chaos-server.ts
 */

import expressModule from 'express'

// Handle both ESM and CommonJS interop
const express = (expressModule as any).default ?? expressModule
const app = express()
const PORT = 3000

// Stats tracking
let totalRequests = 0
let successRequests = 0
let errorRequests = 0
let spikeRequests = 0

// Chaos middleware - AGGRESSIVE MODE
app.use(async (_req, res, next) => {
  totalRequests++
  const roll = Math.random()

  // SCENARIO 1: Latency Spike (30%) - More severe
  if (roll < 0.3) {
    spikeRequests++
    const delay = 1000 + Math.random() * 2500 // 1s - 3.5s (more severe)
    await new Promise((r) => setTimeout(r, delay))
  }

  // SCENARIO 2: Critical Failure (40%) - AGGRESSIVE
  if (roll > 0.6) {
    errorRequests++
    res.status(500).json({
      error: 'Database Connection Lost',
      timestamp: Date.now(),
    })
    return
  }

  successRequests++
  next()
})

// Target endpoint
app.get('/target', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    stats: {
      total: totalRequests,
      success: successRequests,
      errors: errorRequests,
      spikes: spikeRequests,
    },
  })
})

// Stats endpoint
app.get('/stats', (_req, res) => {
  res.json({
    total: totalRequests,
    success: successRequests,
    errors: errorRequests,
    spikes: spikeRequests,
    errorRate: totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(1) + '%' : '0%',
  })
})

app.listen(PORT, () => {
  console.log(`\n🌪️  CHAOS SERVER running on port ${PORT}`)
  console.log(`   ├─ Target: http://localhost:${PORT}/target`)
  console.log(`   ├─ Stats:  http://localhost:${PORT}/stats`)
  console.log(`   └─ Risks:  30% Latency Spike, 10% 500 Error\n`)
})
