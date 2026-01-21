/**
 * Manual Test: Atrion v2.0 Pluggable State Architecture
 * Run: npx tsx lab/manual-test-v2.ts
 */

import { Atrion, InMemoryProvider } from '../src/index.js'

async function main() {
  console.log('🚀 Atrion v2.0 Manual Test\n')

  // Create instance
  const atrion = new Atrion({
    provider: new InMemoryProvider(),
    autoTuner: true,
  })

  console.log(`📦 Provider: ${atrion.providerName}`)
  console.log(`🔌 Connected: ${atrion.isConnected}`)

  // Connect
  await atrion.connect()
  console.log(`🔌 Connected: ${atrion.isConnected}\n`)

  // Bootstrap phase (10 ticks)
  console.log('📊 Bootstrap Phase (10 ticks)...')
  for (let i = 0; i < 10; i++) {
    atrion.route('api/checkout', { latencyMs: 50 })
  }
  console.log(`  → Mode: ${atrion.getState('api/checkout')?.mode}\n`)

  // Simulate various scenarios
  console.log('📊 Operational Phase...\n')

  const scenarios = [
    { latencyMs: 50, label: 'Normal' },
    { latencyMs: 100, label: 'Slightly elevated' },
    { latencyMs: 200, label: 'High latency' },
    { latencyMs: 500, label: 'Critical', errorRate: 0.5 },
    { latencyMs: 50, label: 'Recovery' },
    { latencyMs: 50, label: 'Stable' },
  ]

  for (const { latencyMs, label, errorRate } of scenarios) {
    const decision = atrion.route('api/checkout', { latencyMs, errorRate })

    console.log(`[${label}] latency=${latencyMs}ms${errorRate ? `, error=${errorRate}` : ''}`)
    console.log(`  → Allow: ${decision.allow ? '✅' : '❌'}`)
    console.log(`  → Mode: ${decision.mode}`)
    console.log(`  → Resistance: ${decision.resistance.toFixed(1)}Ω`)
    console.log(`  → Reason: ${decision.reason}\n`)
  }

  // Show state
  const state = atrion.getState('api/checkout')
  console.log('📈 Final State:')
  console.log(`  Routes: ${atrion.getRoutes().join(', ')}`)
  console.log(`  Tick Count: ${state?.tickCount}`)
  console.log(`  Scar Tissue: ${state?.scarTissue.toFixed(2)}`)
  console.log(`  Mode: ${state?.mode}`)

  // AutoTuner stats
  const stats = atrion.getTunerStats()
  if (stats) {
    console.log('\n🎛️ AutoTuner Stats:')
    console.log(`  Mean (μ): ${stats.mean.toFixed(2)}`)
    console.log(`  Std Dev (σ): ${stats.stdDev.toFixed(2)}`)
    console.log(`  Sample Count: ${stats.sampleCount}`)
  }

  // Disconnect
  await atrion.disconnect()
  console.log('\n✅ Test complete!')
}

main().catch(console.error)
