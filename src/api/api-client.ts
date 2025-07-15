import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Configuration } from '../config/configuration.js';
import { logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { APIError, NetworkError, TimeoutError, RateLimitError, ServerError, ClientError } from '../utils/error-handler.js';
import { PresearchSearchRequest, PresearchResponse } from '../types/presearch-types.js';

/**
 * Presearch API Client for making HTTP requests to the Presearch API
 */
export class PresearchAPIClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private config: Configuration;
  private static instance?: PresearchAPIClient;
  private apiKey?: string; // Store API key separately for lazy loading

  constructor(config: Configuration) {
    this.config = config;
    this.apiKey = config.getApiKey(); // May be undefined for lazy loading
    
    logger.info('Initializing Presearch API Client', {
      baseURL: config.getBaseURL(),
      hasApiKey: !!this.apiKey, // Log whether API key is available
      userAgent: config.getUserAgent(),
      timeout: config.getTimeout()
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
    this.axiosInstance.defaults.headers.common['Authorization'] = this.formatAuthHeader(apiKey);
    logger.info('API key updated for client');
  }

  /**
   * Create and configure the Axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.getBaseURL(),
      timeout: this.config.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.config.getUserAgent(),
      },
    });

    // Only add Authorization header if API key is available
    if (this.apiKey) {
      instance.defaults.headers.common['Authorization'] = this.formatAuthHeader(this.apiKey);
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
        logger.debug('Making API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('API response received', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('API response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        });
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  /**
   * Initialize rate limiter if enabled
   */
  private initializeRateLimiter(): void {
    if (this.config.isRateLimitEnabled()) {
      this.rateLimiter = new RateLimiter(
        this.config.getRateLimitRequests(),
        this.config.getRateLimitWindow()
      );
      logger.info('Rate limiter initialized', {
        requests: this.config.getRateLimitRequests(),
        window: this.config.getRateLimitWindow()
      });
    }
  }

  /**
   * Initialize circuit breaker if enabled
   */
  private initializeCircuitBreaker(): void {
    if (this.config.isCircuitBreakerEnabled()) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.getCircuitBreakerThreshold(),
        recoveryTimeout: this.config.getCircuitBreakerTimeout()
      });
      logger.info('Circuit breaker initialized', {
        threshold: this.config.getCircuitBreakerThreshold(),
        timeout: this.config.getCircuitBreakerTimeout()
      });
    }
  }

  /**
   * Handle Axios errors and convert them to custom error types
   */
  private handleAxiosError(error: unknown): Error {
    const axiosError = error as any;
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new TimeoutError('Request timeout', axiosError);
    }

    if (axiosError.response) {
      // Server responded with error status
      const status = axiosError.response.status;
      const message = axiosError.response.data?.message || axiosError.response.statusText || 'API Error';
      if (status === 429) {
        return new RateLimitError(message, status, axiosError.response.data);
      }
      if (status >= 500 && status < 600) {
        return new ServerError(message, status, axiosError.response.data);
      }
      if (status >= 400 && status < 500) {
        return new ClientError(message, status, axiosError.response.data);
      }
      return new APIError(message, status, axiosError.response.data);
    }

    if (axiosError.request) {
      // Network error
      return new NetworkError('Network error - no response received', axiosError);
    }

    // Other errors
    return new Error(axiosError.message || 'Unknown error');
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Configuration): PresearchAPIClient {
    if (!PresearchAPIClient.instance && config) {
      PresearchAPIClient.instance = new PresearchAPIClient(config);
    }
    
    if (!PresearchAPIClient.instance) {
      throw new Error('PresearchAPIClient not initialized. Provide configuration on first call.');
    }
    
    return PresearchAPIClient.instance;
  }

  /**
   * Perform a search request
   */
  async search(request: PresearchSearchRequest): Promise<PresearchResponse> {
    if (!request.query) {
      throw new Error('Query cannot be empty');
    }
    logger.info('Performing search', { query: request.query });

    try {
      // Check rate limiter
      if (this.rateLimiter && !this.rateLimiter.checkLimit()) {
        throw new APIError('Rate limit exceeded', 429);
      }

      // Check circuit breaker
      if (this.circuitBreaker && this.circuitBreaker.isOpen()) {
        throw new APIError('Circuit breaker is open', 503);
      }

      // Convert request to query parameters for GET request
      const params: Record<string, string> = {
      q: request.query,
    };
      
      // Add optional parameters if they exist (only valid API parameters)
      if (request.page) params.page = String(request.page);
      // Note: 'limit' is not a valid parameter for Presearch API, removed
      if (request.lang) params.lang = request.lang;
      if (request.time) params.time = request.time;
      if (request.location) params.location = request.location;
      if (request.safe) params.safe = request.safe;
      if (request.ip) params.ip = request.ip;

      // Add default location if neither ip nor location is provided
      if (!params.ip && !params.location) {
        params.location = '{"lat": 37.7749, "long": -122.4194}'; // Default to San Francisco
      }

      const response = await this.makeRequest<PresearchResponse>('/v1/search', {
        method: 'GET',
        params: params
      });

      // Record success for circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }

      logger.info('Search completed successfully', {
        query: request.query,
        resultsCount: response.data.results?.length || 0
      });

      return response.data;
    } catch (error) {
      // Record failure for circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure();
      }

      logger.error('Search failed', {
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Make a generic API request with retry logic
   */
  async makeRequest<T>(
    endpoint: string,
    config: AxiosRequestConfig = {},
    retryCount = 0
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await this.axiosInstance.request<T>({
        url: endpoint,
        ...config
      });

      return response;
    } catch (error) {
      const maxRetries = this.config.getMaxRetries();
      
      if (retryCount < maxRetries && this.shouldRetry(error)) {
        const delay = this.config.getRetryDelay() * Math.pow(2, retryCount); // Exponential backoff
        
        logger.warn('Request failed, retrying', {
          endpoint,
          retryCount: retryCount + 1,
          maxRetries,
          delay,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await this.delay(delay);
        return this.makeRequest<T>(endpoint, config, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: unknown): boolean {
    // Don't retry on authentication errors or client errors (4xx)
    if (error instanceof APIError && error.status && error.status >= 400 && error.status < 500) {
      return false;
    }

    // Retry on network errors, timeouts, and server errors (5xx)
    return error instanceof NetworkError || 
           error instanceof TimeoutError || 
           (error instanceof APIError && error.status !== undefined && error.status >= 500 && error.status < 600);
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get client health status
   */
  getHealthStatus(): {
    rateLimiter?: { remaining: number; resetTime: number };
    circuitBreaker?: { state: string; failures: number };
  } {
    const status: Record<string, unknown> = {};

    if (this.rateLimiter) {
      status.rateLimiter = {
        remaining: this.rateLimiter.getRemainingRequests(),
        resetTime: this.rateLimiter.getResetTime()
      };
    }

    if (this.circuitBreaker) {
      status.circuitBreaker = {
        state: this.circuitBreaker.getState(),
        failures: this.circuitBreaker.getFailureCount()
      };
    }

    return status;
  }

  /**
   * Reset client state (useful for testing)
   */
  reset(): void {
    if (this.rateLimiter) {
      this.rateLimiter.reset();
    }
    if (this.circuitBreaker) {
      this.circuitBreaker.forceReset();
    }
    logger.info('API client state reset');
  }
}
