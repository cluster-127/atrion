/**
 * Atrion Express Middleware (v1.1)
 *
 * Production-ready Express.js integration using AtrionGuard.
 * Automatically tracks request latency and errors.
 *
 * NOTE: This example uses relative imports for repo compilation.
 * In your project, replace with: import { ... } from 'atrion'
 *
 * @example
 * import { createAtrionMiddleware } from './express-middleware'
 *
 * const app = express()
 * app.use(createAtrionMiddleware())
 *
 * // Or with per-route control:
 * app.use('/api/heavy', createAtrionMiddleware('heavy-api'))
 */

import type { NextFunction, Request, Response } from 'express'
import { consoleObserver, type SLOConfig } from '../src/core/index.js'
import { AtrionGuard } from './wrapper-class.js'

// Singleton guard instance (shared across middleware instances)
let sharedGuard: AtrionGuard | null = null

/**
 * Get or create the shared AtrionGuard instance
 */
function getGuard(options?: { slo?: SLOConfig; debug?: boolean }): AtrionGuard {
  if (!sharedGuard) {
    sharedGuard = new AtrionGuard({
      slo: options?.slo,
      observer: options?.debug ? consoleObserver : undefined,
    })
  }
  return sharedGuard
}

/**
 * Create Atrion middleware for Express.
 *
 * @param routeId - Optional route identifier (defaults to req.method:req.path)
 * @param options - Configuration options
 *
 * @example
 * // Basic usage (auto route detection)
 * app.use(createAtrionMiddleware())
 *
 * // Named route (for grouping)
 * app.use('/api', createAtrionMiddleware('main-api'))
 *
 * // With debugging
 * app.use(createAtrionMiddleware(undefined, { debug: true }))
 */
export function createAtrionMiddleware(
  routeId?: string,
  options?: {
    slo?: SLOConfig
    debug?: boolean
  }
) {
  const guard = getGuard(options)

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine route identifier
    const id = routeId ?? `${req.method}:${req.path}`

    // 1. PRE-CHECK: Can we accept this request?
    if (!guard.canAccept(id)) {
      res.status(503).json({
        error: 'Service temporarily unavailable',
        reason: 'Atrion traffic shedding active',
        retryAfter: 5,
      })
      return
    }

    // 2. MEASURE: Start timing with high-resolution timer
    const start = process.hrtime.bigint()

    // 3. HOOK: Capture response completion
    res.on('finish', () => {
      const end = process.hrtime.bigint()
      // Convert nanoseconds to milliseconds
      const latencyMs = Number(end - start) / 1_000_000

      // 5xx = system error, contributes to error pressure
      const isError = res.statusCode >= 500

      // 4. REPORT: Update physics with raw telemetry
      // Normalization is handled internally by AtrionGuard
      guard.reportOutcome(id, {
        latencyMs,
        isError,
        saturation: 0, // Could be enhanced with concurrent request tracking
      })
    })

    next()
  }
}

/**
 * Reset the shared guard (useful for testing)
 */
export function resetAtrionMiddleware(): void {
  sharedGuard = null
}

/**
 * Get the current guard instance (for debugging/monitoring)
 */
export function getAtrionGuard(): AtrionGuard | null {
  return sharedGuard
}
