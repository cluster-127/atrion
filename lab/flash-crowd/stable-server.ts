/**
 * Atrion Wind Tunnel: Stable Server for Flash Crowd Test
 *
 * A "healthy" server that becomes slow under load.
 * No random errors - only natural backpressure from event loop saturation.
 *
 * Run: npx tsx lab/stable-server.ts
 */

import expressModule from 'express'

// Handle both ESM and CommonJS interop
const express = (expressModule as any).default ?? expressModule
const app = express()

const PORT = 3002

// --- METRICS ---
let totalRequests = 0
let activeRequests = 0
let peakConcurrency = 0

// Endpoint that simulates "work"
app.get('/stable', async (_req: any, res: any) => {
  totalRequests++
  activeRequests++
  peakConcurrency = Math.max(peakConcurrency, activeRequests)

  // Simulate CPU-bound work that gets slower under load
  // More concurrent requests = more event loop contention
  const baseWork = 10 // Base 10ms work
  const loadPenalty = Math.min(activeRequests * 5, 500) // Up to 500ms penalty
  const workTime = baseWork + loadPenalty

  await new Promise((r) => setTimeout(r, workTime))

  activeRequests--

  res.json({
    status: 'ok',
    workTime,
    activeRequests,
    peakConcurrency,
    timestamp: Date.now(),
  })
})

// Stats endpoint
app.get('/stats', (_req: any, res: any) => {
  res.json({
    total: totalRequests,
    active: activeRequests,
    peak: peakConcurrency,
  })
})

// Reset stats
app.post('/reset', (_req: any, res: any) => {
  totalRequests = 0
  peakConcurrency = 0
  res.json({ status: 'reset' })
})

app.listen(PORT, () => {
  console.log(`\n🎯 STABLE SERVER running on port ${PORT}`)
  console.log(`   ├─ Endpoint: GET http://localhost:${PORT}/stable`)
  console.log(`   ├─ Stats:    GET http://localhost:${PORT}/stats`)
  console.log(`   └─ Behavior: Slows down under load (natural backpressure)\n`)
})
