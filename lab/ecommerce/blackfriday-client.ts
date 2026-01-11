/**
 * Atrion Wind Tunnel: Black Friday Client (VIP Priority Test)
 *
 * Demonstrates Atrion's ability to protect revenue-critical routes
 * while shedding low-priority traffic during database stress.
 *
 * Key insights:
 * - Same database, different configs → different shedding behavior
 * - Search: High scarFactor (20), fast decay → quick to shed
 * - Checkout: Low scarFactor (2), slow decay → stubborn, keeps trying
 *
 * Run: npx tsx lab/ecommerce/blackfriday-client.ts
 */

import axios from 'axios'
import fs from 'fs'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3009'
const LOG_FILE = 'logs/blackfriday-client.log'

// Route IDs
const CHECKOUT_ROUTE = 'checkout-vip'
const SEARCH_ROUTE = 'search-expendable'

// Business metrics
const BASKET_SIZE = 150 // Average checkout value: $150

// Different SLOs for different priorities
const checkoutSLO = {
  baselineLatencyMs: 100,
  maxAcceptableLatencyMs: 1000,
  targetErrorRate: 0.01,
  criticality: { latency: 10, error: 10, saturation: 5 }, // VIP
}

const searchSLO = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.05,
  criticality: { latency: 2, error: 2, saturation: 1 }, // Expendable
}

// Separate guards with DIFFERENT CONFIGS + SLOs
// Key difference: scarFactor and decayRate create priority tiers

// CHECKOUT: Stubborn - slow to react, keeps trying
const checkoutGuard = new AtrionGuard({
  observer: consoleObserver,
  slo: checkoutSLO,
  config: {
    scarFactor: 2, // Low trauma accumulation
    decayRate: 0.2, // Slow recovery (holds grudge less)
  },
})

// SEARCH: Sensitive - quick to shed, protects resources
const searchGuard = new AtrionGuard({
  observer: consoleObserver,
  slo: searchSLO,
  config: {
    scarFactor: 20, // High trauma accumulation
    decayRate: 0.5, // Fast recovery (but scars quickly)
  },
})

// --- STATE ---
const stats = {
  checkout: { total: 0, success: 0, shed: 0, errors: 0 },
  search: { total: 0, success: 0, shed: 0, errors: 0 },
  revenue: 0,
  lostRevenue: 0,
}

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- REQUEST SENDERS ---
async function sendCheckout(): Promise<void> {
  stats.checkout.total++

  // Ask Atrion if we should proceed
  const decision = checkoutGuard.canAccept(CHECKOUT_ROUTE)
  if (!decision) {
    stats.checkout.shed++
    stats.lostRevenue += BASKET_SIZE
    log(`💳 CHECKOUT | 🚫 SHED | Lost: $${BASKET_SIZE}`)
    return
  }

  const start = Date.now()
  try {
    const response = await axios.post(`${SERVER_URL}/checkout/complete`, {}, { timeout: 5000 })
    const latencyMs = Date.now() - start

    checkoutGuard.reportOutcome(CHECKOUT_ROUTE, {
      latencyMs,
      isError: false,
      saturation: response.data.dbLoad / 100,
    })

    stats.checkout.success++
    stats.revenue += BASKET_SIZE
    log(`💳 CHECKOUT | ✅ ${latencyMs}ms | +$${BASKET_SIZE} | DB:${response.data.dbLoad}%`)
  } catch (err: any) {
    const latencyMs = Date.now() - start
    stats.checkout.errors++
    stats.lostRevenue += BASKET_SIZE

    checkoutGuard.reportOutcome(CHECKOUT_ROUTE, {
      latencyMs,
      isError: true,
    })

    log(`💳 CHECKOUT | ❌ ${latencyMs}ms | Lost: $${BASKET_SIZE} | ERROR`)
  }
}

async function sendSearch(): Promise<void> {
  stats.search.total++

  // Ask Atrion if we should proceed
  const decision = searchGuard.canAccept(SEARCH_ROUTE)
  if (!decision) {
    stats.search.shed++
    log(`🔍 SEARCH   | 🚫 SHED (R=${searchGuard.getResistance(SEARCH_ROUTE).toFixed(1)}Ω)`)
    return
  }

  const start = Date.now()
  try {
    const response = await axios.post(`${SERVER_URL}/product/search`, {}, { timeout: 5000 })
    const latencyMs = Date.now() - start

    searchGuard.reportOutcome(SEARCH_ROUTE, {
      latencyMs,
      isError: false,
      saturation: response.data.dbLoad / 100,
    })

    stats.search.success++
    log(`🔍 SEARCH   | ✅ ${latencyMs}ms | DB:${response.data.dbLoad}%`)
  } catch (err: any) {
    const latencyMs = Date.now() - start
    stats.search.errors++

    searchGuard.reportOutcome(SEARCH_ROUTE, {
      latencyMs,
      isError: true,
    })

    log(`🔍 SEARCH   | ❌ ${latencyMs}ms | ERROR`)
  }
}

// --- DB CONTROL ---
async function setDbLoad(load: number): Promise<void> {
  try {
    await axios.post(`${SERVER_URL}/db/load`, { load })
    log(`\n💾 Database load set to: ${load}%\n`)
  } catch (err) {
    log(`❌ Failed to set DB load`)
  }
}

// --- SIMULATION ---
async function runSimulation() {
  fs.mkdirSync('logs', { recursive: true })
  fs.writeFileSync(LOG_FILE, '')

  log(`\n🛒 BLACK FRIDAY SIMULATION started`)
  log(`   ├─ Checkout: scarFactor=2, decayRate=0.2 (Stubborn VIP)`)
  log(`   ├─ Search:   scarFactor=20, decayRate=0.5 (Expendable)`)
  log(`   ├─ Basket:   $${BASKET_SIZE} average`)
  log(`   └─ Goal: Protect revenue while shedding browsing traffic\n`)

  // Phase 1: Normal traffic
  log('📈 PHASE 1: Normal traffic (DB at 30%)\n')
  await setDbLoad(30)
  for (let i = 0; i < 10; i++) {
    await sendCheckout()
    await sendSearch()
    await sendSearch() // 2x more search traffic
    await new Promise((r) => setTimeout(r, 100))
  }
  printStats('NORMAL')

  // Phase 2: Database stress begins
  log('\n📈 PHASE 2: Database stress (DB at 70%)\n')
  await setDbLoad(70)
  for (let i = 0; i < 15; i++) {
    await sendCheckout()
    await sendSearch()
    await sendSearch()
    await new Promise((r) => setTimeout(r, 100))
  }
  printStats('STRESSED')

  // Phase 3: Black Friday peak (DB critical)
  log('\n🔥 PHASE 3: BLACK FRIDAY PEAK (DB at 95%)\n')
  await setDbLoad(95)
  for (let i = 0; i < 25; i++) {
    await sendCheckout()
    await sendSearch()
    await sendSearch()
    await sendSearch() // Even more search spam
    await new Promise((r) => setTimeout(r, 50))
  }
  printStats('BLACK FRIDAY PEAK')

  // Final summary
  printFinalSummary()

  log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printStats(label: string) {
  const checkoutR = checkoutGuard.getResistance(CHECKOUT_ROUTE)
  const searchR = searchGuard.getResistance(SEARCH_ROUTE)

  log(`\n${'='.repeat(60)}`)
  log(`📊 ${label}`)
  log(`${'='.repeat(60)}`)
  log(`   CHECKOUT (VIP):`)
  log(
    `      Total: ${stats.checkout.total} | Success: ${stats.checkout.success} | Shed: ${stats.checkout.shed} | Errors: ${stats.checkout.errors}`
  )
  log(`      Resistance: ${checkoutR.toFixed(1)}Ω`)
  log(`   SEARCH (Expendable):`)
  log(
    `      Total: ${stats.search.total} | Success: ${stats.search.success} | Shed: ${stats.search.shed} | Errors: ${stats.search.errors}`
  )
  log(`      Resistance: ${searchR.toFixed(1)}Ω`)
  log(
    `   💰 Revenue: $${stats.revenue.toLocaleString()} | Lost: $${stats.lostRevenue.toLocaleString()}`
  )
  log(`${'='.repeat(60)}\n`)
}

function printFinalSummary() {
  const checkoutShedRate = ((stats.checkout.shed / stats.checkout.total) * 100).toFixed(1)
  const searchShedRate = ((stats.search.shed / stats.search.total) * 100).toFixed(1)
  const totalPotential = stats.revenue + stats.lostRevenue
  const efficiency =
    totalPotential > 0 ? ((stats.revenue / totalPotential) * 100).toFixed(1) : '100'

  log(`\n${'='.repeat(60)}`)
  log(`📊 BLACK FRIDAY FINAL RESULTS`)
  log(`${'='.repeat(60)}`)
  log(`   💳 CHECKOUT (Revenue Critical):`)
  log(`      Shed Rate: ${checkoutShedRate}%`)
  log(
    `      ` + (parseFloat(checkoutShedRate) < 10 ? '✅ PROTECTED!' : '⚠️ Some shedding occurred')
  )
  log(``)
  log(`   🔍 SEARCH (Expendable):`)
  log(`      Shed Rate: ${searchShedRate}%`)
  log(
    `      ` +
      (parseFloat(searchShedRate) > 30
        ? '✅ Successfully shed to protect checkout!'
        : '⚠️ Not enough shedding')
  )
  log(``)
  log(`   💰 REVENUE REPORT:`)
  log(`      Total Revenue:     $${stats.revenue.toLocaleString()}`)
  log(`      Potential Lost:    $${stats.lostRevenue.toLocaleString()}`)
  log(`      Revenue Efficiency: ${efficiency}%`)
  log(`      ` + (parseFloat(efficiency) > 80 ? '✅ GREAT!' : '⚠️ Needs improvement'))
  log(``)
  log(
    `   🎯 VIP PRIORITY: ` +
      (parseFloat(searchShedRate) > parseFloat(checkoutShedRate) * 3
        ? '✅ WORKING!'
        : '⚠️ Needs tuning')
  )
  log(`${'='.repeat(60)}`)
}

runSimulation()
