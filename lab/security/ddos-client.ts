/**
 * Atrion Wind Tunnel: DDoS Attack Client (Security Scenario)
 *
 * Simulates a distributed attack with:
 * - Normal users (good traffic)
 * - Botnet (suspicious, rapid-fire)
 * - Credential stuffing (login attacks)
 *
 * Run: npx tsx lab/ddos-client.ts
 */

import axios from 'axios'

// --- CONFIGURATION ---
const TARGET_URL = 'http://localhost:3003'
const ATTACK_DURATION_MS = 30000 // 30 seconds

// --- STATS ---
const stats = {
  normal: { sent: 0, success: 0, blocked: 0, avgLatency: 0 },
  botnet: { sent: 0, success: 0, blocked: 0, avgLatency: 0 },
  credential: { sent: 0, success: 0, blocked: 0, avgLatency: 0 },
}

// --- NORMAL USER (Good traffic) ---
async function normalUser(id: number) {
  const start = Date.now()
  stats.normal.sent++

  try {
    await axios.get(`${TARGET_URL}/api/data`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      },
      timeout: 10000,
    })

    const latency = Date.now() - start
    stats.normal.success++
    stats.normal.avgLatency =
      (stats.normal.avgLatency * (stats.normal.success - 1) + latency) / stats.normal.success

    console.log(`✅ Normal-${id} OK (${latency}ms)`)
  } catch (err: any) {
    if (err.response?.status === 429) {
      stats.normal.blocked++
      console.log(`🚫 Normal-${id} BLOCKED (429)`)
    } else {
      console.log(`❌ Normal-${id} ERROR`)
    }
  }
}

// --- BOTNET (DDoS traffic) ---
async function botnetAttack(id: number) {
  const start = Date.now()
  stats.botnet.sent++

  try {
    await axios.get(`${TARGET_URL}/api/data`, {
      headers: {
        'User-Agent': 'curl/7.81.0', // Suspicious UA
      },
      timeout: 10000,
    })

    const latency = Date.now() - start
    stats.botnet.success++
    stats.botnet.avgLatency =
      (stats.botnet.avgLatency * (stats.botnet.success - 1) + latency) / stats.botnet.success

    // Long latency = tarpit working!
    const icon = latency > 1000 ? '🕸️ ' : '⚠️ '
    console.log(`${icon}Bot-${id} OK (${latency}ms) ${latency > 1000 ? '<- TARPITTED!' : ''}`)
  } catch (err: any) {
    if (err.response?.status === 429) {
      stats.botnet.blocked++
      console.log(`🛡️  Bot-${id} BLOCKED (429)`)
    } else {
      console.log(`❌ Bot-${id} ERROR`)
    }
  }
}

// --- CREDENTIAL STUFFING (Login attack) ---
async function credentialStuffing(id: number) {
  const start = Date.now()
  stats.credential.sent++

  try {
    await axios.post(
      `${TARGET_URL}/api/login`,
      { username: `user${id}`, password: 'password123' },
      {
        headers: {
          'User-Agent': 'python-requests/2.28.0', // Scripted attack
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    )

    const latency = Date.now() - start
    stats.credential.success++
    stats.credential.avgLatency =
      (stats.credential.avgLatency * (stats.credential.success - 1) + latency) /
      stats.credential.success

    const icon = latency > 1000 ? '🕸️ ' : '⚠️ '
    console.log(`${icon}Cred-${id} OK (${latency}ms)`)
  } catch (err: any) {
    if (err.response?.status === 429) {
      stats.credential.blocked++
      console.log(`🛡️  Cred-${id} BLOCKED (429)`)
    } else if (err.response?.status === 401) {
      // Expected for stuffing attempts
      const latency = Date.now() - start
      stats.credential.avgLatency =
        (stats.credential.avgLatency * stats.credential.sent + latency) /
        (stats.credential.sent + 1)
      console.log(`🔐 Cred-${id} AUTH FAIL (${latency}ms)`)
    } else {
      console.log(`❌ Cred-${id} ERROR`)
    }
  }
}

// --- ATTACK ORCHESTRATION ---
async function runAttack() {
  console.log(`\n🚨 DDoS ATTACK SIMULATION`)
  console.log(`   ├─ Target: ${TARGET_URL}`)
  console.log(`   ├─ Duration: ${ATTACK_DURATION_MS / 1000}s`)
  console.log(`   └─ Phases: Normal → Mixed → Full Attack → Recovery\n`)

  const startTime = Date.now()
  let normalId = 0
  let botId = 0
  let credId = 0

  // =========================================================================
  // PHASE 1: Normal traffic (5 seconds)
  // =========================================================================
  console.log('📈 PHASE 1: Normal traffic baseline\n')

  while (Date.now() - startTime < 5000) {
    normalUser(normalId++)
    await new Promise((r) => setTimeout(r, 200)) // 5 req/sec
  }

  printStats('PHASE 1 COMPLETE')

  // =========================================================================
  // PHASE 2: Attack begins (10 seconds)
  // =========================================================================
  console.log('\n🔥 PHASE 2: Attack begins!\n')

  const phase2Start = Date.now()
  while (Date.now() - phase2Start < 10000) {
    // Mix of traffic
    const roll = Math.random()

    if (roll < 0.3) {
      // 30% normal users
      normalUser(normalId++)
    } else if (roll < 0.7) {
      // 40% botnet DDoS
      botnetAttack(botId++)
    } else {
      // 30% credential stuffing
      credentialStuffing(credId++)
    }

    await new Promise((r) => setTimeout(r, 20)) // 50 req/sec mixed
  }

  printStats('PHASE 2 COMPLETE (ATTACK PEAK)')

  // =========================================================================
  // PHASE 3: DDoS intensifies (10 seconds)
  // =========================================================================
  console.log('\n💥 PHASE 3: FULL DDoS MODE!\n')

  const phase3Start = Date.now()
  while (Date.now() - phase3Start < 10000) {
    // Mostly attack traffic
    const roll = Math.random()

    if (roll < 0.1) {
      normalUser(normalId++) // Only 10% legit
    } else if (roll < 0.6) {
      botnetAttack(botId++) // 50% botnet
    } else {
      credentialStuffing(credId++) // 40% cred stuffing
    }

    await new Promise((r) => setTimeout(r, 10)) // 100 req/sec
  }

  printStats('PHASE 3 COMPLETE (FULL ATTACK)')

  // =========================================================================
  // PHASE 4: Attack subsides (5 seconds)
  // =========================================================================
  console.log('\n📉 PHASE 4: Attack subsiding...\n')

  const phase4Start = Date.now()
  while (Date.now() - phase4Start < 5000) {
    normalUser(normalId++)
    await new Promise((r) => setTimeout(r, 200))
  }

  printStats('FINAL RESULTS')

  console.log('\n🏁 Attack simulation complete!')
  process.exit(0)
}

function printStats(label: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📊 ${label}`)
  console.log(`${'='.repeat(70)}`)
  console.log(`   NORMAL USERS:`)
  console.log(
    `      Sent: ${stats.normal.sent} | Success: ${stats.normal.success} | Blocked: ${stats.normal.blocked}`
  )
  console.log(`      Avg Latency: ${stats.normal.avgLatency.toFixed(0)}ms`)
  console.log(`   BOTNET (DDoS):`)
  console.log(
    `      Sent: ${stats.botnet.sent} | Success: ${stats.botnet.success} | Blocked: ${stats.botnet.blocked}`
  )
  console.log(
    `      Avg Latency: ${stats.botnet.avgLatency.toFixed(0)}ms ${
      stats.botnet.avgLatency > 1000 ? '🕸️ TARPITTED!' : ''
    }`
  )
  console.log(`   CREDENTIAL STUFFING:`)
  console.log(
    `      Sent: ${stats.credential.sent} | Success: ${stats.credential.success} | Blocked: ${stats.credential.blocked}`
  )
  console.log(`      Avg Latency: ${stats.credential.avgLatency.toFixed(0)}ms`)
  console.log(`${'='.repeat(70)}\n`)
}

runAttack()
