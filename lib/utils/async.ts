/**
 * Async Utility Functions
 * 
 * Provides robust timeout and delay utilities to avoid Promise.race pitfalls
 * and ensure deterministic async behavior in voice/WebRTC workflows.
 */

export interface WithTimeoutOptions<T> {
  /** Fallback value to return on timeout (if not provided, rejects) */
  fallback?: T;
  /** Optional signal to abort the operation */
  signal?: AbortSignal;
  /** Optional callback on timeout */
  onTimeout?: () => void;
}

/**
 * Wraps a promise with a timeout that resolves (not rejects) with a fallback value.
 * This prevents hangs and allows graceful degradation.
 * 
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param options Configuration options
 * @returns Promise that resolves with the original result or fallback
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  options: WithTimeoutOptions<T> = {}
): Promise<T> {
  const { fallback, signal, onTimeout } = options;

  return new Promise<T>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    // Handle abort signal
    const abortHandler = () => {
      if (!settled) {
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (fallback !== undefined) {
          resolve(fallback);
        } else {
          reject(new Error('Operation aborted'));
        }
      }
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener('abort', abortHandler);
    }

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        onTimeout?.();
        
        if (fallback !== undefined) {
          resolve(fallback);
        } else {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }
        
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
      }
    }, timeoutMs);

    // Await the original promise
    promise
      .then((result) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(result);
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          
          // If we have a fallback, use it even on error
          if (fallback !== undefined) {
            resolve(fallback);
          } else {
            reject(error);
          }
        }
      });
  });
}

/**
 * Simple sleep/delay utility for predictable timing
 * 
 * @param ms Milliseconds to wait
 * @param signal Optional abort signal
 * @returns Promise that resolves after the delay
 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Wait aborted'));
      return;
    }

    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    const abortHandler = () => {
      clearTimeout(timeoutId);
      reject(new Error('Wait aborted'));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }
  });
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Promise with the result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    signal,
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Retry aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't wait after the last attempt
      if (attempt < maxAttempts) {
        await wait(delayMs, signal);
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Create an idempotent async operation that prevents concurrent execution
 * 
 * @param fn The async function to make idempotent
 * @returns Wrapped function that prevents concurrent calls
 */
export function makeIdempotent<T>(
  fn: () => Promise<T>
): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = fn().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}

/**
 * Debounce an async function
 * 
 * @param fn Function to debounce
 * @param delayMs Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<any> | null = null;

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pendingPromise = null;
            timeoutId = null;
          }
        }, delayMs);
      });
    }

    return pendingPromise;
  }) as T;
}
