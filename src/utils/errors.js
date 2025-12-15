import logger from "../core/logger.js";

export class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMIT_ERROR", 429);
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(message, service) {
    super(`${service} error: ${message}`, "EXTERNAL_SERVICE_ERROR", 502);
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

/**
 * Wrapper for tool execution to handle errors consistently
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export const withErrorHandling = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    logger.error("Error executing tool", { error: error.message, stack: error.stack });
    
    if (error instanceof AppError) {
      throw error; // Re-throw known app errors
    }
    
    // Convert unknown errors to AppError
    throw new AppError(`Internal error: ${error.message}`, "INTERNAL_ERROR");
  }
};
