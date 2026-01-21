/**
 * Manual Test: Redis State Provider
 * Run: npx tsx lab/manual-test-redis.ts
 *
 * Requires: Redis server running on localhost:6379
 * Start with: docker run -p 6379:6379 redis:alpine
 */

import { Atrion, RedisStateProvider } from '../src/index.js'

async function main() {
  console.log('🚀 Redis State Provider Manual Test\n')

  // Create instance with Redis
  const atrion = new Atrion({
    provider: new RedisStateProvider({
      url: 'redis://localhost:6379',
      keyPrefix: 'atrion:test:',
    }),
    autoTuner: true,
  })

  console.log(`📦 Provider: ${atrion.providerName}`)

  try {
    await atrion.connect()
    console.log('🔌 Connected to Redis!\n')
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', (err as Error).message)
    console.log('\n💡 Start Redis with: docker run -p 6379:6379 redis:alpine')
    process.exit(1)
  }

  // Bootstrap phase
  console.log('📊 Bootstrap Phase (10 ticks)...')
  for (let i = 0; i < 10; i++) {
    atrion.route('api/checkout', { latencyMs: 50 })
  }
  console.log(`  → Mode: ${atrion.getState('api/checkout')?.mode}\n`)

  // Simulate scenarios
  console.log('📊 Operational Phase...\n')

  const scenarios = [
    { latencyMs: 50, label: 'Normal' },
    { latencyMs: 200, label: 'High latency' },
    { latencyMs: 500, label: 'Critical', errorRate: 0.5 },
    { latencyMs: 50, label: 'Recovery' },
  ]

  for (const { latencyMs, label, errorRate } of scenarios) {
    const decision = atrion.route('api/checkout', { latencyMs, errorRate })

    console.log(`[${label}] latency=${latencyMs}ms${errorRate ? `, error=${errorRate}` : ''}`)
    console.log(`  → Allow: ${decision.allow ? '✅' : '❌'}`)
    console.log(`  → Resistance: ${decision.resistance.toFixed(1)}Ω\n`)
  }

  // Final state
  const state = atrion.getState('api/checkout')
  console.log('📈 Final State:')
  console.log(`  Tick Count: ${state?.tickCount}`)
  console.log(`  Scar Tissue: ${state?.scarTissue.toFixed(2)}`)
  console.log(`  Mode: ${state?.mode}`)

  // Verify Redis persistence
  console.log('\n🔍 Verifying Redis persistence...')
  console.log('  (State is stored in Redis with key prefix "atrion:test:")')

  await atrion.disconnect()
  console.log('\n✅ Test complete!')
}

main().catch(console.error)
