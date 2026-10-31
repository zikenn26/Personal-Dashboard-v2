/**
 * Retry Utility - Exponential Backoff with Jitter
 * Handles transient network failures automatically
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError) {
    if (error.message.includes('Failed to fetch')) return true;
    if (error.message.includes('NetworkError')) return true;
  }

  // Supabase/Network errors
  if (error?.code === 'NETWORK_ERROR') return true;
  if (error?.code === 'REQUEST_TIMEOUT') return true;
  if (error?.code === 'ECONNREFUSED') return true;
  if (error?.code === 'ETIMEDOUT') return true;
  if (error?.code === 'EHOSTUNREACH') return true;

  // HTTP 5xx errors (server errors, usually transient)
  if (error?.status >= 500 && error?.status < 600) return true;

  // Rate limiting (usually transient)
  if (error?.status === 429) return true;

  // Service unavailable
  if (error?.status === 503) return true;

  // Not retryable: 4xx client errors (except 429)
  if (error?.status >= 400 && error?.status < 500) {
    if (error?.status !== 429) return false;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay with exponential increase and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  
  // Add jitter (random 0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;
  
  // Cap at maxDelayMs
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Retry a function with exponential backoff
 * @param fn - Async function to retry
 * @param tag - Log tag for this operation
 * @param options - Retry options
 * @returns Result of the function
 * @throws Error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  tag: string = 'RETRY',
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      logger.debug(tag, `Attempt ${attempt + 1}/${opts.maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        logger.error(tag, `Non-retryable error on attempt ${attempt + 1}`, error);
        throw error; // Not retryable, throw immediately
      }

      // If this was the last attempt, don't retry
      if (attempt >= opts.maxRetries - 1) {
        logger.error(tag, `All ${opts.maxRetries} attempts failed`, error);
        throw error;
      }

      // Calculate backoff and retry
      const delayMs = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );

      logger.warn(
        tag,
        `Attempt ${attempt + 1} failed, retrying in ${Math.round(delayMs)}ms...`,
        { error: error?.message || error }
      );

      await sleep(delayMs);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Retry a synchronous function (rarely needed, but provided for completeness)
 */
export async function retrySync<T>(
  fn: () => T,
  tag: string = 'RETRY',
  options?: RetryOptions
): Promise<T> {
  return retryWithBackoff(() => Promise.resolve(fn()), tag, options);
}

/**
 * Race between operation and timeout
 * Useful for detecting hung operations
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  tag: string = 'TIMEOUT'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`);
        (error as any).code = 'REQUEST_TIMEOUT';
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Combine retry and timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  tag: string = 'RETRY_TIMEOUT',
  retryOptions?: RetryOptions,
  timeoutMs: number = 10000
): Promise<T> {
  return retryWithBackoff(
    () => withTimeout(fn, timeoutMs, tag),
    tag,
    retryOptions
  );
}
