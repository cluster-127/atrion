/**
 * Atrion Wind Tunnel: IoT Fleet Client (Lossy Backpressure Test)
 *
 * Demonstrates Atrion's ability to implement SAMPLING (not rejection):
 * - Low resistance: Write every packet
 * - Medium resistance: Write 1 in 2 packets
 * - High resistance: Write 1 in 10 packets
 *
 * Key insight: Instead of error responses, we DROP packets gracefully.
 * GPS data is inherently lossy - missing 1 point out of 10 is acceptable.
 *
 * Run: npx tsx lab/iot/fleet-client.ts
 */

import axios from 'axios'
import fs from 'fs'
import { AtrionGuard } from '../../examples/wrapper-class.js'
import { consoleObserver } from '../../src/core/index.js'

// --- CONFIGURATION ---
const SERVER_URL = 'http://localhost:3010'
const LOG_FILE = 'logs/fleet-client.log'
const ROUTE_ID = 'gps-ingest'

// Fleet simulation
const FLEET_SIZE = 100 // 100 vehicles
const PACKETS_PER_VEHICLE = 50 // 50 GPS updates each
const TOTAL_PACKETS = FLEET_SIZE * PACKETS_PER_VEHICLE

// Sampling thresholds based on resistance
const SAMPLE_THRESHOLDS = [
  { maxR: 20, sampleRate: 1 }, // Low: write every packet
  { maxR: 40, sampleRate: 2 }, // Medium: write 1 in 2
  { maxR: 60, sampleRate: 5 }, // High: write 1 in 5
  { maxR: Infinity, sampleRate: 10 }, // Critical: write 1 in 10
]

// Initialize Atrion
const guard = new AtrionGuard({
  observer: consoleObserver,
  config: {
    scarFactor: 5,
    decayRate: 0.3,
  },
})

// --- STATE ---
const stats = {
  generated: 0,
  written: 0,
  dropped: 0,
  errors: 0,
}

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- SAMPLING LOGIC ---
function getSampleRate(): number {
  const resistance = guard.getResistance(ROUTE_ID)
  for (const threshold of SAMPLE_THRESHOLDS) {
    if (resistance < threshold.maxR) {
      return threshold.sampleRate
    }
  }
  return 10 // Default to aggressive sampling
}

// --- GPS DATA GENERATOR ---
function generateGpsPacket(vehicleId: number, seq: number) {
  return {
    vehicleId: `TRUCK-${vehicleId.toString().padStart(4, '0')}`,
    lat: 41.0 + Math.random() * 0.1,
    lng: 29.0 + Math.random() * 0.1,
    timestamp: Date.now(),
    seq,
  }
}

// --- INGEST LOGIC ---
async function ingestPacket(packet: any, sampleRate: number): Promise<void> {
  stats.generated++

  // Sampling: drop packets based on sample rate
  if (sampleRate > 1 && stats.generated % sampleRate !== 0) {
    stats.dropped++
    return // Silent drop - this is intentional lossy backpressure
  }

  const start = Date.now()
  try {
    const response = await axios.post(
      `${SERVER_URL}/ingest`,
      { ...packet, sampleRate },
      { timeout: 5000 }
    )
    const latencyMs = Date.now() - start

    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: false,
      saturation: response.data.saturation,
    })

    stats.written++

    // Log every 100 packets
    if (stats.generated % 100 === 0) {
      const r = guard.getResistance(ROUTE_ID)
      log(
        `📡 ${stats.generated}/${TOTAL_PACKETS} | ` +
          `W:${stats.written} D:${stats.dropped} | ` +
          `R:${r.toFixed(1)}Ω | ` +
          `Sample:1/${sampleRate}`
      )
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start
    stats.errors++

    guard.reportOutcome(ROUTE_ID, {
      latencyMs,
      isError: true,
    })
  }
}

// --- SIMULATION ---
async function runSimulation() {
  fs.mkdirSync('logs', { recursive: true })
  fs.writeFileSync(LOG_FILE, '')

  log(`\n📡 IOT FLEET SIMULATION started`)
  log(`   ├─ Fleet Size: ${FLEET_SIZE} vehicles`)
  log(`   ├─ Packets/Vehicle: ${PACKETS_PER_VEHICLE}`)
  log(`   ├─ Total Packets: ${TOTAL_PACKETS}`)
  log(`   └─ Strategy: Lossy Backpressure (Sampling)\n`)

  // Reset server stats
  await axios.post(`${SERVER_URL}/reset`)

  // Simulate burst traffic from fleet
  log('🚛 PHASE 1: Fleet burst (all vehicles reporting)\n')

  const startTime = Date.now()

  for (let seq = 0; seq < PACKETS_PER_VEHICLE; seq++) {
    // Each "tick" all vehicles report
    const sampleRate = getSampleRate()

    for (let v = 0; v < FLEET_SIZE; v++) {
      const packet = generateGpsPacket(v, seq)
      await ingestPacket(packet, sampleRate)
    }

    // Small delay between ticks
    await new Promise((r) => setTimeout(r, 10))
  }

  const elapsed = Date.now() - startTime

  // Report dropped packets to server
  await axios.post(`${SERVER_URL}/report-drops`, { count: stats.dropped })

  // Get final server stats
  const serverStats = (await axios.get(`${SERVER_URL}/stats`)).data

  // Final summary
  printFinalSummary(elapsed, serverStats)

  log('\n🏁 Simulation complete!')
  process.exit(0)
}

function printFinalSummary(elapsed: number, serverStats: any) {
  const writeRatio = ((stats.written / stats.generated) * 100).toFixed(1)
  const throughput = ((stats.written / elapsed) * 1000).toFixed(0)

  log(`\n${'='.repeat(60)}`)
  log(`📊 IOT DATA DAM FINAL RESULTS`)
  log(`${'='.repeat(60)}`)
  log(`   📡 TRAFFIC:`)
  log(`      Generated:  ${stats.generated.toLocaleString()} packets`)
  log(`      Written:    ${stats.written.toLocaleString()} packets`)
  log(`      Dropped:    ${stats.dropped.toLocaleString()} packets (intentional)`)
  log(`      Errors:     ${stats.errors}`)
  log(``)
  log(`   📈 PERFORMANCE:`)
  log(`      Write Ratio:  ${writeRatio}%`)
  log(`      Throughput:   ${throughput} writes/sec`)
  log(`      Duration:     ${(elapsed / 1000).toFixed(1)}s`)
  log(``)
  log(`   🎯 LOSSY BACKPRESSURE:`)
  log(
    `      ` +
      (stats.dropped > 0 && stats.errors === 0
        ? '✅ SUCCESS: Dropped packets gracefully, no errors!'
        : stats.errors > 0
        ? '⚠️ Some errors occurred'
        : '✅ No backpressure needed (low load)')
  )
  log(``)
  log(`   💾 SERVER STATS:`)
  log(`      Total Writes:  ${serverStats.totalWrites}`)
  log(`      Total Dropped: ${serverStats.totalDropped}`)
  log(`${'='.repeat(60)}`)
}

runSimulation()
