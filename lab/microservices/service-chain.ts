/**
 * Atrion Wind Tunnel: Microservices Chain (Domino Stopper Test)
 *
 * Simulates a 3-tier microservice architecture:
 * - Service A (Frontend): Receives user requests
 * - Service B (Processing): Business logic
 * - Service C (Database API): Data layer (will become slow/fail)
 *
 * When C fails, Atrion at B should "Fast Fail" and signal A to stop sending.
 *
 * Ports: A=3011, B=3012, C=3013
 * Run: npx tsx lab/microservices/service-chain.ts
 */

import axios from 'axios'
import express from 'express'
import fs from 'fs'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const PORT_A = 3011
const PORT_B = 3012
const PORT_C = 3013
const LOG_FILE = 'logs/microservices.log'

// Service C state
let serviceC_healthy = true
let serviceC_latency = 20

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// ============================================================
// SERVICE C: Database API (becomes slow/fails)
// ============================================================
const appC = express()
appC.use(express.json())

appC.post('/query', async (req, res) => {
  if (!serviceC_healthy) {
    // Simulate timeout
    await new Promise((r) => setTimeout(r, 2000))
    res.status(503).json({ error: 'Service C unavailable' })
    return
  }

  await new Promise((r) => setTimeout(r, serviceC_latency))
  res.json({ data: 'result', latency: serviceC_latency })
})

appC.post('/health-toggle', (req, res) => {
  serviceC_healthy = !serviceC_healthy
  serviceC_latency = serviceC_healthy ? 20 : 2000
  log(`🔴 SERVICE C: ${serviceC_healthy ? 'HEALTHY' : 'FAILED'}`)
  res.json({ healthy: serviceC_healthy })
})

appC.get('/health', (req, res) => {
  res.json({ healthy: serviceC_healthy, latency: serviceC_latency })
})

// ============================================================
// SERVICE B: Processing (has Atrion guard for downstream C)
// ============================================================
const appB = express()
appB.use(express.json())

// Atrion guard for downstream Service C - AGGRESSIVE for fast-fail
const guardC = new AtrionGuard({
  observer: consoleObserver,
  config: {
    scarFactor: 50, // Very aggressive scar accumulation
    decayRate: 0.1, // Slow decay (holds grudge longer)
    breakMultiplier: 5, // Lower CB threshold (50Ω instead of 100Ω)
  },
})

appB.post('/process', async (req, res) => {
  const ROUTE_C = 'downstream-c'

  // Fast Fail: If C is in bad shape, don't even try
  if (!guardC.canAccept(ROUTE_C)) {
    log(`🛑 SERVICE B: Fast fail (C circuit open, R=${guardC.getResistance(ROUTE_C).toFixed(1)}Ω)`)
    res.status(503).json({
      error: 'Downstream unavailable',
      fastFail: true,
      resistance: guardC.getResistance(ROUTE_C),
    })
    return
  }

  const start = Date.now()
  try {
    const cResponse = await axios.post(`http://localhost:${PORT_C}/query`, {}, { timeout: 3000 })
    const latencyMs = Date.now() - start

    guardC.reportOutcome(ROUTE_C, {
      latencyMs,
      isError: false,
    })

    res.json({
      processed: true,
      cLatency: cResponse.data.latency,
      totalLatency: latencyMs,
      resistance: guardC.getResistance(ROUTE_C),
    })
  } catch (err: any) {
    const latencyMs = Date.now() - start

    guardC.reportOutcome(ROUTE_C, {
      latencyMs,
      isError: true,
    })

    log(
      `⚠️ SERVICE B: C call failed (${latencyMs}ms), R=${guardC.getResistance(ROUTE_C).toFixed(1)}Ω`
    )

    res.status(502).json({
      error: 'Downstream failed',
      latency: latencyMs,
      resistance: guardC.getResistance(ROUTE_C),
    })
  }
})

appB.get('/health', (req, res) => {
  const ROUTE_C = 'downstream-c'
  res.json({
    healthy: guardC.canAccept(ROUTE_C),
    resistance: guardC.getResistance(ROUTE_C),
    mode: guardC.getMode(ROUTE_C),
  })
})

// ============================================================
// SERVICE A: Frontend (has Atrion guard for downstream B)
// ============================================================
const appA = express()
appA.use(express.json())

// Atrion guard for downstream Service B - follows B's health
const guardB = new AtrionGuard({
  observer: consoleObserver,
  config: {
    scarFactor: 30, // Aggressive for cascade prevention
    decayRate: 0.2,
    breakMultiplier: 5,
  },
})

appA.post('/request', async (req, res) => {
  const ROUTE_B = 'downstream-b'

  // Check if B is healthy
  if (!guardB.canAccept(ROUTE_B)) {
    log(`🛑 SERVICE A: Fast fail (B circuit open)`)
    res.status(503).json({
      error: 'Service temporarily unavailable',
      fastFail: true,
    })
    return
  }

  const start = Date.now()
  try {
    const bResponse = await axios.post(`http://localhost:${PORT_B}/process`, {}, { timeout: 5000 })
    const latencyMs = Date.now() - start

    guardB.reportOutcome(ROUTE_B, {
      latencyMs,
      isError: false,
    })

    res.json({
      success: true,
      totalLatency: latencyMs,
      chain: 'A→B→C',
    })
  } catch (err: any) {
    const latencyMs = Date.now() - start
    const isFastFail = err.response?.data?.fastFail === true

    guardB.reportOutcome(ROUTE_B, {
      latencyMs,
      isError: true,
    })

    res.status(502).json({
      error: 'Request failed',
      fastFail: isFastFail,
      latency: latencyMs,
    })
  }
})

appA.get('/health', (req, res) => {
  const ROUTE_B = 'downstream-b'
  res.json({
    healthy: guardB.canAccept(ROUTE_B),
    resistance: guardB.getResistance(ROUTE_B),
  })
})

// ============================================================
// STARTUP
// ============================================================
fs.mkdirSync('logs', { recursive: true })
fs.writeFileSync(LOG_FILE, '')

appC.listen(PORT_C, () => {
  log(`🔵 SERVICE C (Database API) running on port ${PORT_C}`)
})

appB.listen(PORT_B, () => {
  log(`🟢 SERVICE B (Processing) running on port ${PORT_B}`)
})

appA.listen(PORT_A, () => {
  log(`🟡 SERVICE A (Frontend) running on port ${PORT_A}`)
  log(`\n📊 MICROSERVICES CHAIN:`)
  log(`   A (${PORT_A}) → B (${PORT_B}) → C (${PORT_C})`)
  log(`\n🎯 Toggle C health: POST http://localhost:${PORT_C}/health-toggle`)
  log(`   Send request:    POST http://localhost:${PORT_A}/request\n`)
})
