/**
 * Atrion Wind Tunnel: Guardian Client
 *
 * A "drunken traffic" generator protected by Atrion.
 * Uses AtrionGuard from examples/wrapper-class.ts
 *
 * Traffic Pattern:
 * - 50%: Hyper Burst (10-80ms intervals)
 * - 30%: Casual Browsing (100-400ms intervals)
 * - 20%: Coffee Break (2000-5000ms intervals)
 *
 * Run: npx tsx lab/guardian-client.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const TARGET_URL = 'http://localhost:3000/target'
const ROUTE_ID = 'chaos-server'

// Initialize Atrion with console observer for visibility
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATS ---
let totalRequests = 0
let blockedRequests = 0
let successRequests = 0
let failedRequests = 0

// --- DRUNKEN TRAFFIC GENERATOR ---
function getNextInterval(): number {
  const mood = Math.random()

  // Mode 1: HYPER BURST (50%) - Machine gun fire
  if (mood < 0.5) return 10 + Math.random() * 70 // 10-80ms

  // Mode 2: CASUAL BROWSING (30%) - Normal user
  if (mood < 0.8) return 100 + Math.random() * 300 // 100-400ms

  // Mode 3: COFFEE BREAK (20%) - Deep silence / Recovery window
  return 2000 + Math.random() * 3000 // 2000-5000ms
}

// --- MAIN LOOP ---
async function runTraffic() {
  const tick = async () => {
    totalRequests++
    const reqId = `Req#${totalRequests.toString().padStart(4, '0')}`
    const nextDelay = Math.floor(getNextInterval())

    // --- STEP 1: PHYSICS CHECK ---
    if (!guard.canAccept(ROUTE_ID)) {
      blockedRequests++
      const resistance = guard.getResistance(ROUTE_ID)
      const mode = guard.getMode(ROUTE_ID)
      console.log(
        `🛡️  ${reqId} BLOCKED (R:${resistance.toFixed(1)}Ω Mode:${mode}) -> Cooling: ${nextDelay}ms`
      )
      setTimeout(tick, nextDelay)
      return
    }

    // --- STEP 2: ATTACK ---
    const start = Date.now()
    try {
      await axios.get(TARGET_URL, { timeout: 5000 })
      const latencyMs = Date.now() - start
      successRequests++

      // --- STEP 3: SUCCESS FEEDBACK ---
      guard.reportOutcome(ROUTE_ID, {
        latencyMs,
        isError: false,
      })

      // Visual: Yellow for high latency, green for normal
      const icon = latencyMs > 500 ? '⚠️ ' : '✅'
      console.log(`${icon} ${reqId} OK (${latencyMs}ms) -> Next: ${nextDelay}ms`)
    } catch (err: unknown) {
      const latencyMs = Date.now() - start
      failedRequests++

      // Determine if system error (5xx) or network error
      const axiosError = err as { response?: { status?: number }; code?: string }
      const isSystemError =
        (axiosError.response?.status ?? 0) >= 500 || axiosError.code === 'ECONNRESET'

      // --- STEP 4: TRAUMA FEEDBACK ---
      guard.reportOutcome(ROUTE_ID, {
        latencyMs,
        isError: isSystemError,
      })

      console.log(
        `🔥 ${reqId} FAILED (${latencyMs}ms, sys:${isSystemError}) -> Next: ${nextDelay}ms`
      )
    }

    // Loop
    setTimeout(tick, nextDelay)
  }

  console.log(`\n🚀 GUARDIAN CLIENT started`)
  console.log(`   ├─ Target: ${TARGET_URL}`)
  console.log(`   ├─ Route:  ${ROUTE_ID}`)
  console.log(`   └─ Pattern: Drunken Walk (Burst/Idle mixed)\n`)

  // Stats printer every 10 seconds
  setInterval(() => {
    const blockRate = totalRequests > 0 ? ((blockedRequests / totalRequests) * 100).toFixed(1) : '0'
    const failRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(1) : '0'
    console.log(
      `\n📊 STATS: Total:${totalRequests} Success:${successRequests} Failed:${failedRequests} Blocked:${blockedRequests} (${blockRate}% blocked, ${failRate}% failed)\n`
    )
  }, 10000)

  tick()
}

runTraffic()
