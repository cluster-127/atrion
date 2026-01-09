/**
 * Atrion Logger Interface
 * Injectable logging abstraction for production flexibility.
 */

/**
 * Log levels for filtering
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger interface for dependency injection.
 * Core physics modules depend on this abstraction, not console.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

/**
 * Silent logger - no output (for tests or high-performance scenarios)
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Console logger - standard output (default for development)
 */
export const consoleLogger: Logger = {
  debug: (msg, ctx) => console.debug(`[DEBUG] ${msg}`, ctx ?? ''),
  info: (msg, ctx) => console.info(`[INFO] ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx ?? ''),
}

/**
 * Configurable logger with level filtering.
 */
export function createLogger(minLevel: LogLevel = 'warn', output: Logger = consoleLogger): Logger {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  const shouldLog = (level: LogLevel) => levels[level] >= levels[minLevel]

  return {
    debug: (msg, ctx) => shouldLog('debug') && output.debug(msg, ctx),
    info: (msg, ctx) => shouldLog('info') && output.info(msg, ctx),
    warn: (msg, ctx) => shouldLog('warn') && output.warn(msg, ctx),
    error: (msg, ctx) => shouldLog('error') && output.error(msg, ctx),
  }
}

// ============================================================================
// GLOBAL LOGGER INSTANCE
// ============================================================================

/**
 * Global logger instance.
 * Default: silentLogger (no output)
 * Call setLogger() to configure.
 */
let globalLogger: Logger = silentLogger

/**
 * Get the current global logger.
 */
export function getLogger(): Logger {
  return globalLogger
}

/**
 * Set the global logger instance.
 * Call this at application startup.
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger
}

/**
 * Reset to silent logger (useful for tests).
 */
export function resetLogger(): void {
  globalLogger = silentLogger
}
