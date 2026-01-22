/**
 * Workload Profiles Example
 *
 * Shows how to use different profiles for heterogeneous workloads.
 *
 * Run: npx tsx examples/workload-profiles.ts
 */

import { Atrion } from '../src/atrion.js'

async function main() {
  const atrion = new Atrion()
  await atrion.connect()

  console.log('📋 Workload Profiles Example\n')

  // Configure route profiles based on expected behavior
  atrion.setRouteProfile('api/health', 'LIGHT') // 10ms baseline
  atrion.setRouteProfile('api/users', 'STANDARD') // 100ms baseline
  atrion.setRouteProfile('ml/inference', 'HEAVY') // 5s baseline
  atrion.setRouteProfile('genom/sequence', 'EXTREME') // 60s baseline

  // Simulate different workloads
  const workloads = [
    { route: 'api/health', latencyMs: 5, expected: 'ALLOW (under baseline)' },
    { route: 'api/health', latencyMs: 50, expected: 'ALLOW but high pressure' },
    { route: 'api/users', latencyMs: 80, expected: 'ALLOW (under baseline)' },
    { route: 'ml/inference', latencyMs: 3000, expected: 'ALLOW (under 5s baseline)' },
    { route: 'ml/inference', latencyMs: 10000, expected: 'ALLOW but pressure' },
  ]

  for (const { route, latencyMs, expected } of workloads) {
    const decision = atrion.route(route, { latencyMs })
    console.log(
      `${route} (${latencyMs}ms): ${decision.allow ? '✅' : '❌'} R=${decision.resistance.toFixed(1)}Ω`,
    )
    console.log(`  → ${expected}\n`)
  }

  await atrion.disconnect()
}

main().catch(console.error)
