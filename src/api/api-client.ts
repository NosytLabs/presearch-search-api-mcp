import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { PresearchServerConfig } from "../config/presearch-server-config.js";
import { logger } from "../utils/logger.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";

import {
  PresearchSearchRequest,
  PresearchResponse,
} from "../types/presearch-types.js";
import { cacheManager } from "../utils/cache-manager.js";

/**
 * Presearch API Client for making HTTP requests to the Presearch API
 */
export class PresearchApiClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private config: PresearchServerConfig;
  private static instance?: PresearchApiClient;
  private apiKey?: string; // Store API key separately for lazy loading

  constructor(config: PresearchServerConfig) {
    this.config = config;
    this.apiKey = config.getApiKey(); // May be undefined for lazy loading

    logger.info("Initializing Presearch API Client", {
      baseURL: config.getBaseURL(),
      hasApiKey: !!this.apiKey, // Log whether API key is available
      userAgent: config.getUserAgent(),
      timeout: config.getTimeout(),
    });

    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
    this.initializeRateLimiter();
    this.initializeCircuitBreaker();
  }

  /**
   * Update the API key and refresh the Authorization header
   * Used for lazy loading when the API key becomes available
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // Update the Authorization header in the existing axios instance
    this.axiosInstance.defaults.headers.common["Authorization"] =
      this.formatAuthHeader(apiKey);
    logger.info("API key updated for client");
  }

  /**
   * Create and configure the Axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.getBaseURL(),
      timeout: this.config.getTimeout(),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.config.getUserAgent(),
      },
    });

    // Only add Authorization header if API key is available
    if (this.apiKey) {
      instance.defaults.headers.common["Authorization"] = this.formatAuthHeader(
        this.apiKey,
      );
    }

    return instance;
  }

  /**
   * Format the authorization header
   */
  private formatAuthHeader(apiKey: string): string {
    return `Bearer ${apiKey}`;
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug("Making API request", {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error("Request interceptor error", { error: error.message });
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging and error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug("API response received", {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error("API response error", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data,
        });
        return Promise.reject(this.handleAxiosError(error));
      },
    );
  }

  /**
   * Initialize rate limiter if enabled
   */
  private initializeRateLimiter(): void {
    if (this.config.isRateLimitEnabled()) {
      this.rateLimiter = new RateLimiter(
        this.config.getRateLimitRequests(),
        this.config.getRateLimitWindow(),
      );
      logger.info("Rate limiter initialized", {
        requests: this.config.getRateLimitRequests(),
        window: this.config.getRateLimitWindow(),
      });
    }
  }

  /**
   * Initialize circuit breaker if enabled
   */
  private initializeCircuitBreaker() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5, // MCP-recommended failure threshold
    });
    this.circuitBreaker.on("stateChange", (state: string) => {
      logger.warn(`Breaker state: ${state}`);
    });
  }

  /**
   * Handle Axios errors and convert them to custom error types
   */
  private handleAxiosError(error: unknown): Error {
    const axiosError = error as any;
    if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
      return new Error("Request timeout");
    }

    if (axiosError.response) {
      // Server responded with error status
      const status = axiosError.response.status;
      const message =
        axiosError.response.data?.message ||
        axiosError.response.statusText ||
        "API Error";
      if (status === 429) {
        return new Error(message);
      }
      if (status >= 500 && status < 600) {
        return new Error(message);
      }
      if (status >= 400 && status < 500) {
        return new Error(message);
      }
      return new Error(message);
    }

    if (axiosError.request) {
      // Network error
      return new Error("Network error - no response received", axiosError);
    }

    // Other errors
    return new Error(axiosError.message || "Unknown error");
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config: PresearchServerConfig): PresearchApiClient {
    if (!this.instance) {
      this.instance = new PresearchApiClient(config);
    }
    return this.instance;
  }

  /**
   * Execute a request with rate limiting and circuit breaker logic
   */
  private async executeRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
  ): Promise<T> {
    // 1. Rate limit check
    if (this.rateLimiter && !this.rateLimiter.checkLimit()) {
      throw new Error("Rate limit exceeded: Too many requests");
    }

    // 2. Circuit breaker execution
    return this.circuitBreaker!.execute(async () => {
      try {
        const response = await requestFn();
        // Circuit breaker handles success automatically
        return response.data;
      } catch (error) {
        const apiError = this.handleAxiosError(error);
        // Circuit breaker handles failure automatically
        throw apiError; // Re-throw the handled error
      }
    });
  }

  /**
   * Perform a Presearch search
   */
  async search(params: PresearchSearchRequest): Promise<PresearchResponse> {
    if (!this.apiKey) {
      throw new Error("API key is not configured");
    }

    const cacheKey = `search:${JSON.stringify(params)}`;
    const cached = await cacheManager.get<PresearchResponse>(cacheKey);
    if (cached) {
      logger.debug("Cache hit for search", { cacheKey });
      return cached;
    }

    const requestConfig: AxiosRequestConfig = {
      method: "GET",
      url: "/v1/search",
      params,
    };

    const response = await this.executeRequest(() =>
      this.axiosInstance.request(requestConfig),
    );

    if (this.config.isCacheEnabled()) {
      await cacheManager.set(cacheKey, response, this.config.getCacheTTL());
    }

    return response;
  }

  /**
   * Scrape content from a URL
   */
  async scrape(url: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error("API key is not configured");
    }

    const requestConfig: AxiosRequestConfig = {
      method: "GET",
      url: "/scrape",
      params: { url },
    };

    return this.executeRequest(() => this.axiosInstance.request(requestConfig));
  }

  /**
   * Get the current status of the Presearch API
   */
  async getStatus(): Promise<any> {
    // This endpoint might not require an API key
    const requestConfig: AxiosRequestConfig = {
      method: "GET",
      url: "/status",
    };

    return this.executeRequest(() => this.axiosInstance.request(requestConfig));
  }

  /**
   * Get the underlying Axios instance for direct access if needed
   */
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Get health status of the API client
   */
  getHealthStatus() {
    return {
      rateLimiter: this.rateLimiter
        ? {
            isEnabled: true,
            requests: this.config.getRateLimitRequests(),
            window: this.config.getRateLimitWindow(),
          }
        : { isEnabled: false },
      circuitBreaker: {
        isEnabled: this.config.isCircuitBreakerEnabled(),
        state: this.circuitBreaker?.getState() || "unknown",
      },
      apiKey: {
        configured: !!this.apiKey,
        validated: this.config.hasApiKey(),
      },
    };
  }

  /**
   * Reset the API client state
   */
  resetState(): void {
    this.circuitBreaker?.forceReset();
    this.rateLimiter?.reset();
    // Reset any other stateful components if needed
  }
}
