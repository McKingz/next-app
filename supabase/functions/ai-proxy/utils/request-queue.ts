/**
 * AI Request Queue
 * 
 * Prevents rate limiting by queuing AI requests and processing them
 * with a minimum delay between each request.
 * 
 * This solves the 429 "Too Many Requests" error from Anthropic API.
 */

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class AIRequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private consecutiveRateLimits = 0;
  private circuitBreakerOpenUntil = 0;
  
  // Configuration
  private readonly minDelay = 5000; // 5 seconds between requests (increased from 3s for better rate limit handling)
  private readonly maxConcurrent = 1; // Process one at a time
  private readonly requestTimeout = 120000; // 120 second timeout per request (increased from 90s)
  private readonly maxConsecutiveRateLimits = 3; // Open circuit breaker after 3 consecutive rate limits
  private readonly circuitBreakerDuration = 60000; // Keep circuit open for 60 seconds

  /**
   * Enqueue an AI request to be processed sequentially
   */
  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check circuit breaker
      if (this.circuitBreakerOpenUntil > Date.now()) {
        const waitTime = Math.ceil((this.circuitBreakerOpenUntil - Date.now()) / 1000);
        console.warn(`[AI Queue] Circuit breaker is open. Rate limits detected. Wait ${waitTime}s before trying again.`);
        reject(new Error(`Rate limit protection active. Too many rate limits detected. Please wait ${waitTime} seconds before trying again.`));
        return;
      }
      
      this.queue.push({
        execute: request,
        resolve,
        reject,
        timestamp: Date.now(),
      });
      
      console.log(`[AI Queue] Request enqueued. Queue size: ${this.queue.length}`);
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.processing) {
      console.log('[AI Queue] Already processing queue');
      return;
    }
    
    this.processing = true;
    console.log('[AI Queue] Started processing queue');
    
    while (this.queue.length > 0) {
      const queuedRequest = this.queue.shift()!;
      
      // Calculate time since last request
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const delayNeeded = Math.max(0, this.minDelay - timeSinceLastRequest);
      
      if (delayNeeded > 0) {
        console.log(`[AI Queue] Waiting ${delayNeeded}ms before next request`);
        await this.sleep(delayNeeded);
      }
      
      // Check if request has timed out while waiting in queue
      const queueWaitTime = Date.now() - queuedRequest.timestamp;
      if (queueWaitTime > this.requestTimeout) {
        console.warn(`[AI Queue] Request timeout after ${queueWaitTime}ms in queue`);
        queuedRequest.reject(new Error('Request timeout in queue'));
        continue;
      }
      
      // Execute the request
      try {
        console.log(`[AI Queue] Executing request. Remaining in queue: ${this.queue.length}`);
        this.lastRequestTime = Date.now();
        
        const result = await Promise.race([
          queuedRequest.execute(),
          this.timeoutPromise(this.requestTimeout),
        ]);
        
        // Success - reset rate limit counter
        this.consecutiveRateLimits = 0;
        
        queuedRequest.resolve(result);
        console.log('[AI Queue] Request completed successfully');
      } catch (error: any) {
        console.error('[AI Queue] Request failed:', error?.message || error);
        
        // Check if this is a rate limit error
        if (isRateLimitError(error)) {
          this.consecutiveRateLimits++;
          console.warn(`[AI Queue] Rate limit error detected. Consecutive count: ${this.consecutiveRateLimits}`);
          
          // Open circuit breaker if too many consecutive rate limits
          if (this.consecutiveRateLimits >= this.maxConsecutiveRateLimits) {
            this.circuitBreakerOpenUntil = Date.now() + this.circuitBreakerDuration;
            console.error(`[AI Queue] Circuit breaker opened! Too many rate limits. Will retry after ${this.circuitBreakerDuration / 1000}s`);
            
            // Clear remaining queue
            const remaining = this.queue.length;
            this.queue.forEach(req => {
              req.reject(new Error('Circuit breaker opened due to sustained rate limiting. Please try again in a minute.'));
            });
            this.queue = [];
            console.log(`[AI Queue] Cleared ${remaining} pending requests due to circuit breaker`);
          }
        } else {
          // Non-rate-limit error - reset counter
          this.consecutiveRateLimits = 0;
        }
        
        queuedRequest.reject(error);
      }
    }
    
    this.processing = false;
    console.log('[AI Queue] Finished processing queue');
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      lastRequestTime: this.lastRequestTime,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
      consecutiveRateLimits: this.consecutiveRateLimits,
      circuitBreakerOpen: this.circuitBreakerOpenUntil > Date.now(),
      circuitBreakerTimeRemaining: Math.max(0, this.circuitBreakerOpenUntil - Date.now()),
    };
  }

  /**
   * Clear all pending requests (useful for cleanup)
   */
  clear() {
    const clearedCount = this.queue.length;
    this.queue.forEach(req => {
      req.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    console.log(`[AI Queue] Cleared ${clearedCount} pending requests`);
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Create a timeout promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  }
}

// Export singleton instance
export const aiRequestQueue = new AIRequestQueue();

/**
 * Utility: Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.message?.toLowerCase().includes('too many requests')
  );
}

/**
 * Utility: Get retry delay from rate limit error
 */
export function getRetryAfter(error: any): number {
  // Check for Retry-After header
  const retryAfter = error?.headers?.['retry-after'] || 
                     error?.context?.headers?.['retry-after'];
  
  if (retryAfter) {
    const seconds = parseInt(retryAfter);
    return isNaN(seconds) ? 60000 : seconds * 1000;
  }
  
  // Default to 60 seconds
  return 60000;
}
