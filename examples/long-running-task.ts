/**
 * Long-Running Task Example
 *
 * Demonstrates Lease API for managing long-running operations.
 *
 * Run: npx tsx examples/long-running-task.ts
 */

import { Atrion } from '../src/atrion.js'

async function main() {
  const atrion = new Atrion()
  await atrion.connect()

  console.log('🏃 Long-Running Task Example\n')

  // Step 1: Start a long-running task with AbortController
  const controller = new AbortController()

  console.log('Starting ML training task...')
  const lease = await atrion.startTask('ml/training', {
    profile: 'HEAVY',
    timeout: 60_000, // 1 minute max
    abortController: controller,
  })

  console.log(`  Lease ID: ${lease.id}`)
  console.log(`  Profile: ${lease.profile}`)
  console.log(`  Expires: ${new Date(lease.expiresAt).toISOString()}\n`)

  // Step 2: Simulate work with periodic heartbeats
  const totalSteps = 10
  for (let step = 1; step <= totalSteps; step++) {
    // Check if aborted
    if (controller.signal.aborted) {
      console.log('Task was aborted!')
      break
    }

    // Simulate work
    await sleep(300)

    // Send heartbeat with progress
    lease.heartbeat({
      progress: step / totalSteps,
      status: `Processing batch ${step}/${totalSteps}`,
    })

    console.log(`  ❤️ Step ${step}/${totalSteps} (${((step / totalSteps) * 100).toFixed(0)}%)`)
  }

  // Step 3: Release the lease
  await lease.release('completed')
  console.log('\n✅ Task completed successfully!')

  // Cleanup
  await atrion.disconnect()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch(console.error)
