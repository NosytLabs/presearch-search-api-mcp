/**
 * Enhanced error types for better error handling and categorization
 */

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
  API = 'API',
  CACHE = 'CACHE',
  CONFIGURATION = 'CONFIGURATION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  apiKey?: string;
  requestId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetails {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  retryAfter?: number;
  context?: ErrorContext;
  originalError?: Error;
}

/**
 * Base class for all custom errors
 */
export abstract class BaseError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly isRetryable: boolean;
  public readonly retryAfter?: number;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    isRetryable: boolean = false,
    retryAfter?: number,
    context?: ErrorContext
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.severity = severity;
    this.isRetryable = isRetryable;
    this.retryAfter = retryAfter;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      isRetryable: this.isRetryable,
      retryAfter: this.retryAfter,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Authentication related errors
 */
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed', context?: ErrorContext) {
    super(message, ErrorCategory.AUTHENTICATION, ErrorSeverity.HIGH, false, undefined, context);
  }
}

export class InvalidApiKeyError extends AuthenticationError {
  constructor(context?: ErrorContext) {
    super('Invalid or missing API key', context);
  }
}

export class ExpiredApiKeyError extends AuthenticationError {
  constructor(context?: ErrorContext) {
    super('API key has expired', context);
  }
}

/**
 * Authorization related errors
 */
export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access denied', context?: ErrorContext) {
    super(message, ErrorCategory.AUTHORIZATION, ErrorSeverity.HIGH, false, undefined, context);
  }
}

export class InsufficientPermissionsError extends AuthorizationError {
  constructor(resource: string, context?: ErrorContext) {
    super(`Insufficient permissions to access ${resource}`, context);
  }
}

/**
 * Validation related errors
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string = 'Validation failed',
    validationErrors: Array<{ field: string; message: string }> = [],
    context?: ErrorContext
  ) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.MEDIUM, false, undefined, context);
    this.validationErrors = validationErrors;
  }
}

export class InvalidInputError extends ValidationError {
  constructor(field: string, value: unknown, expectedFormat: string, context?: ErrorContext) {
    const validationErrors = [{
      field,
      message: `Invalid ${field}: expected ${expectedFormat}, got ${typeof value}`,
    }];
    super(`Invalid input for field '${field}'`, validationErrors, context);
  }
}

export class MissingRequiredFieldError extends ValidationError {
  constructor(field: string, context?: ErrorContext) {
    const validationErrors = [{
      field,
      message: `Field '${field}' is required but was not provided`,
    }];
    super(`Missing required field '${field}'`, validationErrors, context);
  }
}

/**
 * Network related errors
 */
export class NetworkError extends BaseError {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(
    message: string = 'Network request failed',
    statusCode?: number,
    responseBody?: string,
    context?: ErrorContext
  ) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.HIGH, true, undefined, context);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class TimeoutError extends BaseError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, operation: string = 'operation', context?: ErrorContext) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      ErrorCategory.TIMEOUT,
      ErrorSeverity.MEDIUM,
      true,
      Math.min(timeoutMs * 2, 30000), // Retry after double the timeout, max 30s
      context
    );
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends BaseError {
  public readonly limit: number;
  public readonly remaining: number;
  public readonly resetTime: Date;

  constructor(
    limit: number,
    remaining: number = 0,
    resetTime: Date,
    context?: ErrorContext
  ) {
    const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
    super(
      `Rate limit exceeded: ${limit} requests allowed, ${remaining} remaining. Resets at ${resetTime.toISOString()}`,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      true,
      retryAfter,
      context
    );
    this.limit = limit;
    this.remaining = remaining;
    this.resetTime = resetTime;
  }
}

/**
 * API related errors
 */
export class ApiError extends BaseError {
  public readonly statusCode: number;
  public readonly apiResponse?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    apiResponse?: Record<string, unknown>,
    context?: ErrorContext
  ) {
    const isRetryable = statusCode >= 500 || statusCode === 429;
    const severity = statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    
    super(message, ErrorCategory.API, severity, isRetryable, undefined, context);
    this.statusCode = statusCode;
    this.apiResponse = apiResponse;
  }
}

export class ApiUnavailableError extends ApiError {
  constructor(serviceName: string, context?: ErrorContext) {
    super(`${serviceName} API is currently unavailable`, 503, undefined, context);
  }
}

/**
 * Cache related errors
 */
export class CacheError extends BaseError {
  constructor(message: string = 'Cache operation failed', severity: ErrorSeverity = ErrorSeverity.LOW, context?: ErrorContext) {
    super(message, ErrorCategory.CACHE, severity, false, undefined, context);
  }
}

export class CacheConnectionError extends CacheError {
  constructor(context?: ErrorContext) {
    super('Failed to connect to cache', ErrorSeverity.MEDIUM, context);
  }
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: ErrorContext) {
    super(message, ErrorCategory.CONFIGURATION, ErrorSeverity.HIGH, false, undefined, context);
    this.configKey = configKey;
  }
}

export class MissingConfigurationError extends ConfigurationError {
  constructor(configKey: string, context?: ErrorContext) {
    super(`Missing required configuration: ${configKey}`, configKey, context);
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  constructor(configKey: string, expectedFormat: string, context?: ErrorContext) {
    super(
      `Invalid configuration for ${configKey}: expected ${expectedFormat}`,
      configKey,
      context
    );
  }
}

/**
 * Security related errors
 */
export class SecurityError extends BaseError {
  constructor(message: string = 'Security violation detected', context?: ErrorContext) {
    super(message, ErrorCategory.AUTHENTICATION, ErrorSeverity.CRITICAL, false, undefined, context);
  }
}

export class SuspiciousActivityError extends SecurityError {
  constructor(activity: string, context?: ErrorContext) {
    super(`Suspicious activity detected: ${activity}`, context);
  }
}

export class InputSanitizationError extends SecurityError {
  constructor(input: string, reason: string, context?: ErrorContext) {
    super(`Input sanitization failed: ${reason}. Input: ${input.substring(0, 100)}...`, context);
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Check if an error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isRetryable;
    }
    
    // Check for common retryable error patterns
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /rate.?limit/i,
      /service.?unavailable/i,
      /internal.?server.?error/i,
    ];
    
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Get retry delay for an error
   */
  static getRetryDelay(error: Error, attempt: number = 1): number {
    if (error instanceof BaseError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }
    
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    
    return delay + jitter;
  }

  /**
   * Convert any error to a BaseError
   */
  static normalize(error: unknown, context?: ErrorContext): BaseError {
    if (error instanceof BaseError) {
      return error;
    }
    
    let message: string;
    if (error instanceof Error) {
      message = error.message;
      // Try to categorize based on error name or message
      if (error.name.includes('Validation') || error.message.includes('validation')) {
        return new ValidationError(message, [], context);
      }
      
      if (error.name.includes('Network') || error.message.includes('network')) {
        return new NetworkError(message, undefined, undefined, context);
      }
      
      if (error.name.includes('Timeout') || error.message.includes('timeout')) {
        return new TimeoutError(30000, 'operation', context);
      }
      
      if (error.name.includes('Auth') || error.message.includes('auth')) {
        return new AuthenticationError(message, context);
      }
      
      // Default to unknown error
    } else {
      message = typeof error === 'string' ? error : 'Unknown error occurred';
    }
    return new class extends BaseError {
      constructor() {
        super(message, ErrorCategory.UNKNOWN, ErrorSeverity.HIGH, false, undefined, context);
      }
    }();
  }

  /**
   * Create error context from request information
   */
  static createContext(
    operation: string,
    component: string,
    metadata?: Record<string, unknown>
  ): ErrorContext {
    return {
      operation,
      component,
      timestamp: new Date(),
      requestId: this.generateRequestId(),
      metadata,
    };
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}