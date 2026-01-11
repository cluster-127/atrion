/**
 * Atrion Wind Tunnel: IoT Data Dam (Lossy Backpressure Test)
 *
 * Simulates a GPS fleet tracking system where:
 * - Input rate: 10,000 Hz data stream
 * - DB capacity: 5,000 Hz write rate
 *
 * Instead of rejecting with errors, Atrion triggers SAMPLING:
 * - Low resistance: Write every packet
 * - High resistance: Write 1 in N packets (drop the rest)
 *
 * This is "Lossy Backpressure" - controlled data loss to prevent system crash.
 *
 * Port: 3010
 * Run: npx tsx lab/iot/iot-server.ts
 */

import express from 'express'
import fs from 'fs'

const app = express()
app.use(express.json())

const PORT = 3010
const LOG_FILE = 'logs/iot-server.log'

// --- DATABASE SIMULATION ---
const DB_CAPACITY = 5000 // Writes per second
let writeQueue = 0
let totalWrites = 0
let totalDropped = 0

// Simulate database write with capacity limits
async function dbWrite(gpsData: any): Promise<number> {
  writeQueue++

  // Simulate write latency based on queue depth
  const baseLatency = 5
  const queuePenalty = writeQueue * 0.5
  const latency = Math.floor(baseLatency + queuePenalty + Math.random() * 5)

  await new Promise((r) => setTimeout(r, latency))

  writeQueue--
  totalWrites++

  return latency
}

// --- LOGGING ---
function log(message: string): void {
  const line = message + '\n'
  fs.appendFileSync(LOG_FILE, line)
  console.log(message)
}

// --- ROUTES ---

// Ingest GPS data point
app.post('/ingest', async (req, res) => {
  const { vehicleId, lat, lng, timestamp, sampleRate } = req.body
  const actualSampleRate = sampleRate ?? 1

  // If sample rate > 1, this is a "sampled" packet (represents N packets)
  const start = Date.now()
  const latency = await dbWrite({ vehicleId, lat, lng, timestamp })

  res.json({
    success: true,
    latency,
    queueDepth: writeQueue,
    totalWrites,
    totalDropped,
    saturation: writeQueue / (DB_CAPACITY / 1000), // Saturation 0-1
    sampleRate: actualSampleRate,
  })
})

// Report dropped packets (client tells server how many it dropped)
app.post('/report-drops', (req, res) => {
  const { count } = req.body
  totalDropped += count
  res.json({ totalDropped })
})

// Health/stats
app.get('/stats', (req, res) => {
  res.json({
    queueDepth: writeQueue,
    totalWrites,
    totalDropped,
    writeRatio: totalWrites > 0 ? totalWrites / (totalWrites + totalDropped) : 1,
    saturation: writeQueue / (DB_CAPACITY / 1000),
  })
})

// Reset stats
app.post('/reset', (req, res) => {
  totalWrites = 0
  totalDropped = 0
  writeQueue = 0
  res.json({ reset: true })
})

// --- STARTUP ---
fs.mkdirSync('logs', { recursive: true })
fs.writeFileSync(LOG_FILE, '')

app.listen(PORT, () => {
  log(`\n📡 IOT DATA DAM SERVER running on port ${PORT}`)
  log(`   ├─ Ingest:  POST http://localhost:${PORT}/ingest`)
  log(`   ├─ Drops:   POST http://localhost:${PORT}/report-drops`)
  log(`   ├─ Stats:   GET  http://localhost:${PORT}/stats`)
  log(`   ├─ Capacity: ${DB_CAPACITY} writes/sec`)
  log(`   └─ Mode:    Lossy Backpressure Simulation\n`)
})
