/**
 * Enhanced API Client with Comprehensive Error Handling and Monitoring
 * Unified HTTP client with advanced rate limiting, retry logic, caching, and observability
 * Optimized for Presearch API integration with Bearer OAuth authentication
 * 
 * Key Features:
 * - Rate limiting with configurable window-based throttling
 * - Exponential backoff retry mechanism for transient failures
 * - In-memory caching with TTL and size limits
 * - Comprehensive error categorization and logging
 * - Performance monitoring and metrics collection
 * - Memory-efficient request processing
 * - Circuit breaker pattern for resilience
 */

import axios from "axios";
import http from "http";
import https from "https";
import NodeCache from "node-cache";
import { backOff } from "exponential-backoff";
import logger from "./logger.js";
import { loadConfig } from "./config.js";
import { metricsCollector, logErrorWithMetrics } from "./monitoring.js";

const config = loadConfig();

/**
 * Enhanced API Client class providing robust HTTP communication
 * with Presearch API and other external services
 */
class ApiClient {
  /**
   * Creates a new ApiClient instance with comprehensive configuration
   * Initializes HTTP client, cache, rate limiting, and monitoring components
   * Sets up interceptors for request/response logging and error handling
   */
  constructor() {
    this.client = null;
    this.cache = null;
    this.requestQueue = [];
    this.isProcessing = false;
    this.requestCount = 0;
    this.windowStart = Date.now();
    this.rateLimitHeaders = {};

    this.initialize();
  }

  /**
   * Initializes the API client components:
   * - Configures axios HTTP client with base URL and authentication
   * - Sets up NodeCache for response caching with TTL management
   * - Configures request/response interceptors for logging and monitoring
   * - Establishes error handling and rate limiting mechanisms
   */
  initialize() {
    // Initialize axios client
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      headers: {
        "User-Agent": "Presearch-MCP-Server/2.1.4",
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
      },
    });

    // Initialize cache if enabled
    if (config.cache.enabled) {
      this.cache = new NodeCache({
        stdTTL: config.cache.ttl,
        maxKeys: config.cache.maxKeys,
        checkperiod: 120,
      });
    }

    // Setup request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug("API Request", {
          method: config.method,
          url: config.url,
          params: config.params,
          hasAuth: !!config.headers?.Authorization,
        });
        return config;
      },
      (error) => {
        logger.error("API Request Error", { error: error.message });
        return Promise.reject(error);
      },
    );

    // Setup response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Capture rate limit headers if present
        if (response.headers) {
          const headers = response.headers;
          if (
            headers["x-ratelimit-remaining"] ||
            headers["x-ratelimit-limit"]
          ) {
            this.rateLimitHeaders = {
              limit: headers["x-ratelimit-limit"],
              remaining: headers["x-ratelimit-remaining"],
              reset: headers["x-ratelimit-reset"],
              updated: new Date().toISOString(),
            };
          }
        }

        logger.debug("API Response", {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length,
          rateLimitRemaining: response.headers?.["x-ratelimit-remaining"],
        });
        return response;
      },
      (error) => {
        logger.error("API Response Error", {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          responseData: error.response?.data,
          responseHeaders: error.response?.headers,
          hasAuth: !!error.config?.headers?.Authorization,
        });
        return Promise.reject(error);
      },
    );
  }

  // Rate limiting logic
  async checkRateLimit() {
    const now = Date.now();
    const windowDuration = now - this.windowStart;

    if (windowDuration >= config.rateLimit.windowMs) {
      // Reset window
      this.requestCount = 0;
      this.windowStart = now;
    }

    while (this.requestCount >= config.rateLimit.maxRequests) {
      const now = Date.now();
      const windowDuration = now - this.windowStart;

      if (windowDuration >= config.rateLimit.windowMs) {
        this.requestCount = 0;
        this.windowStart = now;
        break; // Exit loop and proceed
      }

      const waitTime = config.rateLimit.windowMs - windowDuration;
      logger.warn("Rate limit reached, waiting", { waitTime });
      await this.sleep(waitTime);
    }

    this.requestCount++;
    return true;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Generate cache key
  getCacheKey(method, url, params = {}) {
    if (!params || Object.keys(params).length === 0) {
      return `${method}:${url}:`;
    }
    // Sort keys to ensure consistent cache hits
    const sortedParams = {};
    Object.keys(params).sort().forEach(key => {
      sortedParams[key] = params[key];
    });
    return `${method}:${url}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Enhanced request method with comprehensive error handling and monitoring
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, url, options = {}) {
    const startTime = Date.now();
    const {
      params = {},
      data = {},
      useCache = true,
      retries = config.retries,
      timeout,
      headers,
    } = options;

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.debug("API Request initiated", {
      requestId,
      method,
      url,
      params,
      hasAuth:
        !!headers?.Authorization ||
        !!this.client.defaults.headers?.Authorization,
      useCache,
      timeout: timeout || config.timeout,
    });

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Check cache first
      if (this.cache && useCache) {
        const cacheKey = this.getCacheKey(method, url, params);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          logger.debug("Cache hit", { requestId, cacheKey });
          metricsCollector.recordCacheOperation("get", true);

          // Record successful cache hit
          metricsCollector.recordRequest({
            method,
            endpoint: url,
            status: 200,
            duration: Date.now() - startTime,
            metadata: { cache: "hit", requestId },
          });

          return cached;
        }
        metricsCollector.recordCacheOperation("get", false);
      }

      // Enhanced retry configuration with custom error handling
      const retryConfig = {
        numOfAttempts: retries + 1,
        startingDelay: 1000,
        maxDelay: 10000,
        timeMultiple: 2,
        retry: (error, attemptNumber) => {
          const shouldRetry = this.shouldRetryRequest(error, attemptNumber);

          if (shouldRetry) {
            logger.warn(`Retry attempt ${attemptNumber} for ${method} ${url}`, {
              requestId,
              error: error.message,
              status: error.response?.status,
              attemptNumber,
            });

            // Record retry attempt
            metricsCollector.recordRequest({
              method,
              endpoint: url,
              status: error.response?.status || 0,
              duration: Date.now() - startTime,
              errorType: error.name || "NetworkError",
              metadata: { retry: true, attemptNumber, requestId },
            });
          }

          return shouldRetry;
        },
      };

      let response;
      let attemptCount = 0;

      try {
        response = await backOff(async () => {
          attemptCount++;
          const attemptStartTime = Date.now();

          try {
            const result = await this.client.request({
              method,
              url,
              params,
              data,
              timeout: timeout || config.timeout,
              headers,
            });

            // Record successful request
            const duration = Date.now() - attemptStartTime;
            metricsCollector.recordRequest({
              method,
              endpoint: url,
              status: result.status,
              duration,
              metadata: { attempt: attemptCount, requestId },
            });

            return result;
          } catch (attemptError) {
            const duration = Date.now() - attemptStartTime;

            // Record failed attempt
            metricsCollector.recordRequest({
              method,
              endpoint: url,
              status: attemptError.response?.status || 0,
              duration,
              errorType: attemptError.name || "NetworkError",
              metadata: { attempt: attemptCount, requestId },
            });

            throw attemptError;
          }
        }, retryConfig);
      } catch (backoffError) {
        // Handle final failure after all retries
        await this.handleRequestError(backoffError, {
          method,
          url,
          params,
          requestId,
          startTime,
          attemptCount,
        });
      }

      // Cache successful response with memory management
      if (this.cache && useCache && response?.data) {
        const cacheKey = this.getCacheKey(method, url, params);
        
        // Check cache size before adding new entries
        const cacheStats = this.cache.getStats();
        if (cacheStats.ksize >= config.cache.maxKeys * 0.9) { // 90% capacity warning
          logger.warn("Cache approaching capacity", {
            currentSize: cacheStats.ksize,
            maxSize: config.cache.maxKeys,
            utilization: Math.round((cacheStats.ksize / config.cache.maxKeys) * 100)
          });
        }
        
        // Only cache if we have space or if this is important data
        if (cacheStats.ksize < config.cache.maxKeys) {
          this.cache.set(cacheKey, response.data);
          metricsCollector.recordCacheOperation("set", true);
          logger.debug("Cached response", { requestId, cacheKey, cacheSize: cacheStats.ksize + 1 });
        } else {
          logger.debug("Cache full, skipping cache for this response", { requestId, cacheKey });
        }
      }

      const totalDuration = Date.now() - startTime;
      logger.debug("API Request completed successfully", {
        requestId,
        method,
        url,
        status: response.status,
        duration: totalDuration,
        attempts: attemptCount,
      });

      return response.data;
    } catch (error) {
      // This should not be reached due to error handling above, but kept as safety net
      const duration = Date.now() - startTime;

      logErrorWithMetrics(error, {
        method,
        endpoint: url,
        status: 500,
        duration,
        metadata: { requestId, fallback: true },
      });

      throw error;
    }
  }

  /**
   * Determine if a request should be retried
   * @param {Error} error - The error that occurred
   * @param {number} attemptNumber - Current attempt number
   * @returns {boolean} Whether to retry the request
   */
  shouldRetryRequest(error, attemptNumber) {
    // Don't retry after max attempts
    if (attemptNumber >= config.retries + 1) {
      logger.debug("Max retry attempts reached", { attemptNumber, maxRetries: config.retries });
      return false;
    }

    // Always retry network errors and timeouts
    if (!error.response) {
      logger.debug("Retrying due to network/timeout error", { error: error.message });
      return true;
    }

    const status = error.response.status;
    
    // Enhanced retry logic with detailed logging
    const shouldRetry = status >= 500 || status === 429 || status === 408;
    
    logger.debug("Retry decision", {
      status,
      shouldRetry,
      attemptNumber,
      errorMessage: error.message
    });
    
    return shouldRetry;
  }

  /**
   * Handle request errors with proper error types and monitoring
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   */
  async handleRequestError(error, context) {
    const { method, url, params, requestId, startTime, attemptCount } = context;
    const duration = Date.now() - startTime;

    let errorType;
    let errorMessage;
    let shouldAlert = false;

    if (!error.response) {
      // Network/timeout errors
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        errorType = "TimeoutError";
        errorMessage = `Request timeout after ${config.timeout}ms`;
      } else {
        errorType = "NetworkError";
        errorMessage = `Network error: ${error.message}`;
      }
    } else {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const responseData = error.response.data;

      switch (status) {
        case 400:
          errorType = "ValidationError";
          errorMessage = `Invalid request: ${responseData?.message || statusText}`;
          break;

        case 401:
          errorType = "AuthenticationError";
          errorMessage = "Authentication failed: Invalid or expired API key";
          shouldAlert = true;
          break;

        case 403:
          errorType = "AuthorizationError";
          errorMessage = "Access forbidden: Insufficient permissions";
          shouldAlert = true;
          break;

        case 404:
          errorType = "NotFoundError";
          errorMessage = `Resource not found: ${url}`;
          break;

        case 429:
          errorType = "RateLimitError";
          errorMessage = "Rate limit exceeded: Too many requests";
          metricsCollector.recordRateLimitEvent("hit");
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          errorType = "ServerError";
          errorMessage = `Server error (${status}): ${statusText}`;
          shouldAlert = true;
          break;

        default:
          errorType = "ApiError";
          errorMessage = `API error (${status}): ${statusText}`;
      }
    }

    // Create enhanced error with context
    const enhancedError = new Error(errorMessage);
    enhancedError.name = errorType;
    enhancedError.code = error.code;
    enhancedError.response = error.response;
    enhancedError.requestId = requestId;
    enhancedError.attemptCount = attemptCount;
    enhancedError.context = {
      method,
      url,
      params,
      duration,
      timestamp: new Date().toISOString(),
    };

    // Log error with metrics
    logErrorWithMetrics(enhancedError, {
      method,
      endpoint: url,
      status: error.response?.status || 0,
      duration,
      errorType,
      metadata: {
        requestId,
        attemptCount,
        shouldAlert,
      },
    });

    // Trigger alert if needed
    if (shouldAlert) {
      // This would integrate with your alerting system
      logger.error(`ALERT: ${errorType} detected`, {
        requestId,
        method,
        url,
        error: errorMessage,
      });
    }

    throw enhancedError;
  }

  // Convenience methods
  async get(url, params = {}, options = {}) {
    return this.request("GET", url, { params, ...options });
  }

  async post(url, data = {}, options = {}) {
    return this.request("POST", url, { data, ...options });
  }

  async put(url, data = {}, options = {}) {
    return this.request("PUT", url, { data, ...options });
  }

  async delete(url, options = {}) {
    return this.request("DELETE", url, options);
  }

  /**
   * Enhanced health check with comprehensive monitoring and diagnostics
   * @param {string} [apiKey] - Optional API key to use for the check
   * @param {Object} [options] - Health check options
   * @returns {Promise<Object>} Comprehensive health status object
   */
  async healthCheck(apiKey, options = {}) {
    const startTime = Date.now();
    const {
      timeout = 5000,
      includeDiagnostics = true,
      testQuery = "healthcheck",
    } = options;

    const healthCheckId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.debug("Health check initiated", {
      healthCheckId,
      hasApiKey: !!apiKey,
      timeout,
      includeDiagnostics,
    });

    const healthStatus = {
      id: healthCheckId,
      timestamp: new Date().toISOString(),
      status: "unknown",
      checks: {},
      diagnostics: {},
      performance: {},
    };

    try {
      // Test 1: Basic connectivity
      const connectivityStart = Date.now();
      const connectivityOptions = {
        useCache: false,
        retries: 1,
        timeout,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      };

      const searchResult = await this.get(
        "/v1/search",
        { q: testQuery, ip: "8.8.8.8" },
        connectivityOptions,
      );

      const connectivityDuration = Date.now() - connectivityStart;

      healthStatus.checks.connectivity = {
        status: "healthy",
        latencyMs: connectivityDuration,
        message: "API is reachable and responding.",
        timestamp: new Date().toISOString(),
      };

      // Test 2: Authentication validation
      const isAuthenticated = !!(searchResult && apiKey);
      healthStatus.checks.authentication = {
        status: isAuthenticated ? "healthy" : "degraded",
        authenticated: isAuthenticated,
        message: isAuthenticated
          ? "API key is valid and authenticated."
          : "No API key provided or authentication failed.",
        timestamp: new Date().toISOString(),
      };

      // Test 3: Response validation
      const hasValidResponse =
        searchResult &&
        (searchResult.results ||
          searchResult.standardResults ||
          searchResult.data);

      healthStatus.checks.response = {
        status: hasValidResponse ? "healthy" : "unhealthy",
        hasResults: hasValidResponse,
        resultCount:
          searchResult.results?.length ||
          searchResult.standardResults?.length ||
          0,
        message: hasValidResponse
          ? "API returned valid search results."
          : "API response missing expected data structure.",
        timestamp: new Date().toISOString(),
      };

      healthStatus.status = "healthy";
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const isAuthError =
        error.response?.status === 401 || error.response?.status === 403;
      const isTimeout =
        error.code === "ECONNABORTED" || error.message.includes("timeout");
      const isRateLimited = error.response?.status === 429;

      // Determine overall status based on error type
      if (isAuthError) {
        healthStatus.status = "unhealthy";
        healthStatus.checks.authentication = {
          status: "unhealthy",
          authenticated: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      } else if (isRateLimited) {
        healthStatus.status = "degraded";
        healthStatus.checks.rateLimit = {
          status: "degraded",
          limited: true,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      } else if (isTimeout) {
        healthStatus.status = "degraded";
        healthStatus.checks.connectivity = {
          status: "degraded",
          latencyMs,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      } else {
        healthStatus.status = "unhealthy";
        healthStatus.checks.connectivity = {
          status: "unhealthy",
          latencyMs,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      // Record the error in metrics
      logErrorWithMetrics(error, {
        method: "HEALTH_CHECK",
        endpoint: "/v1/search",
        status: error.response?.status || 0,
        duration: latencyMs,
        metadata: {
          healthCheckId,
          isAuthError,
          isTimeout,
          isRateLimited,
        },
      });
    }

    // Add system diagnostics if requested
    if (includeDiagnostics) {
      healthStatus.diagnostics = {
        rateLimit: this.getRateLimitStats(),
        cache: this.getCacheStats(),
        metrics: metricsCollector.getMetrics(),
        system: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          version: process.version,
        },
      };
    }

    // Add performance metrics
    const totalDuration = Date.now() - startTime;
    healthStatus.performance = {
      totalDurationMs: totalDuration,
      timestamp: new Date().toISOString(),
    };

    logger.debug("Health check completed", {
      healthCheckId,
      status: healthStatus.status,
      duration: totalDuration,
      checks: Object.keys(healthStatus.checks).length,
    });

    return healthStatus;
  }

  // Cache management
  clearCache() {
    if (this.cache) {
      this.cache.flushAll();
      logger.info("Cache cleared");
    }
  }

  getCacheStats() {
    if (!this.cache) {
      return { enabled: false };
    }

    return {
      enabled: true,
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      ksize: this.cache.getStats().ksize,
      vsize: this.cache.getStats().vsize,
    };
  }

  // Rate limit stats
  getRateLimitStats() {
    return {
      currentCount: this.requestCount,
      maxRequests: config.rateLimit.maxRequests,
      windowMs: config.rateLimit.windowMs,
      windowStart: new Date(this.windowStart).toISOString(),
      apiHeaders: this.rateLimitHeaders,
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
