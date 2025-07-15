import { config } from '../config/configuration.js';
import { logger } from './logger.js';


interface RateLimiterState {
  requests: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
}

/**
 * Rate limiter implementation with sliding window
 */
export class RateLimiter {
  private static instance: RateLimiter;
  private state: RateLimiterState;

  constructor(maxRequests?: number, windowSizeMs?: number) {
    this.state = {
      requests: 0,
      windowStart: Date.now(),
      windowSize: windowSizeMs || config.getRateLimitWindow(),
      maxRequests: maxRequests || config.getRateLimitRequests(),
    };

    logger.debug('Rate limiter initialized', {
      maxRequests: this.state.maxRequests,
      windowSize: this.state.windowSize,
    });
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if request is allowed under rate limit
   * Returns true if allowed, false if rate limit exceeded
   */
  public checkLimit(): boolean {
    const now = Date.now();

    // Reset window if expired
    if (now - this.state.windowStart >= this.state.windowSize) {
      this.resetWindow(now);
    }

    // Check if limit is exceeded
    if (this.state.requests >= this.state.maxRequests) {
      const resetTime = this.state.windowStart + this.state.windowSize;
      const waitTime = Math.ceil((resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        requests: this.state.requests,
        maxRequests: this.state.maxRequests,
        waitTime,
        windowStart: new Date(this.state.windowStart).toISOString(),
      });

      return false;
    }

    // Increment request count
    this.state.requests++;

    logger.debug('Rate limit check passed', {
      requests: this.state.requests,
      maxRequests: this.state.maxRequests,
      remainingRequests: this.state.maxRequests - this.state.requests,
    });

    return true;
  }

  /**
   * Get current rate limit status
   */
  public getStatus(): {
    requests: number;
    maxRequests: number;
    remainingRequests: number;
    windowStart: string;
    windowEnd: string;
    resetIn: number;
  } {
    const now = Date.now();
    const windowEnd = this.state.windowStart + this.state.windowSize;
    const resetIn = Math.max(0, Math.ceil((windowEnd - now) / 1000));

    return {
      requests: this.state.requests,
      maxRequests: this.state.maxRequests,
      remainingRequests: Math.max(0, this.state.maxRequests - this.state.requests),
      windowStart: new Date(this.state.windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      resetIn,
    };
  }

  /**
   * Reset the rate limiting window
   */
  private resetWindow(now: number): void {
    const previousRequests = this.state.requests;

    this.state.requests = 0;
    this.state.windowStart = now;

    logger.debug('Rate limit window reset', {
      previousRequests,
      newWindowStart: new Date(now).toISOString(),
    });
  }

  /**
   * Manually reset rate limiter (for testing)
   */
  public reset(): void {
    this.resetWindow(Date.now());
    logger.info('Rate limiter manually reset');
  }

  /**
   * Update rate limit configuration
   */
  public updateConfig(maxRequests: number, windowSizeMs?: number): void {
    this.state.maxRequests = maxRequests;

    if (windowSizeMs) {
      this.state.windowSize = windowSizeMs;
    }

    logger.info('Rate limiter configuration updated', {
      maxRequests: this.state.maxRequests,
      windowSize: this.state.windowSize,
    });
  }

  /**
   * Check if we're close to rate limit (within 10% of max)
   */
  public isNearLimit(): boolean {
    const threshold = Math.floor(this.state.maxRequests * 0.9);
    return this.state.requests >= threshold;
  }

  /**
   * Get time until rate limit resets
   */
  public getTimeUntilReset(): number {
    const now = Date.now();
    const windowEnd = this.state.windowStart + this.state.windowSize;
    return Math.max(0, windowEnd - now);
  }

  /**
   * Get remaining requests in current window
   */
  public getRemainingRequests(): number {
    return Math.max(0, this.state.maxRequests - this.state.requests);
  }

  /**
   * Get reset time as timestamp
   */
  public getResetTime(): number {
    return this.state.windowStart + this.state.windowSize;
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();
