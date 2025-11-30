/**
 * Consolidated API Client
 * Unified HTTP client with rate limiting, retry logic, and caching
 * Enhanced for Presearch API integration with Bearer OAuth authentication
 */

import axios from "axios";
import NodeCache from "node-cache";
import { backOff } from "exponential-backoff";
import logger from "./logger.js";
import { loadConfig } from "./config.js";
const config = loadConfig();

class ApiClient {
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

  initialize() {
    // Initialize axios client
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        "User-Agent": "Presearch-MCP-Server/2.1.0",
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
    const paramsStr = Object.keys(params).length ? JSON.stringify(params) : "";
    return `${method}:${url}:${paramsStr}`;
  }

  // Make request with retry logic
  async request(method, url, options = {}) {
    const {
      params = {},
      data = {},
      useCache = true,
      retries = config.retries,
      timeout,
      headers,
    } = options;

    // Check rate limit
    await this.checkRateLimit();

    // Check cache first
    if (this.cache && useCache) {
      const cacheKey = this.getCacheKey(method, url, params);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug("Cache hit", { cacheKey });
        return cached;
      }
    }

    // Retry configuration
    const retryConfig = {
      numOfAttempts: retries + 1,
      startingDelay: 1000,
      maxDelay: 10000,
      timeMultiple: 2,
      retry: (error) => {
        if (error.response) {
          // Retry on rate limit (429) or server errors (5xx)
          return error.response.status === 429 || error.response.status >= 500;
        }
        // Retry on network errors
        return true;
      },
    };

    try {
      const response = await backOff(async () => {
        const result = await this.client.request({
          method,
          url,
          params,
          data,
          timeout: timeout || config.timeout, // Use provided timeout or default
          headers, // Pass custom headers (e.g. Authorization)
        });
        return result;
      }, retryConfig);

      // Cache successful response
      if (this.cache && useCache) {
        const cacheKey = this.getCacheKey(method, url, params);
        this.cache.set(cacheKey, response.data);
        logger.debug("Cached response", { cacheKey });
      }

      return response.data;
    } catch (error) {
      // Enhanced error handling for Presearch API
      const errorDetails = {
        method,
        url,
        params,
        error: error.message,
        attempts: retries + 1,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
      };

      // Specific handling for Presearch API authentication errors
      if (error.response?.status === 401) {
        logger.error("Presearch API authentication failed - invalid API key", errorDetails);
        throw new Error(`Presearch API authentication failed. Please check your PRESEARCH_API_KEY environment variable. Error: ${error.message}`);
      }

      if (error.response?.status === 403) {
        logger.error("Presearch API access forbidden - check API key permissions", errorDetails);
        throw new Error(`Presearch API access forbidden. Your API key may not have the required permissions. Error: ${error.message}`);
      }

      if (error.response?.status === 429) {
        logger.error("Presearch API rate limit exceeded", errorDetails);
        throw new Error(`Presearch API rate limit exceeded. Please reduce request frequency or upgrade your API plan. Error: ${error.message}`);
      }

      logger.error("API request failed after retries", errorDetails);
      throw new Error(`Presearch API request failed: ${error.message}`);
    }
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
   * Performs a health check on the Presearch API
   * @param {string} [apiKey] - Optional API key to use for the check
   * @returns {Promise<object>} Health status object
   */
  async healthCheck(apiKey) {
    const startTime = Date.now();
    try {
      const options = { useCache: false, retries: 1, timeout: 5000 };
      if (apiKey) {
        options.headers = { Authorization: `Bearer ${apiKey}` };
      }
      await this.get(
        "/v1/search",
        { q: "healthcheck", ip: "8.8.8.8" },
        options,
      );
      const latencyMs = Date.now() - startTime;

      return {
        reachable: true,
        authenticated: true,
        latencyMs,
        message: "API is reachable and responding.",
        rateLimit: {
          requestsInWindow: this.requestCount,
          windowReset: new Date(
            this.windowStart + config.rateLimit.windowMs,
          ).toISOString(),
          limit: config.rateLimit.maxRequests,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const isAuthError =
        error.response?.status === 401 || error.response?.status === 403;

      return {
        reachable: false,
        authenticated: !isAuthError,
        latencyMs,
        message: isAuthError
          ? "API authentication failed. Check your PRESEARCH_API_KEY."
          : `API is unreachable. ${error.message}`,
        rateLimit: {
          requestsInWindow: this.requestCount,
          windowReset: new Date(
            this.windowStart + config.rateLimit.windowMs,
          ).toISOString(),
          limit: config.rateLimit.maxRequests,
        },
      };
    }
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