/**
 * Atrion Wind Tunnel: Recovery Client (Circuit Breaker Exit Test)
 *
 * Tests Atrion's circuit breaker recovery behavior:
 * 1. Normal traffic → OPERATIONAL
 * 2. Spike traffic → CIRCUIT_BREAKER
 * 3. Recovery traffic → Should transition CIRCUIT_BREAKER → OPERATIONAL
 *
 * Key test: Does Atrion properly exit CB when system recovers?
 *
 * Run: npx tsx lab/cb-recovery/recovery-client.ts
 */

import axios from 'axios'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3007'
const ROUTE_ID = 'cb-recovery-test'

// Initialize Atrion
const guard = new AtrionGuard({
  observer: consoleObserver,
})

// --- STATE ---
let requestCount = 0
let cbTriggered = false
let cbExited = false
let lastState = 'BOOTSTRAP'

const stats = {
  requests: 0,
  errors: 0,
  cbTriggerRequest: null as number | null,
  cbExitRequest: null as number | null,
}

// --- REQUEST SENDER ---
async function sendRequest(): Promise<void> {
  requestCount++
  stats.requests++

  const start = Date.now()

  try {
    const response = await axios.post(`${SERVER_URL}/request`, {}, { timeout: 5000 })
    const latencyMs = Date.now() - start
    const data = response.data

    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: false,
      saturation: data.recoveryProgress < 50 ? 0.9 : 0.3,
    })

    console.log(
      `✅ Req#${requestCount} | ${data.phase} | ${data.latency}ms | recovery:${data.recoveryProgress}%`
    )
  } catch (err: any) {
    const latencyMs = Date.now() - start
    stats.errors++

    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: true,
    })

    const phase = err.response?.data?.phase ?? 'UNKNOWN'
    const recovery = err.response?.data?.recoveryProgress ?? 0
    console.log(
      `❌ Req#${requestCount} | ${phase} | ${latencyMs}ms | recovery:${recovery}% | ERROR`
    )
  }

  // Track state transitions
  const mode = guard.getMode(ROUTE_ID)
  if (mode !== lastState) {
    console.log(`\n🔄 STATE TRANSITION: ${lastState} → ${mode}\n`)

    if (mode === 'CIRCUIT_BREAKER' && !cbTriggered) {
      cbTriggered = true
      stats.cbTriggerRequest = requestCount
    }

    if (lastState === 'CIRCUIT_BREAKER' && mode === 'OPERATIONAL' && !cbExited) {
      cbExited = true
      stats.cbExitRequest = requestCount
    }

    lastState = mode
  }
}

// --- PHASE CONTROL ---
async function setServerPhase(phase: string): Promise<void> {
  try {
    await axios.post(`${SERVER_URL}/phase`, { phase })
    console.log(`\n📡 Server phase set to: ${phase}\n`)
  } catch (err) {
    console.log(`❌ Failed to set server phase: ${phase}`)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  console.log(`\n🔌 CB RECOVERY CLIENT started`)
  console.log(`   ├─ Target: ${SERVER_URL}`)
  console.log(`   └─ Testing: Circuit Breaker exit behavior\n`)

  // Phase 1: Normal operation (establish baseline)
  console.log('📈 PHASE 1: Normal operation (20 requests)\n')
  await setServerPhase('NORMAL')
  for (let i = 0; i < 20; i++) {
    await sendRequest()
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('NORMAL BASELINE')

  // Phase 2: Spike (trigger circuit breaker)
  console.log('\n💥 PHASE 2: Spike - triggering circuit breaker (30 requests)\n')
  await setServerPhase('SPIKE')
  for (let i = 0; i < 30; i++) {
    await sendRequest()
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('POST-SPIKE')

  // Phase 3: Recovery (test CB exit)
  // Recovery threshold = baseResistance * breakMultiplier * 0.5 = 10 * 10 * 0.5 = 50Ω
  console.log('\n📉 PHASE 3: Recovery - testing CB exit (80 requests, R must drop below 50Ω)\n')
  await setServerPhase('RECOVERY')
  for (let i = 0; i < 80; i++) {
    await sendRequest()
    await new Promise((r) => setTimeout(r, 100)) // Slower to allow recovery

    // Early exit if CB already recovered
    if (cbExited) {
      console.log('\n✅ CB exited early, stopping recovery phase\n')
      break
    }
  }
  printStats('POST-RECOVERY')

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 CB RECOVERY TEST RESULTS')
  console.log('='.repeat(60))

  if (cbTriggered) {
    console.log(`   ✅ Circuit Breaker triggered at request #${stats.cbTriggerRequest}`)
  } else {
    console.log(`   ⚠️  Circuit Breaker was NOT triggered`)
  }

  if (cbExited) {
    console.log(`   ✅ Circuit Breaker exited at request #${stats.cbExitRequest}`)
    console.log(`   ✅ SUCCESS: CB recovery mechanism working!`)
  } else {
    console.log(`   ❌ Circuit Breaker did NOT exit (stuck in CB state)`)
    console.log(`   ❌ FAIL: CB hysteresis issue confirmed`)
  }

  console.log(`\n   Final state: ${guard.getState(ROUTE_ID)}`)
  console.log(`   Final resistance: ${guard.getResistance(ROUTE_ID).toFixed(1)}Ω`)
  console.log('='.repeat(60))

  console.log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printStats(label: string) {
  const resistance = guard.getResistance(ROUTE_ID)
  const state = guard.getState(ROUTE_ID)
  const errorRate = stats.requests > 0 ? ((stats.errors / stats.requests) * 100).toFixed(1) : '0'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${label}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`   Requests:    ${stats.requests}`)
  console.log(`   Errors:      ${stats.errors} (${errorRate}%)`)
  console.log(`   State:       ${state}`)
  console.log(`   Resistance:  ${resistance.toFixed(1)}Ω`)
  console.log(`   CB Triggered: ${cbTriggered ? 'YES' : 'NO'}`)
  console.log(`   CB Exited:    ${cbExited ? 'YES' : 'NO'}`)
  console.log(`${'='.repeat(60)}\n`)
}

runSimulation()
