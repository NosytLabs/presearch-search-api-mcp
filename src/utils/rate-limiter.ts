import { config } from "../config/configuration.js";
import { logger } from "./logger.js";

interface RateLimiterState {
  requests: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
  retryAfter?: number;
  backoffMultiplier: number;
  lastRetryAfter?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

interface RateLimitHeaders {
  "x-ratelimit-limit"?: string;
  "x-ratelimit-remaining"?: string;
  "x-ratelimit-reset"?: string;
  "retry-after"?: string;
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
      backoffMultiplier: 1,
    };

    logger.debug("Rate limiter initialized", {
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

      logger.warn("Rate limit exceeded", {
        requests: this.state.requests,
        maxRequests: this.state.maxRequests,
        waitTime,
        windowStart: new Date(this.state.windowStart).toISOString(),
      });

      return false;
    }

    // Increment request count
    this.state.requests++;

    logger.debug("Rate limit check passed", {
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
      remainingRequests: Math.max(
        0,
        this.state.maxRequests - this.state.requests,
      ),
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

    logger.debug("Rate limit window reset", {
      previousRequests,
      newWindowStart: new Date(now).toISOString(),
    });
  }

  /**
   * Manually reset rate limiter (for testing)
   */
  public reset(): void {
    this.resetWindow(Date.now());
    logger.info("Rate limiter manually reset");
  }

  /**
   * Update rate limit configuration
   */
  public updateConfig(maxRequests: number, windowSizeMs?: number): void {
    this.state.maxRequests = maxRequests;

    if (windowSizeMs) {
      this.state.windowSize = windowSizeMs;
    }

    logger.info("Rate limiter configuration updated", {
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

  /**
   * Parse and handle HTTP 429 response headers
   */
  public handleRateLimitResponse(headers: RateLimitHeaders): void {
    const retryAfter = headers["retry-after"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];
    const limit = headers["x-ratelimit-limit"];

    if (retryAfter) {
      const retryAfterMs = this.parseRetryAfter(retryAfter);
      this.state.retryAfter = Date.now() + retryAfterMs;
      this.state.lastRetryAfter = retryAfterMs;

      logger.warn("Rate limit hit - Retry-After header received", {
        retryAfterSeconds: retryAfterMs / 1000,
        retryAfterTime: new Date(this.state.retryAfter).toISOString(),
      });
    }

    if (remaining !== undefined) {
      const remainingRequests = parseInt(remaining, 10);
      if (!isNaN(remainingRequests)) {
        this.state.requests = this.state.maxRequests - remainingRequests;
        logger.debug("Updated request count from headers", {
          remaining: remainingRequests,
          currentRequests: this.state.requests,
        });
      }
    }

    if (reset !== undefined) {
      const resetTime = parseInt(reset, 10);
      if (!isNaN(resetTime)) {
        // Reset time could be Unix timestamp or seconds from now
        const resetTimestamp =
          resetTime > 1000000000
            ? resetTime * 1000
            : Date.now() + resetTime * 1000;
        this.state.windowStart = resetTimestamp - this.state.windowSize;
        logger.debug("Updated window from reset header", {
          resetTime: new Date(resetTimestamp).toISOString(),
        });
      }
    }

    if (limit !== undefined) {
      const limitValue = parseInt(limit, 10);
      if (!isNaN(limitValue) && limitValue !== this.state.maxRequests) {
        this.state.maxRequests = limitValue;
        logger.info("Updated rate limit from headers", {
          newLimit: limitValue,
        });
      }
    }
  }

  /**
   * Parse Retry-After header value
   */
  private parseRetryAfter(retryAfter: string): number {
    // Try parsing as seconds first
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    // Default to 60 seconds if parsing fails
    logger.warn("Failed to parse Retry-After header", { retryAfter });
    return 60000;
  }

  /**
   * Check if we should wait due to Retry-After
   */
  public shouldWaitForRetryAfter(): boolean {
    if (!this.state.retryAfter) return false;
    return Date.now() < this.state.retryAfter;
  }

  /**
   * Get time to wait for Retry-After in milliseconds
   */
  public getRetryAfterWaitTime(): number {
    if (!this.state.retryAfter) return 0;
    return Math.max(0, this.state.retryAfter - Date.now());
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  public calculateBackoffDelay(
    attempt: number,
    config: RetryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      jitterFactor: 0.1,
    },
  ): number {
    if (attempt >= config.maxRetries) {
      return -1; // No more retries
    }

    // Exponential backoff: baseDelay * 2^attempt
    let delay = config.baseDelay * Math.pow(2, attempt);

    // Apply maximum delay cap
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = delay * config.jitterFactor * (Math.random() - 0.5);
    delay += jitter;

    // Use Retry-After if it's longer than calculated delay
    const retryAfterDelay = this.getRetryAfterWaitTime();
    if (retryAfterDelay > delay) {
      delay = retryAfterDelay;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Enhanced check that considers Retry-After headers
   */
  public checkLimitWithRetryAfter(): {
    allowed: boolean;
    waitTime?: number;
    reason?: string;
  } {
    // Check Retry-After first
    if (this.shouldWaitForRetryAfter()) {
      const waitTime = this.getRetryAfterWaitTime();
      return {
        allowed: false,
        waitTime,
        reason: "retry-after",
      };
    }

    // Standard rate limit check
    const allowed = this.checkLimit();
    if (!allowed) {
      return {
        allowed: false,
        waitTime: this.getTimeUntilReset(),
        reason: "rate-limit",
      };
    }

    return { allowed: true };
  }

  /**
   * Clear Retry-After state
   */
  public clearRetryAfter(): void {
    this.state.retryAfter = undefined;
    this.state.lastRetryAfter = undefined;
    logger.debug("Retry-After state cleared");
  }

  /**
   * Get comprehensive status including Retry-After info
   */
  public getEnhancedStatus() {
    const basicStatus = this.getStatus();
    return {
      ...basicStatus,
      retryAfter: this.state.retryAfter
        ? {
            waitTime: this.getRetryAfterWaitTime(),
            resetTime: new Date(this.state.retryAfter).toISOString(),
            lastRetryAfterMs: this.state.lastRetryAfter,
          }
        : null,
      backoffMultiplier: this.state.backoffMultiplier,
    };
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();
