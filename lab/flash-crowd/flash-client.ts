/**
 * Atrion Wind Tunnel: Flash Crowd Client ("The Elon Tweet")
 *
 * Simulates a flash crowd scenario:
 * - Phase 1: Normal traffic (warm-up)
 * - Phase 2: Sudden 100x spike (the tweet)
 * - Phase 3: Gradual cooldown
 *
 * Tests Atrion's SATURATION pressure handling.
 *
 * Run: npx tsx lab/flash-client.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const TARGET_URL = 'http://localhost:3002/stable'
const ROUTE_ID = 'crypto-exchange'
const MAX_CONCURRENCY = 50 // Expected max concurrent requests

// Initialize Atrion with observer
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATS ---
let activeRequests = 0
let peakConcurrency = 0
let totalSent = 0
let totalBlocked = 0
let totalSuccess = 0
let totalFailed = 0

// --- REQUEST HANDLER ---
async function sendRequest(id: string): Promise<void> {
  activeRequests++
  peakConcurrency = Math.max(peakConcurrency, activeRequests)
  totalSent++

  // --- 1. SATURATION CHECK ---
  if (!guard.canAccept(ROUTE_ID)) {
    activeRequests--
    totalBlocked++
    const resistance = guard.getResistance(ROUTE_ID)
    console.log(`🛡️  ${id} BLOCKED (R:${resistance.toFixed(1)}Ω, Load:${activeRequests})`)
    return
  }

  const start = Date.now()
  try {
    const response = await axios.get(TARGET_URL, { timeout: 10000 })
    const latencyMs = Date.now() - start
    totalSuccess++

    // --- 2. SUCCESS FEEDBACK with SATURATION ---
    // Saturation = activeRequests / maxConcurrency (normalized 0-1)
    const saturation = activeRequests / MAX_CONCURRENCY
    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: false,
      saturation: Math.min(saturation, 1), // Cap at 1.0
    })

    // Visual feedback
    const icon = latencyMs > 200 ? '⚠️ ' : '✅'
    console.log(`${icon} ${id} OK (${latencyMs}ms, sat:${(saturation * 100).toFixed(0)}%)`)
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    totalFailed++

    const axiosError = err as { code?: string }
    const saturation = activeRequests / MAX_CONCURRENCY

    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: true,
      saturation: Math.min(saturation, 1),
    })

    console.log(`🔥 ${id} FAILED (${latencyMs}ms, code:${axiosError.code})`)
  } finally {
    activeRequests--
  }
}

// --- SCENARIO RUNNER ---
async function runScenario() {
  console.log(`\n🚀 FLASH CROWD TEST: "The Elon Tweet"\n`)

  // =========================================================================
  // PHASE 1: Normal Day (Warm-up)
  // =========================================================================
  console.log('📈 PHASE 1: Normal market day (50 requests, 100ms apart)\n')

  for (let i = 0; i < 50; i++) {
    sendRequest(`Normal-${i.toString().padStart(3, '0')}`)
    await new Promise((r) => setTimeout(r, 100)) // 10 req/sec
  }

  // Wait for Phase 1 to complete
  await new Promise((r) => setTimeout(r, 2000))
  printStats('PHASE 1 COMPLETE')

  // =========================================================================
  // PHASE 2: The Tweet (Flash Crowd)
  // =========================================================================
  console.log('\n🚨 PHASE 2: ELON TWEETED! Flash crowd incoming!\n')
  console.log('   Sending 200 requests in rapid succession...\n')

  // Send 200 requests with minimal delay (simulating sudden spike)
  const spikePromises: Promise<void>[] = []
  for (let i = 0; i < 200; i++) {
    // Stagger slightly to avoid overwhelming Promise queue
    const delay = i * 5 // 5ms between each request start
    spikePromises.push(
      new Promise((resolve) => {
        setTimeout(() => {
          sendRequest(`SPIKE-${i.toString().padStart(3, '0')}`).then(resolve)
        }, delay)
      })
    )
  }

  // Wait for all spike requests to complete
  await Promise.all(spikePromises)
  await new Promise((r) => setTimeout(r, 2000))
  printStats('PHASE 2 COMPLETE (SPIKE)')

  // =========================================================================
  // PHASE 3: Cooldown
  // =========================================================================
  console.log('\n📉 PHASE 3: Market cooling down (30 requests, slow pace)\n')

  for (let i = 0; i < 30; i++) {
    await sendRequest(`Cool-${i.toString().padStart(3, '0')}`)
    await new Promise((r) => setTimeout(r, 500)) // Slow: 2 req/sec
  }

  printStats('FINAL RESULTS')

  console.log('\n🏁 Test complete!')
  process.exit(0)
}

function printStats(label: string) {
  const blockRate = totalSent > 0 ? ((totalBlocked / totalSent) * 100).toFixed(1) : '0'
  const resistance = guard.getResistance(ROUTE_ID)
  const mode = guard.getMode(ROUTE_ID)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${label}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`   Total Sent:    ${totalSent}`)
  console.log(`   Success:       ${totalSuccess}`)
  console.log(`   Failed:        ${totalFailed}`)
  console.log(`   BLOCKED:       ${totalBlocked} (${blockRate}%)`)
  console.log(`   Peak Concur:   ${peakConcurrency}`)
  console.log(`   Resistance:    ${resistance.toFixed(1)}Ω`)
  console.log(`   Mode:          ${mode}`)
  console.log(`${'='.repeat(60)}\n`)
}

runScenario()
