/**
 * Atrion Wind Tunnel: E-Commerce Server (Black Friday Simulation)
 *
 * Simulates a shared database backend serving two routes:
 * - /checkout/complete (HIGH priority - revenue critical)
 * - /product/search (LOW priority - expendable)
 *
 * Both routes share the same "database" that slows down under load.
 *
 * Port: 3009
 * Run: npx tsx lab/ecommerce/ecommerce-server.ts
 */

import express from 'express'
import fs from 'fs'

const app = express()
app.use(express.json())

const PORT = 3009
const LOG_FILE = 'logs/ecommerce-server.log'

// --- DATABASE SIMULATION ---
let dbLoad = 0 // 0-100%
let dbPhase: 'NORMAL' | 'STRESSED' | 'CRITICAL' = 'NORMAL'

// Simulate shared database latency based on load
function getDbLatency(): number {
  const baseLatency = 20
  const loadMultiplier = 1 + (dbLoad / 100) * 10 // 1x-11x based on load
  const jitter = Math.random() * 20

  return Math.floor(baseLatency * loadMultiplier + jitter)
}

// Simulate database errors under extreme load
function shouldDbError(): boolean {
  if (dbLoad < 70) return false
  if (dbLoad < 90) return Math.random() < 0.1 // 10% at 70-90%
  return Math.random() < 0.3 // 30% at 90%+
}

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- ROUTES ---

// HIGH PRIORITY: Checkout (revenue critical)
app.post('/checkout/complete', async (req, res) => {
  const start = Date.now()
  const dbLatency = getDbLatency()

  // Simulate DB operation
  await new Promise((r) => setTimeout(r, dbLatency))

  if (shouldDbError()) {
    res.status(503).json({
      route: 'checkout',
      error: 'Database timeout',
      latency: dbLatency,
      dbLoad,
    })
    return
  }

  res.json({
    route: 'checkout',
    success: true,
    latency: dbLatency,
    dbLoad,
    processingTime: Date.now() - start,
  })
})

// LOW PRIORITY: Product search (expendable)
app.post('/product/search', async (req, res) => {
  const start = Date.now()
  const dbLatency = getDbLatency()

  // Simulate DB operation
  await new Promise((r) => setTimeout(r, dbLatency))

  if (shouldDbError()) {
    res.status(503).json({
      route: 'search',
      error: 'Database timeout',
      latency: dbLatency,
      dbLoad,
    })
    return
  }

  res.json({
    route: 'search',
    success: true,
    latency: dbLatency,
    dbLoad,
    results: Math.floor(Math.random() * 100),
    processingTime: Date.now() - start,
  })
})

// Database load control
app.post('/db/load', (req, res) => {
  const { load } = req.body
  dbLoad = Math.max(0, Math.min(100, load))
  dbPhase = dbLoad < 50 ? 'NORMAL' : dbLoad < 80 ? 'STRESSED' : 'CRITICAL'
  log(`💾 DB Load changed: ${dbLoad}% (${dbPhase})`)
  res.json({ dbLoad, dbPhase })
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    dbLoad,
    dbPhase,
    avgLatency: getDbLatency(),
  })
})

// Stats
app.get('/stats', (req, res) => {
  res.json({
    dbLoad,
    dbPhase,
    expectedLatency: getDbLatency(),
    errorProbability: dbLoad < 70 ? 0 : dbLoad < 90 ? 0.1 : 0.3,
  })
})

// --- STARTUP ---
fs.mkdirSync('logs', { recursive: true })
fs.writeFileSync(LOG_FILE, '')

app.listen(PORT, () => {
  log(`\n🛒 E-COMMERCE SERVER running on port ${PORT}`)
  log(`   ├─ Checkout: POST http://localhost:${PORT}/checkout/complete`)
  log(`   ├─ Search:   POST http://localhost:${PORT}/product/search`)
  log(`   ├─ DB Load:  POST http://localhost:${PORT}/db/load`)
  log(`   ├─ Health:   GET  http://localhost:${PORT}/health`)
  log(`   └─ Mode:     Black Friday Simulation (shared DB)\n`)
})
