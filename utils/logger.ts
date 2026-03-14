/**
 * Production-safe logger utility
 * 
 * This utility ensures sensitive information is not logged in production builds.
 * In development (__DEV__ = true), logs are output normally.
 * In production (__DEV__ = false), logs are suppressed.
 */

// Check if we're in development mode
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

/**
 * Safe console.log - only outputs in development
 */
export const log = (...args: any[]): void => {
  if (isDev) {
    console.log(...args);
  }
};

/**
 * Safe console.error - only outputs in development
 */
export const logError = (...args: any[]): void => {
  if (isDev) {
    console.error(...args);
  }
};

/**
 * Safe console.warn - only outputs in development
 */
export const logWarn = (...args: any[]): void => {
  if (isDev) {
    console.warn(...args);
  }
};

/**
 * Safe console.info - only outputs in development
 */
export const logInfo = (...args: any[]): void => {
  if (isDev) {
    console.info(...args);
  }
};

/**
 * Log only in development with a specific tag/category
 */
export const logTagged = (tag: string, ...args: any[]): void => {
  if (isDev) {
    console.log(`[${tag}]`, ...args);
  }
};

/**
 * For critical errors that should be reported even in production
 * (e.g., to a crash reporting service)
 * Currently just logs in dev, but can be extended for production error reporting
 */
export const logCritical = (error: Error | string, context?: Record<string, any>): void => {
  if (isDev) {
    console.error('[CRITICAL]', error, context);
  }
  // In production, you would send this to a crash reporting service like:
  // Sentry.captureException(error, { extra: context });
};

export default {
  log,
  logError,
  logWarn,
  logInfo,
  logTagged,
  logCritical,
};
