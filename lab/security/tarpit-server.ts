/**
 * Atrion Wind Tunnel: Tarpit Server (Security Scenario)
 *
 * A server under attack that uses Atrion to implement "tarpit" defense.
 *
 * Tarpit Strategy:
 * - Normal users: Fast response
 * - Attackers: Intentionally slow response (waste their resources)
 * - High load: Reject suspicious requests
 *
 * Run: npx tsx lab/tarpit-server.ts
 */

import expressModule from 'express'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// Handle ESM/CJS interop
const express = (expressModule as any).default || expressModule
const app = express()

const PORT = 3003

// --- ATRION GUARD (Per-IP tracking) ---
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- METRICS ---
const metrics = {
  total: 0,
  normal: 0,
  suspicious: 0,
  blocked: 0,
  tarpitted: 0,
}

// --- SUSPICIOUS IP DETECTION (Simulated) ---
function isSuspiciousRequest(req: any): boolean {
  // In real world: check rate, headers, behavior patterns
  // For simulation: 30% of requests are "suspicious"
  const userAgent = req.headers['user-agent'] || ''

  // Simulate: requests without proper User-Agent are suspicious
  if (!userAgent || userAgent.includes('bot') || userAgent.includes('curl')) {
    return true
  }

  // Random 20% are also suspicious (simulating DDoS botnet)
  return Math.random() < 0.2
}

// --- TARPIT MIDDLEWARE ---
app.use(async (req: any, res: any, next: any) => {
  metrics.total++

  const clientIP = req.ip || req.connection?.remoteAddress || 'unknown'
  const routeId = `ip:${clientIP}`
  const isSuspicious = isSuspiciousRequest(req)

  if (isSuspicious) {
    metrics.suspicious++
  } else {
    metrics.normal++
  }

  // --- ATRION DECISION ---
  const canAccept = guard.canAccept(routeId)
  const resistance = guard.getResistance(routeId)

  // Strategy 1: Block if resistance too high
  if (!canAccept) {
    metrics.blocked++
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have been rate limited',
      retryAfter: 30,
    })
    return
  }

  // Strategy 2: Tarpit suspicious requests based on resistance
  if (isSuspicious && resistance > 15) {
    metrics.tarpitted++

    // Tarpit delay: proportional to resistance (up to 5 seconds)
    const tarpitDelay = Math.min((resistance - 10) * 100, 5000)

    console.log(`🕸️  TARPIT: ${routeId} delayed ${tarpitDelay}ms (R:${resistance.toFixed(1)}Ω)`)

    await new Promise((r) => setTimeout(r, tarpitDelay))
  }

  // Normal processing
  const start = Date.now()

  res.on('finish', () => {
    const latencyMs = Date.now() - start
    const isError = res.statusCode >= 400

    // Report with higher saturation weight for suspicious traffic
    const saturationPenalty = isSuspicious ? 0.5 : 0

    guard.reportOutcome(routeId, {
      latencyMs,
      isError,
      saturation: saturationPenalty,
    })
  })

  next()
})

// --- ENDPOINTS ---

// Protected resource
app.get('/api/data', (_req: any, res: any) => {
  // Simulate some work
  const data = {
    message: 'Protected data',
    timestamp: Date.now(),
    items: Array(10)
      .fill(null)
      .map((_, i) => ({ id: i, value: Math.random() })),
  }
  res.json(data)
})

// Login endpoint (high-value target)
app.post('/api/login', (req: any, res: any) => {
  // Simulate auth check
  const success = Math.random() > 0.3 // 70% success rate for legit users

  if (success) {
    res.json({ token: 'fake-jwt-token', expiresIn: 3600 })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// Health check (always fast)
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok' })
})

// Stats
app.get('/stats', (_req: any, res: any) => {
  res.json({
    ...metrics,
    suspiciousRate:
      metrics.total > 0 ? ((metrics.suspicious / metrics.total) * 100).toFixed(1) + '%' : '0%',
    blockRate:
      metrics.total > 0 ? ((metrics.blocked / metrics.total) * 100).toFixed(1) + '%' : '0%',
    tarpitRate:
      metrics.total > 0 ? ((metrics.tarpitted / metrics.total) * 100).toFixed(1) + '%' : '0%',
  })
})

app.listen(PORT, () => {
  console.log(`\n🛡️  TARPIT SERVER running on port ${PORT}`)
  console.log(`   ├─ API:    GET  http://localhost:${PORT}/api/data`)
  console.log(`   ├─ Login:  POST http://localhost:${PORT}/api/login`)
  console.log(`   ├─ Stats:  GET  http://localhost:${PORT}/stats`)
  console.log(`   └─ Mode:   Tarpit defense active\n`)
  console.log(`   Defense Strategy:`)
  console.log(`   ├─ Normal users: Fast response`)
  console.log(`   ├─ Suspicious + R>15Ω: Intentional delay (tarpit)`)
  console.log(`   └─ Blocked: 429 response\n`)
})
