/**
 * Atrion Wind Tunnel: Smart LLM Router
 *
 * Uses Atrion to intelligently route requests between LLM providers:
 * - Primary: GPT-4 (high quality but slow/expensive)
 * - Fallback: Llama-3 (good quality, fast/cheap)
 *
 * Atrion decides based on:
 * - Resistance: If GPT-4 is struggling, fallback to Llama-3
 * - Latency: High latency increases momentum
 * - Errors: Overloads build scar tissue
 *
 * Run: npx tsx lab/llm-router/smart-router.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const PROVIDER_URL = 'http://localhost:3004'
const ROUTES = {
  gpt4: 'llm:gpt4',
  llama3: 'llm:llama3',
}

// Resistance threshold for fallback
const FALLBACK_THRESHOLD = 25 // If GPT-4 R > 25Ω, use Llama-3

// Initialize Atrion
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATS ---
const stats = {
  total: 0,
  gpt4: { sent: 0, success: 0, fallback: 0 },
  llama3: { sent: 0, success: 0 },
  totalCost: 0,
  costSaved: 0, // Money saved by using fallback
}

// --- SMART ROUTER ---
async function chat(prompt: string, tokens: number = 100): Promise<void> {
  stats.total++
  const reqId = `#${stats.total.toString().padStart(4, '0')}`

  // --- STEP 1: CHECK GPT-4 HEALTH ---
  const gpt4Resistance = guard.getResistance(ROUTES.gpt4)
  const gpt4Mode = guard.getMode(ROUTES.gpt4)
  const shouldFallback = gpt4Resistance > FALLBACK_THRESHOLD || gpt4Mode === 'CIRCUIT_BREAKER'

  if (shouldFallback) {
    stats.gpt4.fallback++
    console.log(`🔄 ${reqId} FALLBACK to Llama-3 (GPT-4 R:${gpt4Resistance.toFixed(1)}Ω)`)

    // Calculate cost savings
    const savedCost = (tokens / 1000) * (0.03 - 0.005)
    stats.costSaved += savedCost

    await callLlama3(reqId, tokens)
    return
  }

  // --- STEP 2: TRY GPT-4 ---
  await callGpt4(reqId, tokens)
}

async function callGpt4(reqId: string, tokens: number): Promise<void> {
  stats.gpt4.sent++
  const start = Date.now()

  try {
    const response = await axios.post(`${PROVIDER_URL}/gpt4/chat`, { tokens }, { timeout: 10000 })
    const latencyMs = Date.now() - start
    stats.gpt4.success++
    stats.totalCost += parseFloat(response.data.cost)

    // Report success to Atrion
    guard.reportOutcome(ROUTES.gpt4, { latencyMs, isError: false })

    const icon = latencyMs > 1000 ? '⚠️ ' : '🧠'
    console.log(`${icon} ${reqId} GPT-4 OK (${latencyMs}ms, $${response.data.cost})`)
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    const axiosError = err as { response?: { status?: number } }
    const isOverload = axiosError.response?.status === 503

    // Report failure to Atrion
    guard.reportOutcome(ROUTES.gpt4, { latencyMs, isError: isOverload })

    console.log(
      `🔥 ${reqId} GPT-4 FAILED (${latencyMs}ms) - ${isOverload ? 'OVERLOADED' : 'ERROR'}`
    )

    // Auto-retry with fallback
    console.log(`   └─ Retrying with Llama-3...`)
    stats.gpt4.fallback++
    await callLlama3(reqId + '-retry', tokens)
  }
}

async function callLlama3(reqId: string, tokens: number): Promise<void> {
  stats.llama3.sent++
  const start = Date.now()

  try {
    const response = await axios.post(`${PROVIDER_URL}/llama3/chat`, { tokens }, { timeout: 10000 })
    const latencyMs = Date.now() - start
    stats.llama3.success++
    stats.totalCost += parseFloat(response.data.cost)

    // Report success to Atrion (Llama-3 is always healthy)
    guard.reportOutcome(ROUTES.llama3, { latencyMs, isError: false })

    console.log(`🦙 ${reqId} Llama-3 OK (${latencyMs}ms, $${response.data.cost})`)
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    guard.reportOutcome(ROUTES.llama3, { latencyMs, isError: true })
    console.log(`❌ ${reqId} Llama-3 FAILED (${latencyMs}ms)`)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  console.log(`\n🤖 SMART LLM ROUTER started`)
  console.log(`   ├─ Primary:   GPT-4 (quality:0.95, $0.03/1k)`)
  console.log(`   ├─ Fallback:  Llama-3 (quality:0.85, $0.005/1k)`)
  console.log(`   ├─ Threshold: R > ${FALLBACK_THRESHOLD}Ω → Fallback`)
  console.log(`   └─ Pattern:   100 requests, bursty\n`)

  // Send 100 requests with varying pace
  for (let i = 0; i < 100; i++) {
    await chat(`Question ${i}: What is the meaning of life?`, 100 + Math.floor(Math.random() * 200))

    // Bursty traffic
    const delay = Math.random() < 0.6 ? 50 : 500
    await new Promise((r) => setTimeout(r, delay))

    // Print stats every 20 requests
    if ((i + 1) % 20 === 0) {
      printStats()
    }
  }

  printStats()
  console.log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printStats() {
  const fallbackRate =
    stats.gpt4.sent > 0
      ? ((stats.gpt4.fallback / (stats.gpt4.sent + stats.gpt4.fallback)) * 100).toFixed(1)
      : '0'
  const gpt4Resistance = guard.getResistance(ROUTES.gpt4)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ROUTER STATS (Total: ${stats.total})`)
  console.log(`${'='.repeat(60)}`)
  console.log(
    `   GPT-4:    Sent:${stats.gpt4.sent} Success:${stats.gpt4.success} R:${gpt4Resistance.toFixed(
      1
    )}Ω`
  )
  console.log(`   Llama-3:  Sent:${stats.llama3.sent} Success:${stats.llama3.success}`)
  console.log(`   Fallback: ${stats.gpt4.fallback} (${fallbackRate}%)`)
  console.log(`   ────────────────────────────────────────`)
  console.log(`   💰 Total Cost:  $${stats.totalCost.toFixed(2)}`)
  console.log(`   💵 Cost Saved:  $${stats.costSaved.toFixed(2)} (by using fallback)`)
  console.log(`${'='.repeat(60)}\n`)
}

runSimulation()
