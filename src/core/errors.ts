/**
 * Atrion Custom Error Types
 * Centralized error hierarchy for better error handling and debugging.
 */

/**
 * Base error class for all Atrion errors.
 */
export class AtrionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AtrionError'
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Thrown when a provider is not connected.
 */
export class ConnectionError extends AtrionError {
  constructor(providerName: string = 'Provider') {
    super(`${providerName} is not connected. Call connect() first.`)
    this.name = 'ConnectionError'
  }
}

/**
 * Thrown when a required dependency is missing.
 */
export class DependencyError extends AtrionError {
  readonly dependency: string
  readonly installCommand: string

  constructor(dependency: string, installCommand: string = `npm install ${dependency}`) {
    super(`Missing dependency: ${dependency}. Install with: ${installCommand}`)
    this.name = 'DependencyError'
    this.dependency = dependency
    this.installCommand = installCommand
  }
}

/**
 * Thrown when state synchronization fails.
 */
export class SyncError extends AtrionError {
  readonly routeId: string
  readonly cause?: Error

  constructor(routeId: string, cause?: Error) {
    super(`State sync failed for route "${routeId}"${cause ? `: ${cause.message}` : ''}`)
    this.name = 'SyncError'
    this.routeId = routeId
    this.cause = cause
  }
}

/**
 * Thrown when data parsing fails (e.g., malformed JSON from Redis).
 */
export class ParseError extends AtrionError {
  readonly routeId: string

  constructor(routeId: string) {
    super(`Failed to parse state data for route "${routeId}"`)
    this.name = 'ParseError'
    this.routeId = routeId
  }
}
