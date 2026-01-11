/**
 * Atrion Wind Tunnel: Domino Stopper Test Client
 *
 * Tests cascading failure prevention:
 * 1. Send normal traffic to A → works
 * 2. Kill C (downstream DB)
 * 3. Watch B fast-fail instead of waiting
 * 4. Watch A shed traffic to B
 * 5. Restore C → system recovers
 *
 * Run: npx tsx lab/microservices/domino-client.ts
 */

import axios from 'axios'
import fs from 'fs'

// --- CONFIGURATION ---
const SERVICE_A = 'http://localhost:3011'
const SERVICE_C = 'http://localhost:3013'
const LOG_FILE = 'logs/domino-client.log'

// --- STATE ---
const stats = {
  phase1: { total: 0, success: 0, fastFail: 0, errors: 0 },
  phase2: { total: 0, success: 0, fastFail: 0, errors: 0 },
  phase3: { total: 0, success: 0, fastFail: 0, errors: 0 },
}

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- REQUEST SENDER ---
async function sendRequest(phase: keyof typeof stats): Promise<void> {
  stats[phase].total++

  const start = Date.now()
  try {
    const response = await axios.post(`${SERVICE_A}/request`, {}, { timeout: 10000 })
    const latency = Date.now() - start

    stats[phase].success++
    log(`✅ ${latency}ms | Chain: ${response.data.chain}`)
  } catch (err: any) {
    const latency = Date.now() - start
    const isFastFail = err.response?.data?.fastFail === true

    if (isFastFail) {
      stats[phase].fastFail++
      log(`🛑 ${latency}ms | FAST FAIL (no wait, circuit open)`)
    } else {
      stats[phase].errors++
      log(`❌ ${latency}ms | ERROR (waited for timeout)`)
    }
  }
}

// --- CONTROL ---
async function toggleServiceC(): Promise<void> {
  try {
    const resp = await axios.post(`${SERVICE_C}/health-toggle`)
    log(`\n⚡ Service C toggled: ${resp.data.healthy ? 'HEALTHY' : 'FAILED'}\n`)
  } catch (err) {
    log(`❌ Failed to toggle Service C`)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  fs.mkdirSync('logs', { recursive: true })
  fs.writeFileSync(LOG_FILE, '')

  log(`\n🔗 DOMINO STOPPER TEST started`)
  log(`   ├─ Chain: A → B → C`)
  log(`   └─ Goal: Prevent cascading failures\n`)

  // Phase 1: Normal traffic (C is healthy)
  log('📈 PHASE 1: Normal traffic (C healthy)\n')
  for (let i = 0; i < 10; i++) {
    await sendRequest('phase1')
    await new Promise((r) => setTimeout(r, 100))
  }
  printPhaseStats('NORMAL', stats.phase1)

  // Phase 2: Kill C, watch fast-fail
  log('\n💥 PHASE 2: C FAILURE (watch fast-fail)\n')
  await toggleServiceC() // C goes down

  for (let i = 0; i < 15; i++) {
    await sendRequest('phase2')
    await new Promise((r) => setTimeout(r, 200))
  }
  printPhaseStats('C FAILED', stats.phase2)

  // Phase 3: Restore C, watch recovery
  log('\n📈 PHASE 3: RECOVERY (C restored)\n')
  await toggleServiceC() // C comes back

  // Wait for decay
  await new Promise((r) => setTimeout(r, 2000))

  for (let i = 0; i < 10; i++) {
    await sendRequest('phase3')
    await new Promise((r) => setTimeout(r, 100))
  }
  printPhaseStats('RECOVERED', stats.phase3)

  // Final summary
  printFinalSummary()

  log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printPhaseStats(label: string, phase: typeof stats.phase1) {
  log(`\n${'='.repeat(50)}`)
  log(`📊 ${label}`)
  log(`${'='.repeat(50)}`)
  log(`   Total: ${phase.total}`)
  log(`   Success: ${phase.success}`)
  log(`   Fast Fail: ${phase.fastFail} (good - didn't wait!)`)
  log(`   Errors: ${phase.errors} (bad - waited for timeout)`)
  log(`${'='.repeat(50)}\n`)
}

function printFinalSummary() {
  const totalFastFail = stats.phase2.fastFail + stats.phase3.fastFail
  const totalErrors = stats.phase1.errors + stats.phase2.errors + stats.phase3.errors

  log(`\n${'='.repeat(60)}`)
  log(`📊 DOMINO STOPPER FINAL RESULTS`)
  log(`${'='.repeat(60)}`)
  log(`   🟢 PHASE 1 (Healthy): ${stats.phase1.success}/${stats.phase1.total} success`)
  log(`   🔴 PHASE 2 (C Failed): ${stats.phase2.fastFail}/${stats.phase2.total} fast-failed`)
  log(`   🟢 PHASE 3 (Recovered): ${stats.phase3.success}/${stats.phase3.total} success`)
  log(``)
  log(`   🎯 DOMINO STOPPER:`)
  log(
    `      ` +
      (totalFastFail > totalErrors
        ? '✅ SUCCESS: Fast-fail prevented cascading waits!'
        : '⚠️ Needs tuning: Too many timeout waits')
  )
  log(``)
  log(`   📉 IMPACT:`)
  log(`      Fast Fails (instant): ${totalFastFail}`)
  log(`      Timeout Errors (slow): ${totalErrors}`)
  log(`${'='.repeat(60)}`)
}

runSimulation()
