import { AxiosError } from 'axios';
import { ZodError } from 'zod';
import { config } from '../config/configuration.js';
import { logger } from './logger.js';
import { RetryConfig } from '../types/presearch-types.js';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker.js';

// Error Categories
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMITING = 'RATE_LIMITING',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface CategorizedError {
  originalError: Error;
  category: ErrorCategory;
  isRetryable: boolean;
  userMessage: string;
  technicalMessage: string;
  statusCode?: number;
}

// Custom Error Classes
export class McpError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ApiError extends McpError {
  constructor(message: string, status: number, details?: unknown) {
    super(message, 'API_ERROR', status, details);
    this.name = 'ApiError';
  }
}

export class ValidationError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class ConfigError extends McpError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 500);
    this.name = 'ConfigError';
  }
}

export class ToolExecutionError extends McpError {
  constructor(message: string, toolName: string, details?: unknown) {
    super(`Error executing tool '${toolName}': ${message}`, 'TOOL_EXECUTION_ERROR', 500, details);
    this.name = 'ToolExecutionError';
  }
}

export class RateLimitExceededError extends ApiError {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 429);
    this.name = 'RateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}

export class PresearchAPIError extends ApiError {
  constructor(message: string, status: number, details?: unknown) {
    super(message, status, details);
    this.name = 'PresearchAPIError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', 0, details);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', 408, details);
    this.name = 'TimeoutError';
  }
}

// Aliases for compatibility
export const PresearchError = McpError;
export const APIError = ApiError;

// Error Categorization Functions
const categorizeAxiosError = (error: AxiosError): CategorizedError => {
  const status = error.response?.status;
  const statusCode = status ?? undefined;

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      originalError: error,
      category: ErrorCategory.NETWORK,
      isRetryable: true,
      userMessage: 'Request timed out. Please try again.',
      technicalMessage: `Timeout error: ${error.message}`,
      statusCode,
    };
  }

  if (status) {
    if (status === 401) {
      return {
        originalError: error,
        category: ErrorCategory.AUTHENTICATION,
        isRetryable: false,
        userMessage: 'Authentication failed. Please check your API key.',
        technicalMessage: `Authentication error: ${error.message}`,
        statusCode,
      };
    }
    if (status === 429) {
      return {
        originalError: error,
        category: ErrorCategory.RATE_LIMITING,
        isRetryable: true,
        userMessage: 'Rate limit exceeded. Please try again later.',
        technicalMessage: `Rate limit error: ${error.message}`,
        statusCode,
      };
    }
    if (status >= 400 && status < 500) {
      return {
        originalError: error,
        category: ErrorCategory.VALIDATION,
        isRetryable: false,
        userMessage: 'Invalid request. Please check your parameters.',
        technicalMessage: `Client error: ${error.message}`,
        statusCode,
      };
    }
    if (status >= 500) {
      return {
        originalError: error,
        category: ErrorCategory.SERVER_ERROR,
        isRetryable: true,
        userMessage: 'Server error occurred. Please try again later.',
        technicalMessage: `Server error: ${error.message}`,
        statusCode,
      };
    }
  }

  return {
    originalError: error,
    category: ErrorCategory.NETWORK,
    isRetryable: true,
    userMessage: 'Network error occurred. Please try again.',
    technicalMessage: `Network error: ${error.message}`,
    statusCode,
  };
};

const categorizeZodError = (error: ZodError): CategorizedError => {
  const issues = error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  return {
    originalError: error,
    category: ErrorCategory.VALIDATION,
    isRetryable: false,
    userMessage: 'Invalid data format. Please check your input.',
    technicalMessage: `Schema validation failed: ${issues}`,
  };
};

const categorizeGenericError = (error: Error): CategorizedError => {
  return {
    originalError: error,
    category: ErrorCategory.UNKNOWN,
    isRetryable: true,
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: `Unknown error: ${error.message}`,
  };
};

export const ErrorCategorizer = {
  categorize: (error: Error): CategorizedError => {
    if (error instanceof AxiosError) {
      return categorizeAxiosError(error);
    }
    if (error instanceof ZodError) {
      return categorizeZodError(error);
    }
    return categorizeGenericError(error);
  },
};

/**
 * Enhanced error handler with retry logic and structured error processing
 *
 * This class provides comprehensive error handling capabilities including:
 * - Automatic retry logic with exponential backoff
 * - Error normalization and classification
 * - Structured error logging
 * - HTTP status code specific handling
 * - User-friendly error messages
 *
 * Features:
 * - Singleton pattern for consistent error handling
 * - Configurable retry strategies
 * - Support for multiple error types (Axios, Zod, custom)
 * - Rate limit aware retry logic
 * - Detailed error context logging
 *
 * @example
 * ```typescript
 * const errorHandler = ErrorHandler.getInstance();
 * const result = await errorHandler.withRetry(
 *   () => apiCall(),
 *   { operationName: 'search-request' }
 * );
 * ```
 *
 * @version 2.0.0
 * @since 1.0.0
 */
export class ErrorHandler {
  /** Singleton instance of the error handler */
  private static instance: ErrorHandler;

  /** Retry configuration settings */
  private retryConfig: RetryConfig;

  /** Circuit breaker for API protection */
  private circuitBreaker: CircuitBreaker;

  /**
   * Private constructor for singleton pattern
   *
   * Initializes the error handler with retry configuration from the config module.
   *
   * @private
   */
  private constructor() {
    this.retryConfig = {
      maxRetries: config.getMaxRetries(),
      baseDelay: config.getRetryDelay(),
      maxDelay: 30000, // 30 seconds max delay
      backoffFactor: 2
    };

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      volumeThreshold: 10,
    });

    // Set up circuit breaker event listeners
    this.circuitBreaker.on('open', () => {
      logger.warn('Circuit breaker opened - API calls will be blocked temporarily');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Circuit breaker closed - API calls resumed');
    });

    this.circuitBreaker.on('stateChange', (state: CircuitBreakerState) => {
      logger.info(`Circuit breaker state changed to: ${state}`);
    });

    logger.debug('Error handler initialized', {
      retryConfig: this.retryConfig,
    });
  }

  /**
   * Get circuit breaker statistics
   */
  public getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Check if error handler is healthy
   */
  public isHealthy(): boolean {
    return this.circuitBreaker.isHealthy();
  }

  /**
   * Force reset circuit breaker (for testing/admin purposes)
   */
  public forceResetCircuitBreaker(): void {
    this.circuitBreaker.forceReset();
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Get detailed error handler statistics
   */
  public getStats() {
    const cbStats = this.circuitBreaker.getStats();
    return {
      circuitBreaker: cbStats,
      isHealthy: this.isHealthy(),
      failureRate: this.circuitBreaker.getFailureRate(),
    };
  }

  /**
   * Get the singleton instance of the error handler
   *
   * Creates a new instance if one doesn't exist, otherwise returns the existing instance.
   * This ensures consistent error handling configuration across the application.
   *
   * @static
   * @returns {ErrorHandler} The singleton error handler instance
   *
   * @example
   * ```typescript
   * const errorHandler = ErrorHandler.getInstance();
   * ```
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Execute function with retry logic
   *
   * Executes the provided operation with automatic retry on failure.
   * Uses exponential backoff and respects non-retryable error types.
   *
   * @template T - The return type of the operation
   * @param {() => Promise<T>} operation - The async operation to execute
   * @param {object} context - Context information for logging
   * @param {string} context.operationName - Name of the operation for logging
   * @returns {Promise<T>} The result of the successful operation
   * @throws {Error} The last error if all retry attempts fail
   *
   * @example
   * ```typescript
   * const result = await errorHandler.withRetry(
   *   () => apiClient.search(params),
   *   { operationName: 'presearch-api-call', query: params.q }
   * );
   * ```
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; [key: string]: unknown }
  ): Promise<T> {
    // Wrap operation with circuit breaker
    return this.circuitBreaker.execute(async () => {
      return this.executeWithRetryInternal(operation, context);
    });
  }

  /**
   * Internal retry logic (called within circuit breaker)
   */
  private async executeWithRetryInternal<T>(
    operation: () => Promise<T>,
    context: { operationName: string; [key: string]: unknown }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();

        if (attempt > 0) {
          logger.info('Operation succeeded after retry', {
            ...context,
            attempt: attempt + 1,
            totalAttempts: this.retryConfig.maxRetries + 1,
          });
        }

        return result;
      } catch (error) {
        const categorizedError = ErrorCategorizer.categorize(error as Error);
        lastError = categorizedError.originalError;

        logger.warn(`Attempt ${attempt + 1} failed`, {
          ...context,
          error: categorizedError.technicalMessage,
          category: categorizedError.category,
          isRetryable: categorizedError.isRetryable,
        });

        if (!categorizedError.isRetryable || attempt === this.retryConfig.maxRetries) {
          this.logFinalError(categorizedError, context);
          throw lastError;
        }

        const delay = this.calculateRetryDelay(attempt, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should not be reached, but is here for type safety
    throw lastError!;
  }

  /**
   * Handle and normalize different types of errors
   *
   * Converts various error types into standardized Error objects
   * and logs the error with context information.
   *
   * @param {unknown} error - The error to handle (can be any type)
   * @param {Record<string, any>} [context] - Additional context for logging
   * @returns {Error} Normalized Error object
   *
   * @example
   * ```typescript
   * try {
   *   await riskyOperation();
   * } catch (error) {
   *   const handledError = errorHandler.handleError(error, {
   *     operation: 'search',
   *     userId: '123'
   *   });
   *   throw handledError;
   * }
   * ```
   */
  private logFinalError(categorizedError: CategorizedError, context: { [key: string]: unknown }): void {
    logger.error('Operation failed after all retries', {
      ...context,
      statusCode: categorizedError.statusCode,
      errorMessage: categorizedError.userMessage,
      error: categorizedError.technicalMessage,
      category: categorizedError.category,
      stack: categorizedError.originalError.stack,
    });
  }

  /**
   * Normalize error to standard Error object
   *
   * Converts various error types (Axios, Zod, string, etc.) into a standardized Error object.
   * Preserves original error information while ensuring consistent error structure.
   *
   * @private
   * @param {unknown} error - The error to normalize
   * @returns {Error} Standardized Error object with message and optional cause
   */


  /**
   * Handle Axios-specific errors
   *
   * Processes Axios HTTP errors and converts them into user-friendly error messages.
   * Handles different HTTP status codes and provides appropriate error context.
   *
   * @private
   * @param {AxiosError} error - The Axios error to handle
   * @returns {Error} Processed error with user-friendly message
   */


  /**
   * Extract meaningful error message from AxiosError
   */


  /**
   * Determines if an error should not be retried
   */


  /**
   * Calculate retry delay with enhanced exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, error?: Error): number {
    const baseDelay = this.retryConfig.baseDelay;
    const backoffFactor = this.retryConfig.backoffFactor;
    const maxDelay = this.retryConfig.maxDelay;

    // Handle rate limit errors with retry-after header
    if (error instanceof RateLimitExceededError && error.retryAfter) {
      // Convert retry-after to milliseconds and add smart buffer
      const retryAfterMs = error.retryAfter * 1000;
      const buffer = Math.random() * 2000 + 500; // 0.5-2.5 second buffer
      return Math.min(retryAfterMs + buffer, maxDelay);
    }

    // Enhanced base delay with error type consideration
    let adjustedBaseDelay = baseDelay;

    // Adjust base delay based on error type
    if (error instanceof AuthenticationError) {
      adjustedBaseDelay = baseDelay * 2; // Longer delay for auth errors
    } else if (error instanceof PresearchAPIError) {
      const apiError = error as PresearchAPIError;
      if (apiError.status && apiError.status >= 500) {
        adjustedBaseDelay = baseDelay * 1.5; // Longer delay for server errors
      }
    }

    // Enhanced exponential backoff with fibonacci-like progression
    const fibonacciMultiplier = this.getFibonacciMultiplier(attempt);
    const exponentialDelay =
      adjustedBaseDelay * Math.pow(backoffFactor, attempt) * fibonacciMultiplier;

    // Enhanced jitter with normal distribution
    const jitterRange = exponentialDelay * 0.3; // ±30% jitter
    const jitter = this.generateNormalJitter(jitterRange);

    const delayWithJitter = exponentialDelay + jitter;

    // Cap at maximum delay
    return Math.min(Math.max(delayWithJitter, adjustedBaseDelay), maxDelay);
  }

  /**
   * Get Fibonacci-like multiplier for more gradual backoff
   */
  private getFibonacciMultiplier(attempt: number): number {
    const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21];
    return fibonacci[Math.min(attempt, fibonacci.length - 1)] || 21;
  }

  /**
   * Generate jitter with normal distribution for better spread
   */
  private generateNormalJitter(range: number): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    // Scale to desired range and clamp
    return Math.max(-range, Math.min(range, z0 * (range / 3)));
  }



  /**
   * Handle and categorize errors
   * 
   * @param {unknown} error - The error to handle
   * @param {Record<string, unknown>} [context] - Optional context object for logging
   * @returns {CategorizedError} Categorized error with additional context
   */
  public handle(error: unknown, context?: Record<string, unknown>): Error {
    const normalizedError = this.normalizeError(error);
    const categorizedError = ErrorCategorizer.categorize(normalizedError);
    
    if (context) {
      logger.error('Error occurred', {
        ...context,
        error: categorizedError.technicalMessage,
        category: categorizedError.category,
        statusCode: categorizedError.statusCode
      });
    }
    
    switch (categorizedError.category) {
      case ErrorCategory.AUTHENTICATION:
        return new AuthenticationError(categorizedError.userMessage);
      case ErrorCategory.RATE_LIMITING:
        return new RateLimitExceededError(categorizedError.userMessage, 0); // retryAfter can be extracted if available
      case ErrorCategory.VALIDATION:
        return new ValidationError(categorizedError.userMessage);
      case ErrorCategory.NETWORK:
        return new NetworkError(categorizedError.userMessage);
      case ErrorCategory.SERVER_ERROR:
        return new PresearchAPIError(categorizedError.userMessage, categorizedError.statusCode || 500);
      default:
        return new McpError(categorizedError.userMessage, 'UNKNOWN_ERROR', 500);
    }
  }

  /**
   * Handle and categorize errors (alias for backward compatibility)
   * 
   * @param {unknown} error - The error to handle
   * @param {Record<string, unknown>} [context] - Optional context object for logging
   * @returns {Error} Specific custom error based on category
   */
  public handleError(error: unknown, context?: Record<string, unknown>): Error {
    return this.handle(error, context);
  }

  /**
   * Normalize error to standard Error object
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return new Error(String(error.message));
    }
    
    return new Error('Unknown error occurred');
  }

  /**
   * Create user-friendly error message for MCP responses
   */
  public createUserFriendlyMessage(error: Error): string {
    if (error instanceof McpError) {
      switch (error.name) {
        case 'ApiError':
          return `An API error occurred: ${error.message}`;
        case 'ValidationError':
          return `A validation error occurred: ${error.message}`;
        case 'ConfigError':
          return `A configuration error occurred: ${error.message}`;
        case 'ToolExecutionError':
          return error.message;
        default:
          return `An unexpected error occurred: ${error.message}`;
      }
    }
    const categorizedError = ErrorCategorizer.categorize(error);
    return categorizedError.userMessage;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

export class RateLimitError extends ApiError {
  constructor(message: string, status: number, data?: unknown) {
    super(message, status, data);
  }
}

export class ServerError extends ApiError {
  constructor(message: string, status: number, data?: unknown) {
    super(message, status, data);
  }
}

export class ClientError extends ApiError {
  constructor(message: string, status: number, data?: unknown) {
    super(message, status, data);
  }
}
