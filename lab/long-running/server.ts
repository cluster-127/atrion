/**
 * Long-Running Task Lab Scenario
 *
 * Demonstrates:
 * - Workload Profiles (HEAVY/EXTREME)
 * - Lease API with heartbeat
 * - AbortController for graceful termination
 * - Profile-aware pressure calculation
 *
 * Run: npx tsx lab/long-running/server.ts
 */

import { Atrion } from '../../src/atrion.js'

const atrion = new Atrion()

async function main() {
  await atrion.connect()
  console.log('🚀 Long-Running Task Lab')
  console.log('='.repeat(50))

  // Setup route profiles
  atrion.setRouteProfile('api/health', 'LIGHT')
  atrion.setRouteProfile('api/report', 'STANDARD')
  atrion.setRouteProfile('ml/inference', 'HEAVY')
  atrion.setRouteProfile('genom/sequence', 'EXTREME')

  console.log('\n📋 Route Profiles:')
  console.log('  api/health    → LIGHT (10ms baseline)')
  console.log('  api/report    → STANDARD (100ms baseline)')
  console.log('  ml/inference  → HEAVY (5s baseline)')
  console.log('  genom/sequence → EXTREME (60s baseline)')

  // Scenario 1: LIGHT task exceeding baseline
  console.log('\n\n📊 Scenario 1: LIGHT task with 50ms latency')
  console.log('-'.repeat(50))

  const lightDecision = atrion.route('api/health', { latencyMs: 50 })
  console.log(`  Decision: ${lightDecision.allow ? '✅ ALLOW' : '❌ DENY'}`)
  console.log(`  Resistance: ${lightDecision.resistance.toFixed(2)}Ω`)
  console.log(`  Note: 50ms is 5x baseline (10ms) → High pressure`)

  // Scenario 2: HEAVY task within baseline
  console.log('\n\n📊 Scenario 2: HEAVY task with 3s latency')
  console.log('-'.repeat(50))

  const heavyDecision = atrion.route('ml/inference', { latencyMs: 3000 })
  console.log(`  Decision: ${heavyDecision.allow ? '✅ ALLOW' : '❌ DENY'}`)
  console.log(`  Resistance: ${heavyDecision.resistance.toFixed(2)}Ω`)
  console.log(`  Note: 3s is under baseline (5s) → Low pressure`)

  // Scenario 3: Long-running task with Lease API
  console.log('\n\n📊 Scenario 3: Long-running ML Training with Lease')
  console.log('-'.repeat(50))

  const controller = new AbortController()

  try {
    const lease = await atrion.startTask('ml/inference', {
      profile: 'HEAVY',
      timeout: 10_000, // 10 second timeout for demo
      abortController: controller,
    })

    console.log(`  Lease ID: ${lease.id}`)
    console.log(`  Profile: ${lease.profile}`)
    console.log(`  Expires in: ${lease.remainingMs()}ms`)

    // Simulate work with heartbeats
    for (let i = 1; i <= 5; i++) {
      await sleep(500)
      lease.heartbeat({ progress: i / 5 })
      console.log(`  ❤️ Heartbeat ${i}/5 (progress: ${((i / 5) * 100).toFixed(0)}%)`)
    }

    console.log(`  Active tasks: ${atrion.getActiveTaskCount('ml/inference')}`)

    await lease.release('completed')
    console.log('  ✅ Task completed successfully')
  } catch (error) {
    console.error('  ❌ Task failed:', error)
  }

  // Scenario 4: Timeout demonstration
  console.log('\n\n📊 Scenario 4: Task Timeout (AbortController)')
  console.log('-'.repeat(50))

  const timeoutController = new AbortController()
  let wasAborted = false

  timeoutController.signal.addEventListener('abort', () => {
    wasAborted = true
    console.log('  ⚠️ AbortController triggered!')
  })

  const timeoutLease = await atrion.startTask('ml/inference', {
    profile: 'HEAVY',
    timeout: 1_000, // 1 second timeout
    abortController: timeoutController,
  })

  console.log(`  Lease expires in: ${timeoutLease.remainingMs()}ms`)
  console.log('  Waiting for timeout...')

  await sleep(1_500)

  console.log(`  Aborted: ${wasAborted ? '✅ Yes' : '❌ No'}`)
  console.log(`  Lease active: ${timeoutLease.isActive ? 'Yes' : 'No'}`)

  // Summary
  console.log('\n\n📊 Summary')
  console.log('='.repeat(50))
  console.log('✅ LIGHT profile penalizes slow health checks')
  console.log('✅ HEAVY profile tolerates 3s latency (within baseline)')
  console.log('✅ Lease API tracks progress with heartbeats')
  console.log('✅ AbortController enables graceful termination')

  await atrion.disconnect()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch(console.error)
