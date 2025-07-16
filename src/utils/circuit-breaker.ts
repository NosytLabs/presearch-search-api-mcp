import { EventEmitter } from "events";

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failing fast
  HALF_OPEN = "HALF_OPEN", // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window for failure counting (ms)
  successThreshold: number; // Successes needed to close from half-open
  volumeThreshold: number; // Minimum requests before considering failure rate
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

/**
 * Circuit breaker implementation for API resilience
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      volumeThreshold: 10,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.emit("stateChange", this.state);
      } else {
        throw new Error(
          "Circuit breaker is OPEN - service temporarily unavailable",
        );
      }
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.emit("success");

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.emit("failure", error);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.trip();
    } else if (this.state === CircuitBreakerState.CLOSED) {
      if (this.shouldTrip()) {
        this.trip();
      }
    }
  }

  /**
   * Check if circuit breaker should trip to OPEN state
   */
  private shouldTrip(): boolean {
    if (this.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    const failureRate = this.failureCount / this.totalRequests;
    const threshold =
      this.config.failureThreshold / this.config.volumeThreshold;

    return failureRate >= threshold;
  }

  /**
   * Trip the circuit breaker to OPEN state
   */
  private trip(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    this.emit("stateChange", this.state);
    this.emit("open");
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
    this.emit("stateChange", this.state);
    this.emit("close");
  }

  /**
   * Check if we should attempt to reset from OPEN state
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  forceReset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
    this.totalRequests = 0;
    this.emit("stateChange", this.state);
    this.emit("close");
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Get failure rate percentage
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return (this.failureCount / this.totalRequests) * 100;
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.onFailure(new Error("Operation failed"));
  }

  /**
   * Get current state as string
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}
