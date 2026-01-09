/**
 * Atrion Flow Decision Logic
 * Implements the V > R flow gate.
 * See RFC-0001 §5
 */

import type { FlowDecision, Request, RouteState, Volts } from './types.js'

/**
 * Make a flow decision for a request against a route.
 *
 * Flow = PASS if V > R AND mode ≠ CIRCUIT_BREAKER
 * Flow = REJECT otherwise
 *
 * @param request - Incoming request with voltage
 * @param route - Current route state
 * @returns Flow decision
 */
export function decideFlow(request: Request, route: RouteState): FlowDecision {
  // Circuit breaker always rejects
  if (route.mode === 'CIRCUIT_BREAKER') {
    return {
      type: 'REJECT',
      reason: 'CIRCUIT_OPEN',
    }
  }

  // Voltage must overcome resistance
  if (request.voltage > route.resistance) {
    return {
      type: 'PASS',
      routeId: route.routeId,
    }
  }

  return {
    type: 'REJECT',
    reason: 'INSUFFICIENT_VOLTAGE',
  }
}

/**
 * Select best route from multiple options using softmax.
 * Pr(route_j) = exp(-β * R_j) / Σ exp(-β * R_k)
 *
 * @param routes - Available routes
 * @param beta - Selection temperature (higher = more deterministic)
 * @returns Selected route or null if none available
 */
export function selectRoute(routes: readonly RouteState[], beta: number = 1.0): RouteState | null {
  // Filter out circuit breaker routes
  const available = routes.filter((r) => r.mode !== 'CIRCUIT_BREAKER')

  if (available.length === 0) {
    return null
  }

  if (available.length === 1) {
    return available[0]
  }

  // Softmax weights
  const weights = available.map((r) => Math.exp(-beta * r.resistance))
  const total = weights.reduce((a, b) => a + b, 0)
  const probabilities = weights.map((w) => w / total)

  // Weighted random selection
  const random = Math.random()
  let cumulative = 0

  for (let i = 0; i < available.length; i++) {
    cumulative += probabilities[i]
    if (random <= cumulative) {
      return available[i]
    }
  }

  return available[available.length - 1]
}

/**
 * Create a request with priority voltage.
 */
export function createRequest(requestId: string, voltage: number, timestamp: number): Request {
  return {
    requestId,
    voltage: voltage as Volts,
    timestamp: timestamp as any, // Timestamp branded
  }
}
