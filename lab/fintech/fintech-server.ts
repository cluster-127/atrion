/**
 * Atrion Wind Tunnel: Fintech Payment Gateway Simulation
 *
 * Realistic payment system with:
 * - Multiple endpoints (payment, refund, balance)
 * - Time-of-day traffic patterns
 * - Cascade failures (DB → Payment Provider → Card Network)
 * - Rate limiting simulation
 *
 * Run: npx tsx lab/fintech-server.ts
 */

import expressModule from 'express'

// Handle both ESM and CommonJS interop
const express = (expressModule as any).default ?? expressModule
const app = express()
app.use(express.json())

const PORT = 3001

// --- METRICS ---
const metrics = {
  payments: { total: 0, success: 0, failed: 0, slowCount: 0 },
  refunds: { total: 0, success: 0, failed: 0, slowCount: 0 },
  balance: { total: 0, success: 0, failed: 0, slowCount: 0 },
}

// --- TIME-OF-DAY SIMULATION ---
function getTimeOfDayFactor(): { load: number; errorRate: number; name: string } {
  const hour = new Date().getHours()

  // Peak hours: 12:00-14:00 and 18:00-21:00
  if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)) {
    return { load: 1.5, errorRate: 0.15, name: 'PEAK' }
  }

  // Night: 00:00-06:00 (maintenance window, higher errors)
  if (hour >= 0 && hour <= 6) {
    return { load: 0.3, errorRate: 0.25, name: 'MAINTENANCE' }
  }

  // Normal hours
  return { load: 1.0, errorRate: 0.05, name: 'NORMAL' }
}

// --- CASCADE FAILURE SIMULATION ---
type FailureType = 'none' | 'db' | 'provider' | 'network' | 'timeout'

function simulateFailure(baseErrorRate: number): { type: FailureType; latency: number } {
  const roll = Math.random()
  const timeOfDay = getTimeOfDayFactor()
  const effectiveErrorRate = baseErrorRate * timeOfDay.errorRate * 3

  // Success path
  if (roll > effectiveErrorRate) {
    // Normal latency: 20-100ms
    const normalLatency = 20 + Math.random() * 80

    // 20% chance of slow response (overloaded provider)
    if (Math.random() < 0.2) {
      return { type: 'none', latency: 500 + Math.random() * 1500 }
    }

    return { type: 'none', latency: normalLatency }
  }

  // Failure cascade (weighted by severity)
  const failRoll = Math.random()

  if (failRoll < 0.3) {
    // DB connection failure (fast fail)
    return { type: 'db', latency: 5 + Math.random() * 10 }
  } else if (failRoll < 0.6) {
    // Payment provider error (medium latency)
    return { type: 'provider', latency: 100 + Math.random() * 300 }
  } else if (failRoll < 0.85) {
    // Card network timeout (slow)
    return { type: 'network', latency: 2000 + Math.random() * 3000 }
  } else {
    // Full timeout
    return { type: 'timeout', latency: 5000 }
  }
}

// --- ENDPOINTS ---

// POST /payment - Process a payment
app.post('/payment', async (req: any, res: any) => {
  metrics.payments.total++
  const { amount = 100 } = req.body || {}

  const failure = simulateFailure(0.1) // 10% base error rate
  await new Promise((r) => setTimeout(r, failure.latency))

  if (failure.latency > 500) metrics.payments.slowCount++

  if (failure.type !== 'none') {
    metrics.payments.failed++
    const errors: Record<FailureType, { status: number; message: string }> = {
      none: { status: 200, message: '' },
      db: { status: 503, message: 'Database connection failed' },
      provider: { status: 502, message: 'Payment provider unavailable' },
      network: { status: 504, message: 'Card network timeout' },
      timeout: { status: 504, message: 'Request timeout' },
    }
    const err = errors[failure.type]
    return res.status(err.status).json({ error: err.message, type: failure.type })
  }

  metrics.payments.success++
  res.json({
    status: 'approved',
    transactionId: `TXN-${Date.now()}`,
    amount,
    latency: Math.round(failure.latency),
  })
})

// POST /refund - Process a refund
app.post('/refund', async (req: any, res: any) => {
  metrics.refunds.total++
  const { transactionId = 'TXN-0' } = req.body || {}

  // Refunds are riskier - higher error rate
  const failure = simulateFailure(0.15)
  await new Promise((r) => setTimeout(r, failure.latency))

  if (failure.latency > 500) metrics.refunds.slowCount++

  if (failure.type !== 'none') {
    metrics.refunds.failed++
    return res.status(500).json({ error: 'Refund failed', type: failure.type })
  }

  metrics.refunds.success++
  res.json({
    status: 'refunded',
    originalTransaction: transactionId,
    refundId: `REF-${Date.now()}`,
  })
})

// GET /balance - Check account balance
app.get('/balance', async (_req: any, res: any) => {
  metrics.balance.total++

  // Balance checks are usually fast and reliable
  const failure = simulateFailure(0.03)
  await new Promise((r) => setTimeout(r, failure.latency))

  if (failure.latency > 500) metrics.balance.slowCount++

  if (failure.type !== 'none') {
    metrics.balance.failed++
    return res.status(500).json({ error: 'Balance check failed' })
  }

  metrics.balance.success++
  res.json({
    balance: 10000 + Math.random() * 5000,
    currency: 'USD',
    timestamp: Date.now(),
  })
})

// GET /metrics - System metrics
app.get('/metrics', (_req: any, res: any) => {
  const timeOfDay = getTimeOfDayFactor()
  res.json({
    timeOfDay: timeOfDay.name,
    loadFactor: timeOfDay.load,
    baseErrorRate: timeOfDay.errorRate,
    endpoints: metrics,
  })
})

// Health check
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.listen(PORT, () => {
  const timeOfDay = getTimeOfDayFactor()
  console.log(`\n💳 FINTECH PAYMENT GATEWAY running on port ${PORT}`)
  console.log(`   ├─ Payment: POST http://localhost:${PORT}/payment`)
  console.log(`   ├─ Refund:  POST http://localhost:${PORT}/refund`)
  console.log(`   ├─ Balance: GET  http://localhost:${PORT}/balance`)
  console.log(`   ├─ Metrics: GET  http://localhost:${PORT}/metrics`)
  console.log(
    `   └─ Mode:    ${timeOfDay.name} (load: ${timeOfDay.load}x, errors: ${(
      timeOfDay.errorRate * 100
    ).toFixed(0)}%)\n`
  )
})
