/**
 * Enhanced error utilities for the MCP server with proper error types and logging.
 */

import logger from "../core/logger.js";

/**
 * Custom error types for different failure scenarios
 */
export class PresearchError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "PresearchError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends PresearchError {
  constructor(message, details = {}) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class NetworkError extends PresearchError {
  constructor(message, details = {}) {
    super(message, "NETWORK_ERROR", details);
    this.name = "NetworkError";
  }
}

export class RateLimitError extends PresearchError {
  constructor(message, retryAfter = null, details = {}) {
    super(message, "RATE_LIMIT_ERROR", details);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends PresearchError {
  constructor(message, timeoutMs, details = {}) {
    super(message, "TIMEOUT_ERROR", details);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class SecurityError extends PresearchError {
  constructor(message, details = {}) {
    super(message, "SECURITY_ERROR", details);
    this.name = "SecurityError";
  }
}

/**
 * Creates a standardized error response for the MCP client with enhanced error handling.
 *
 * @param {string} toolName - The name of the tool that failed.
 * @param {Error} error - The error object.
 * @param {string} [requestId] - Optional request ID for tracing.
 * @param {object} [context] - Additional context for error reporting.
 * @returns {object} - The standardized error response.
 */
export function createErrorResponse(toolName, error, requestId, context = {}) {
  // Normalize error input
  const errObj = normalizeError(error);

  // Enhanced error logging with context
  logger.error("Tool execution failed", {
    toolName,
    errorType: errObj.name,
    errorCode: errObj.code || "UNKNOWN_ERROR",
    message: errObj.message,
    stack: errObj.stack,
    requestId,
    context,
    timestamp: errObj.timestamp || new Date().toISOString(),
    details: errObj.details || {},
  });

  // Determine user-friendly message based on error type
  const userMessage = getUserFriendlyMessage(errObj, toolName);

  // Include retry suggestions for specific error types
  const suggestions = getErrorSuggestions(errObj);

  return {
    jsonrpc: "2.0",
    error: {
      code:
        errObj.code === "RATE_LIMIT_ERROR"
          ? -32001
          : errObj.code === "VALIDATION_ERROR"
            ? -32602
            : errObj.code === "TIMEOUT_ERROR"
              ? -32003
              : errObj.code === "NETWORK_ERROR"
                ? -32002
                : errObj.code === "SECURITY_ERROR"
                  ? -32004
                  : -32603,
      message: userMessage,
      data: {
        errorCode: errObj.code || "UNKNOWN_ERROR",
        details: errObj.message,
        suggestions,
        retryAfter: errObj.retryAfter || null,
        timeoutMs: errObj.timeoutMs || null,
        toolName,
        requestId,
        timestamp: errObj.timestamp || new Date().toISOString(),
      },
    },
    id: requestId || null,
  };
}

/**
 * Normalize different error types to consistent format
 */
export function normalizeError(error) {
  if (error instanceof PresearchError) {
    return error;
  }

  if (error instanceof Error) {
    // Handle Axios/HTTP errors
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        const retryAfter = error.response.headers["retry-after"];
        return new RateLimitError("Rate limit exceeded", retryAfter, {
          originalError: error.message,
        });
      }
      if (status === 401 || status === 403) {
        return new SecurityError("Authentication failed", {
          originalError: error.message,
        });
      }
      if (status === 402) {
        return new SecurityError(
          "Payment Required: Please check your subscription or credits",
          { originalError: error.message },
        );
      }
      if (status === 422) {
        return new ValidationError(
          "Unprocessable Entity: The request was well-formed but was unable to be followed due to semantic errors.",
          { originalError: error.message, data: error.response.data },
        );
      }
      if (status >= 500) {
        return new NetworkError(`Server error: ${status}`, {
          originalError: error.message,
        });
      }
    }

    // Try to categorize common error types
    if (
      error.message.includes("timeout") ||
      error.message.includes("Timeout")
    ) {
      return new TimeoutError(error.message, 30000, {
        originalError: error.message,
      });
    }

    if (
      error.message.includes("rate limit") ||
      error.message.includes("Rate limit")
    ) {
      return new RateLimitError(error.message, null, {
        originalError: error.message,
      });
    }

    if (
      error.message.includes("network") ||
      error.message.includes("Network")
    ) {
      return new NetworkError(error.message, { originalError: error.message });
    }

    if (
      error.message.includes("validation") ||
      error.message.includes("Validation")
    ) {
      return new ValidationError(error.message, {
        originalError: error.message,
      });
    }

    if (
      error.message.includes("security") ||
      error.message.includes("Security")
    ) {
      return new SecurityError(error.message, { originalError: error.message });
    }

    return new PresearchError(error.message, "UNKNOWN_ERROR", {
      originalError: error.message,
    });
  }

  if (typeof error === "string") {
    return new PresearchError(error, "STRING_ERROR");
  }

  return new PresearchError(String(error), "UNKNOWN_ERROR");
}

/**
 * Get user-friendly error messages
 */
function getUserFriendlyMessage(error, toolName) {
  const toolDescription = toolName ? `tool '${toolName}'` : "operation";

  switch (error.code) {
    case "VALIDATION_ERROR":
      return `Invalid input parameters for ${toolDescription}. Please check your request and try again.`;
    case "NETWORK_ERROR":
      return `Network connectivity issue while executing ${toolDescription}. Please check your connection and try again.`;
    case "RATE_LIMIT_ERROR":
      return `Rate limit exceeded for ${toolDescription}. Please wait a moment and try again.`;
    case "TIMEOUT_ERROR":
      return `Request timeout while executing ${toolDescription}. The operation took too long to complete.`;
    case "SECURITY_ERROR":
      return `Security validation failed for ${toolDescription}. Please check your permissions and input data.`;
    default:
      return `Error executing ${toolDescription}: ${error.message}`;
  }
}

/**
 * Get error-specific suggestions for resolution
 */
function getErrorSuggestions(error) {
  const suggestions = [];

  switch (error.code) {
    case "VALIDATION_ERROR":
      suggestions.push("Check input parameters against schema requirements");
      suggestions.push("Verify data types and formats");
      break;
    case "NETWORK_ERROR":
      suggestions.push("Check internet connectivity");
      suggestions.push("Verify API endpoint availability");
      suggestions.push("Check firewall and proxy settings");
      break;
    case "RATE_LIMIT_ERROR":
      suggestions.push("Wait before retrying");
      suggestions.push("Reduce request frequency");
      if (error.retryAfter) {
        suggestions.push(`Retry after ${error.retryAfter} seconds`);
      }
      break;
    case "TIMEOUT_ERROR":
      suggestions.push("Try with simpler parameters");
      suggestions.push("Increase timeout if supported");
      suggestions.push("Check for network latency issues");
      break;
    case "SECURITY_ERROR":
      suggestions.push("Verify API key and permissions");
      suggestions.push("Check input data for security issues");
      suggestions.push("Ensure proper authentication");
      break;
    default:
      suggestions.push("Check input parameters");
      suggestions.push("Verify API configuration");
      suggestions.push("Contact support if issue persists");
  }

  return suggestions;
}

/**
 * Wrap async functions with consistent error handling
 */
export function withErrorHandling(toolName, asyncFn) {
  return async function (...args) {
    try {
      return await asyncFn.apply(this, args);
    } catch (error) {
      // Extract request ID from arguments if available
      const requestId = args[0]?.requestId || args[0]?.metadata?.requestId;
      return createErrorResponse(toolName, error, requestId, { args: args[0] });
    }
  };
}
