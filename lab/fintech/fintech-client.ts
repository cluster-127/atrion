/**
 * Atrion Wind Tunnel: Fintech Traffic Client
 *
 * Simulates realistic fintech traffic patterns:
 * - 70% balance checks (read-heavy)
 * - 25% payments (write)
 * - 5% refunds (rare, risky)
 *
 * Each endpoint gets its own Atrion state.
 *
 * Run: npx tsx lab/fintech-client.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:3001'
const ROUTES = {
  payment: 'POST:/payment',
  refund: 'POST:/refund',
  balance: 'GET:/balance',
}

// Initialize Atrion for each route type
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATS ---
const stats = {
  total: 0,
  byRoute: {
    payment: { attempted: 0, blocked: 0, success: 0, failed: 0 },
    refund: { attempted: 0, blocked: 0, success: 0, failed: 0 },
    balance: { attempted: 0, blocked: 0, success: 0, failed: 0 },
  },
}

// --- TRAFFIC DISTRIBUTION ---
function selectOperation(): 'payment' | 'refund' | 'balance' {
  const roll = Math.random()

  // 70% balance checks
  if (roll < 0.7) return 'balance'

  // 25% payments
  if (roll < 0.95) return 'payment'

  // 5% refunds
  return 'refund'
}

// --- INTERVAL PATTERNS ---
function getNextInterval(): number {
  const mood = Math.random()

  // Burst (40%): 5-50ms
  if (mood < 0.4) return 5 + Math.random() * 45

  // Normal (40%): 50-200ms
  if (mood < 0.8) return 50 + Math.random() * 150

  // Pause (20%): 500-2000ms
  return 500 + Math.random() * 1500
}

// --- MAIN LOOP ---
async function runTraffic() {
  const tick = async () => {
    stats.total++
    const operation = selectOperation()
    const routeId = ROUTES[operation]
    const reqId = `#${stats.total.toString().padStart(4, '0')}`

    stats.byRoute[operation].attempted++

    // --- STEP 1: ATRION CHECK ---
    if (!guard.canAccept(routeId)) {
      stats.byRoute[operation].blocked++
      const resistance = guard.getResistance(routeId)
      console.log(`🛡️  ${reqId} [${operation.toUpperCase()}] BLOCKED (R:${resistance.toFixed(1)}Ω)`)
      setTimeout(tick, getNextInterval())
      return
    }

    // --- STEP 2: EXECUTE REQUEST ---
    const start = Date.now()
    try {
      let response

      switch (operation) {
        case 'payment':
          response = await axios.post(
            `${BASE_URL}/payment`,
            { amount: Math.floor(100 + Math.random() * 900) },
            { timeout: 6000 }
          )
          break
        case 'refund':
          response = await axios.post(
            `${BASE_URL}/refund`,
            { transactionId: `TXN-${Date.now()}` },
            { timeout: 6000 }
          )
          break
        case 'balance':
          response = await axios.get(`${BASE_URL}/balance`, { timeout: 6000 })
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      const latencyMs = Date.now() - start
      stats.byRoute[operation].success++

      // --- STEP 3: SUCCESS FEEDBACK ---
      guard.reportOutcome(routeId, { latencyMs, isError: false })

      const icon = latencyMs > 500 ? '⚠️ ' : '✅'
      const extra = operation === 'payment' ? ` $${response.data.amount}` : ''
      console.log(`${icon} ${reqId} [${operation.toUpperCase()}] OK (${latencyMs}ms)${extra}`)
    } catch (err: unknown) {
      const latencyMs = Date.now() - start
      stats.byRoute[operation].failed++

      const axiosError = err as {
        response?: { status?: number; data?: { type?: string } }
        code?: string
      }
      const isSystemError =
        (axiosError.response?.status ?? 0) >= 500 || axiosError.code === 'ECONNRESET'
      const errorType = axiosError.response?.data?.type ?? 'unknown'

      // --- STEP 4: TRAUMA FEEDBACK ---
      guard.reportOutcome(routeId, { latencyMs, isError: isSystemError })

      console.log(`🔥 ${reqId} [${operation.toUpperCase()}] FAILED (${latencyMs}ms) [${errorType}]`)
    }

    setTimeout(tick, getNextInterval())
  }

  console.log(`\n💳 FINTECH CLIENT started`)
  console.log(`   ├─ Base URL: ${BASE_URL}`)
  console.log(`   ├─ Pattern:  70% balance, 25% payment, 5% refund`)
  console.log(`   └─ Routes:   ${Object.values(ROUTES).join(', ')}\n`)

  // Stats printer every 15 seconds
  setInterval(() => {
    console.log(`\n📊 FINTECH STATS (Total: ${stats.total})`)
    for (const [op, s] of Object.entries(stats.byRoute)) {
      const blockRate = s.attempted > 0 ? ((s.blocked / s.attempted) * 100).toFixed(1) : '0'
      const failRate = s.attempted > 0 ? ((s.failed / s.attempted) * 100).toFixed(1) : '0'
      const resistance = guard.getResistance(ROUTES[op as keyof typeof ROUTES])
      console.log(
        `   ${op.toUpperCase().padEnd(8)} | Att:${s.attempted} Blk:${
          s.blocked
        }(${blockRate}%) Fail:${s.failed}(${failRate}%) R:${resistance.toFixed(1)}Ω`
      )
    }
    console.log('')
  }, 15000)

  tick()
}

runTraffic()
