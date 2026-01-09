/**
 * Phase 4: Stability Mapper
 *
 * Stress tests the CDO Physics Engine across a parameter grid to identify
 * the Safe Operating Area (SOA) where the system remains stable.
 *
 * Methodology:
 * 1. Grid Search: Vary decayRate and scarFactor
 * 2. Simulation: Run 1000 ticks with oscillating input
 * 3. Score: Measure "stability" via resistance variance
 * 4. Output: ASCII Heatmap showing stable vs chaotic regions
 *
 * Lyapunov-inspired stability metric:
 * - Low variance = Stable (negative Lyapunov exponent)
 * - High variance = Chaotic (positive Lyapunov exponent)
 */

import type {
  DeltaTime,
  NormalizedPressure,
  Ohms,
  PhysicsConfig,
  SLOConfig,
} from '../core/types.js'
import { runSimulation } from '../simulation/runner.js'
import { Scenarios } from '../simulation/scenarios.js'

// =============================================================================
// CONFIGURATION
// =============================================================================

const GRID_CONFIG = {
  decayRate: { min: 0.1, max: 5.0, steps: 10 },
  scarFactor: { min: 1, max: 20, steps: 10 },
}

const SIMULATION_TICKS = 500

const BASE_CONFIG: Omit<PhysicsConfig, 'decayRate' | 'scarFactor'> = {
  baseResistance: 10 as Ohms,
  dampingFactor: 10,
  criticalPressure: 0.5 as NormalizedPressure,
  breakMultiplier: 100,
  bootstrapTicks: 5,
  minDeltaT: 100 as DeltaTime,
  tanhScale: 1.0,
}

const SLO: SLOConfig = {
  baselineLatencyMs: 50,
  maxAcceptableLatencyMs: 200,
  targetErrorRate: 0.01,
  criticality: { latency: 5, error: 10, saturation: 5 },
}

// =============================================================================
// STABILITY METRICS
// =============================================================================

interface StabilityResult {
  decayRate: number
  scarFactor: number
  variance: number
  maxResistance: number
  finalResistance: number
  stabilityScore: number // 0 = chaotic, 1 = perfectly stable
}

function calculateVariance(values: number[]): number {
  const n = values.length
  if (n === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / n
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  return squaredDiffs.reduce((a, b) => a + b, 0) / n
}

function runStabilityTest(decayRate: number, scarFactor: number): StabilityResult {
  const config: PhysicsConfig = {
    ...BASE_CONFIG,
    decayRate,
    scarFactor,
  }

  // Oscillating stress test - worst case scenario
  const scenario = Scenarios.compose(
    Scenarios.silence(),
    Scenarios.oscillating(0.3, 0.05, 50), // Oscillating around threshold
    Scenarios.silence()
  )

  const observer = runSimulation({
    durationTicks: SIMULATION_TICKS,
    config,
    slo: SLO,
    scenario,
  })

  const resistanceSeries = observer.getSeries('resistance')
  const variance = calculateVariance(resistanceSeries)
  const maxResistance = Math.max(...resistanceSeries)
  const finalResistance = resistanceSeries[resistanceSeries.length - 1]

  // Stability score: normalized inverse of variance
  // Lower variance = higher stability
  const maxExpectedVariance = 10000 // Normalize against expected max
  const stabilityScore = Math.max(0, Math.min(1, 1 - variance / maxExpectedVariance))

  return {
    decayRate,
    scarFactor,
    variance,
    maxResistance,
    finalResistance,
    stabilityScore,
  }
}

// =============================================================================
// GRID SEARCH
// =============================================================================

function generateGrid(): Array<{ decayRate: number; scarFactor: number }> {
  const grid: Array<{ decayRate: number; scarFactor: number }> = []

  const { decayRate: dr, scarFactor: sf } = GRID_CONFIG
  const drStep = (dr.max - dr.min) / (dr.steps - 1)
  const sfStep = (sf.max - sf.min) / (sf.steps - 1)

  for (let i = 0; i < dr.steps; i++) {
    for (let j = 0; j < sf.steps; j++) {
      grid.push({
        decayRate: dr.min + i * drStep,
        scarFactor: sf.min + j * sfStep,
      })
    }
  }

  return grid
}

// =============================================================================
// VISUALIZATION
// =============================================================================

const HEATMAP_CHARS = ' ░▒▓█'
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function scoreToChar(score: number): string {
  const idx = Math.min(HEATMAP_CHARS.length - 1, Math.floor(score * HEATMAP_CHARS.length))
  return HEATMAP_CHARS[idx]
}

function scoreToColor(score: number): string {
  if (score >= 0.8) return COLORS.green
  if (score >= 0.5) return COLORS.yellow
  return COLORS.red
}

function renderHeatmap(results: StabilityResult[][]): void {
  const { decayRate: dr, scarFactor: sf } = GRID_CONFIG

  console.log(
    '\n' + COLORS.cyan + '╔══════════════════════════════════════════════════════════════╗'
  )
  console.log('║          ATRION STABILITY MAP (Safe Operating Area)          ║')
  console.log('╚══════════════════════════════════════════════════════════════╝' + COLORS.reset)

  console.log(
    '\n' +
      COLORS.dim +
      '  Stability: ' +
      COLORS.green +
      '█ High  ' +
      COLORS.yellow +
      '▓ Medium  ' +
      COLORS.red +
      '░ Low' +
      COLORS.reset
  )

  // Y-axis label
  console.log('\n  scarFactor ↑')

  // Render grid (top to bottom = high to low scarFactor)
  for (let j = sf.steps - 1; j >= 0; j--) {
    const sfValue = sf.min + j * ((sf.max - sf.min) / (sf.steps - 1))
    let row = `  ${sfValue.toFixed(1).padStart(5)} │ `

    for (let i = 0; i < dr.steps; i++) {
      const result = results[i][j]
      const char = scoreToChar(result.stabilityScore)
      const color = scoreToColor(result.stabilityScore)
      row += color + char + char + COLORS.reset
    }

    console.log(row)
  }

  // X-axis
  console.log('        └' + '──'.repeat(dr.steps))
  let xLabels = '         '
  for (let i = 0; i < dr.steps; i += 2) {
    const drValue = dr.min + i * ((dr.max - dr.min) / (dr.steps - 1))
    xLabels += drValue.toFixed(1).padEnd(4)
  }
  console.log(xLabels)
  console.log('                              decayRate →\n')

  // Summary statistics
  const allResults = results.flat()
  const avgStability = allResults.reduce((a, r) => a + r.stabilityScore, 0) / allResults.length
  const stableCount = allResults.filter((r) => r.stabilityScore >= 0.8).length
  const chaoticCount = allResults.filter((r) => r.stabilityScore < 0.3).length

  console.log(COLORS.cyan + '┌─────────────────────────────────────────┐')
  console.log('│             STABILITY SUMMARY           │')
  console.log('├─────────────────────────────────────────┤' + COLORS.reset)
  console.log(
    `│ Average Stability Score: ${COLORS.cyan}${(avgStability * 100).toFixed(1)}%${
      COLORS.reset
    }`.padEnd(52) + '│'
  )
  console.log(
    `│ Stable Regions (>80%):   ${COLORS.green}${stableCount}/${allResults.length}${COLORS.reset}`.padEnd(
      52
    ) + '│'
  )
  console.log(
    `│ Chaotic Regions (<30%):  ${COLORS.red}${chaoticCount}/${allResults.length}${COLORS.reset}`.padEnd(
      52
    ) + '│'
  )
  console.log(COLORS.cyan + '└─────────────────────────────────────────┘' + COLORS.reset)
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('\n🔬 Atrion Stability Mapper v1.0')
  console.log('━'.repeat(50))
  console.log(
    `Grid: ${GRID_CONFIG.decayRate.steps}x${GRID_CONFIG.scarFactor.steps} (${
      GRID_CONFIG.decayRate.steps * GRID_CONFIG.scarFactor.steps
    } simulations)`
  )
  console.log(`Simulation: ${SIMULATION_TICKS} ticks per cell`)
  console.log('━'.repeat(50))

  const grid = generateGrid()
  const totalCells = grid.length
  let completed = 0

  // Initialize 2D results array
  const results: StabilityResult[][] = []
  for (let i = 0; i < GRID_CONFIG.decayRate.steps; i++) {
    results[i] = []
  }

  // Run simulations
  const startTime = Date.now()

  for (const { decayRate, scarFactor } of grid) {
    const result = runStabilityTest(decayRate, scarFactor)

    // Map to 2D array indices
    const drIdx = Math.round(
      ((decayRate - GRID_CONFIG.decayRate.min) /
        (GRID_CONFIG.decayRate.max - GRID_CONFIG.decayRate.min)) *
        (GRID_CONFIG.decayRate.steps - 1)
    )
    const sfIdx = Math.round(
      ((scarFactor - GRID_CONFIG.scarFactor.min) /
        (GRID_CONFIG.scarFactor.max - GRID_CONFIG.scarFactor.min)) *
        (GRID_CONFIG.scarFactor.steps - 1)
    )

    results[drIdx][sfIdx] = result
    completed++

    // Progress indicator
    const progress = ((completed / totalCells) * 100).toFixed(0)
    process.stdout.write(`\r⏳ Progress: ${progress}% (${completed}/${totalCells})`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\n✅ Completed in ${elapsed}s\n`)

  // Render heatmap
  renderHeatmap(results)

  // Find optimal region
  const allResults = results.flat()
  const optimal = allResults.reduce((best, curr) =>
    curr.stabilityScore > best.stabilityScore ? curr : best
  )

  console.log(`\n💡 ${COLORS.green}Optimal Configuration:${COLORS.reset}`)
  console.log(`   decayRate: ${optimal.decayRate.toFixed(2)}`)
  console.log(`   scarFactor: ${optimal.scarFactor.toFixed(1)}`)
  console.log(`   Stability: ${(optimal.stabilityScore * 100).toFixed(1)}%\n`)
}

main().catch(console.error)
