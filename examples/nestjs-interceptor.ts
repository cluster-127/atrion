/**
 * Atrion NestJS Interceptor (v1.1)
 *
 * Production-ready NestJS integration using Interceptor pattern.
 * Interceptor is preferred over Guard because it can measure latency
 * and capture the full request lifecycle (pre + post processing).
 *
 * NOTE: This example uses relative imports for repo compilation.
 * In your project, replace with: import { ... } from 'atrion'
 *
 * @example
 * // Global interceptor
 * app.useGlobalInterceptors(new AtrionInterceptor())
 *
 * // Controller-level
 * @UseInterceptors(AtrionInterceptor)
 * export class UsersController {}
 *
 * // With dependency injection (recommended)
 * // See PROVIDERS section at bottom of file
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Observable } from 'rxjs'
import { throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { consoleObserver, type SLOConfig } from '../src/core/index.js'
import { AtrionGuard } from './wrapper-class.js'

/**
 * Atrion Interceptor for NestJS.
 *
 * Provides automatic request admission control with physics-based
 * traffic shedding. Measures latency and tracks errors.
 *
 * @example
 * // In your app module or main.ts:
 * app.useGlobalInterceptors(new AtrionInterceptor({ debug: true }))
 */
@Injectable()
export class AtrionInterceptor implements NestInterceptor {
  private readonly guard: AtrionGuard

  constructor(options?: { slo?: SLOConfig; debug?: boolean }) {
    this.guard = new AtrionGuard({
      slo: options?.slo,
      observer: options?.debug ? consoleObserver : undefined,
    })
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp()
    const request = ctx.getRequest()

    // Build route identifier from request
    const routeId = this.buildRouteId(context, request)

    // 1. PRE-CHECK: Can we accept this request?
    if (!this.guard.canAccept(routeId)) {
      return throwError(
        () =>
          new ServiceUnavailableException({
            statusCode: 503,
            message: 'Service temporarily unavailable',
            reason: 'Atrion traffic shedding active',
            retryAfter: 5,
          })
      )
    }

    // 2. MEASURE: Start timing
    const start = Date.now()

    return next.handle().pipe(
      // 3. SUCCESS PATH: Report outcome with raw telemetry
      tap(() => {
        const latencyMs = Date.now() - start
        this.guard.reportOutcome(routeId, {
          latencyMs,
          isError: false,
        })
      }),

      // 4. ERROR PATH: Report outcome with error flag
      catchError((error: unknown) => {
        const latencyMs = Date.now() - start

        // Classify error: 5xx = system error, 4xx = client error (not Atrion's concern)
        const isSystemError = this.isSystemError(error)

        this.guard.reportOutcome(routeId, {
          latencyMs,
          isError: isSystemError,
        })

        // Re-throw the original error
        return throwError(() => error)
      })
    )
  }

  /**
   * Build a unique route identifier from execution context.
   * Can be overridden for custom routing logic.
   */
  protected buildRouteId(
    context: ExecutionContext,
    request: { method?: string; path?: string; url?: string }
  ): string {
    // Use controller + handler name for fine-grained tracking
    const controller = context.getClass().name
    const handler = context.getHandler().name

    // Use HTTP method + path for route identification
    const method = request.method ?? 'UNKNOWN'
    const path = request.path ?? request.url ?? '/'

    // Combine for uniqueness
    return `${method}:${path}:${controller}.${handler}`
  }

  /**
   * Determine if an error is a system error (5xx) or client error (4xx).
   * Only system errors contribute to Atrion's error pressure.
   */
  protected isSystemError(error: unknown): boolean {
    // Type guard for HttpException-like objects
    if (error !== null && typeof error === 'object') {
      // NestJS HttpException has getStatus() method
      if (
        'getStatus' in error &&
        typeof (error as { getStatus: () => number }).getStatus === 'function'
      ) {
        const status = (error as { getStatus: () => number }).getStatus()
        return status >= 500
      }

      // Check for status property directly
      if ('status' in error && typeof (error as { status: number }).status === 'number') {
        return (error as { status: number }).status >= 500
      }
    }

    // Unknown errors are treated as system errors (conservative)
    return true
  }

  /**
   * Get the underlying guard (for debugging/monitoring)
   */
  getGuard(): AtrionGuard {
    return this.guard
  }
}

// =============================================================================
// DEPENDENCY INJECTION SETUP (Recommended for Production)
// =============================================================================

/**
 * For proper dependency injection, create a module:
 *
 * @example
 * // atrion.module.ts
 * import { Module } from '@nestjs/common'
 * import { AtrionInterceptor } from './nestjs-interceptor'
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: AtrionInterceptor,
 *       useFactory: () => new AtrionInterceptor({ debug: true }),
 *     },
 *   ],
 *   exports: [AtrionInterceptor],
 * })
 * export class AtrionModule {}
 *
 * // app.module.ts
 * import { Module } from '@nestjs/common'
 * import { APP_INTERCEPTOR } from '@nestjs/core'
 * import { AtrionModule } from './atrion.module'
 * import { AtrionInterceptor } from './nestjs-interceptor'
 *
 * @Module({
 *   imports: [AtrionModule],
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useExisting: AtrionInterceptor,
 *     },
 *   ],
 * })
 * export class AppModule {}
 */
