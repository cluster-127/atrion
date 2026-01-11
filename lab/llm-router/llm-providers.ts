/**
 * Atrion Wind Tunnel: LLM Provider Simulation
 *
 * Simulates two LLM providers with different characteristics:
 * - GPT-4: High quality, slow, expensive, sometimes overloaded
 * - Llama-3: Good quality, fast, cheap, reliable
 *
 * Run: npx tsx lab/llm-router/llm-providers.ts
 */

import expressModule from 'express'

const express = (expressModule as any).default ?? expressModule
const app = express()
app.use(express.json())

const PORT = 3004

// --- PROVIDER STATS ---
const stats = {
  gpt4: { requests: 0, success: 0, overloaded: 0, avgLatency: 0, totalCost: 0 },
  llama3: { requests: 0, success: 0, overloaded: 0, avgLatency: 0, totalCost: 0 },
}

// --- GPT-4 SIMULATION ---
// High latency (500-2000ms), occasional overload (20%), expensive ($0.03/1k tokens)
app.post('/gpt4/chat', async (req: any, res: any) => {
  stats.gpt4.requests++
  const { tokens = 100 } = req.body || {}

  // 20% chance of overload during peak
  if (Math.random() < 0.2) {
    stats.gpt4.overloaded++
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000))
    return res.status(503).json({
      error: 'Server overloaded',
      message: 'The server is experiencing high load. Please try again later.',
      retryAfter: 30,
    })
  }

  // Normal response: 500-2000ms
  const latency = 500 + Math.random() * 1500
  await new Promise((r) => setTimeout(r, latency))

  const cost = (tokens / 1000) * 0.03 // $0.03 per 1k tokens
  stats.gpt4.success++
  stats.gpt4.totalCost += cost
  stats.gpt4.avgLatency =
    (stats.gpt4.avgLatency * (stats.gpt4.success - 1) + latency) / stats.gpt4.success

  res.json({
    model: 'gpt-4-turbo',
    response: 'This is a high-quality GPT-4 response with excellent reasoning.',
    tokens,
    latency: Math.round(latency),
    cost: cost.toFixed(4),
    quality: 0.95, // Quality score
  })
})

// --- LLAMA-3 SIMULATION ---
// Low latency (50-200ms), very reliable (2% error), cheap ($0.005/1k tokens)
app.post('/llama3/chat', async (req: any, res: any) => {
  stats.llama3.requests++
  const { tokens = 100 } = req.body || {}

  // 2% chance of error
  if (Math.random() < 0.02) {
    stats.llama3.overloaded++
    return res.status(503).json({
      error: 'Service temporarily unavailable',
    })
  }

  // Fast response: 50-200ms
  const latency = 50 + Math.random() * 150
  await new Promise((r) => setTimeout(r, latency))

  const cost = (tokens / 1000) * 0.005 // $0.005 per 1k tokens
  stats.llama3.success++
  stats.llama3.totalCost += cost
  stats.llama3.avgLatency =
    (stats.llama3.avgLatency * (stats.llama3.success - 1) + latency) / stats.llama3.success

  res.json({
    model: 'llama-3-70b',
    response: 'This is a good Llama-3 response with solid performance.',
    tokens,
    latency: Math.round(latency),
    cost: cost.toFixed(4),
    quality: 0.85, // Quality score
  })
})

// --- STATS ENDPOINT ---
app.get('/stats', (_req: any, res: any) => {
  const gpt4SuccessRate =
    stats.gpt4.requests > 0 ? ((stats.gpt4.success / stats.gpt4.requests) * 100).toFixed(1) : '0'
  const llama3SuccessRate =
    stats.llama3.requests > 0
      ? ((stats.llama3.success / stats.llama3.requests) * 100).toFixed(1)
      : '0'

  res.json({
    gpt4: {
      ...stats.gpt4,
      successRate: gpt4SuccessRate + '%',
      avgLatency: Math.round(stats.gpt4.avgLatency) + 'ms',
      totalCost: '$' + stats.gpt4.totalCost.toFixed(2),
    },
    llama3: {
      ...stats.llama3,
      successRate: llama3SuccessRate + '%',
      avgLatency: Math.round(stats.llama3.avgLatency) + 'ms',
      totalCost: '$' + stats.llama3.totalCost.toFixed(2),
    },
  })
})

// Reset
app.post('/reset', (_req: any, res: any) => {
  stats.gpt4 = { requests: 0, success: 0, overloaded: 0, avgLatency: 0, totalCost: 0 }
  stats.llama3 = { requests: 0, success: 0, overloaded: 0, avgLatency: 0, totalCost: 0 }
  res.json({ status: 'reset' })
})

app.listen(PORT, () => {
  console.log(`\n🤖 LLM PROVIDERS running on port ${PORT}`)
  console.log(`   ├─ GPT-4:   POST http://localhost:${PORT}/gpt4/chat`)
  console.log(`   │           └─ Slow (500-2000ms), 20% overload, $0.03/1k`)
  console.log(`   ├─ Llama-3: POST http://localhost:${PORT}/llama3/chat`)
  console.log(`   │           └─ Fast (50-200ms), 2% error, $0.005/1k`)
  console.log(`   └─ Stats:   GET  http://localhost:${PORT}/stats\n`)
})
