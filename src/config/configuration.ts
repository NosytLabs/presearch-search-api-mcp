import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { logger } from '../utils/logger.js';

// Load environment variables from .env file
dotenvConfig();

/**
 * Configuration schema for the Presearch MCP Server
 * Note: apiKey is optional to support Smithery's lazy loading pattern
 */
export const ConfigSchema = z.object({
  baseURL: z.string().url().default('https://na-us-1.presearch.com'),
  apiKey: z.string().optional(), // Made optional for lazy loading
  userAgent: z.string().default('Presearch-MCP-Server/3.0.0'),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().min(0).default(3),
  retryDelay: z.number().positive().default(1000),
  cacheEnabled: z.boolean().default(true),
  cacheTTL: z.number().positive().default(300000), // 5 minutes
  rateLimitEnabled: z.boolean().default(true),
  rateLimitRequests: z.number().positive().default(100),
  rateLimitWindow: z.number().positive().default(60000), // 1 minute
  circuitBreakerEnabled: z.boolean().default(true),
  circuitBreakerThreshold: z.number().positive().default(5),
  circuitBreakerTimeout: z.number().positive().default(60000), // 1 minute
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration manager for the Presearch MCP Server
 */
export class Configuration {
  private config: Config;

  constructor(config: Partial<Config> = {}) {
    // Parse and validate configuration with defaults
    const result = ConfigSchema.safeParse(config);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Configuration validation failed: ${errors}`);
    }

    this.config = result.data;
    // Note: Logger not used here to avoid circular dependency
  }

  /**
   * Get the base URL for the Presearch API
   */
  getBaseURL(): string {
    return this.config.baseURL;
  }

  /**
   * Get the API key (may be undefined for lazy loading)
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Get the API key and throw if not present (for tool execution)
   */
  getRequiredApiKey(): string {
    if (!this.config.apiKey) {
      throw new Error('API key is required for tool execution. Please configure PRESEARCH_API_KEY environment variable.');
    }
    return this.config.apiKey;
  }

  /**
   * Get the user agent string
   */
  getUserAgent(): string {
    return this.config.userAgent;
  }

  /**
   * Get the request timeout in milliseconds
   */
  getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get the maximum number of retries
   */
  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  /**
   * Get the retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.config.retryDelay;
  }

  /**
   * Check if caching is enabled
   */
  isCacheEnabled(): boolean {
    return this.config.cacheEnabled;
  }

  /**
   * Get the cache TTL in milliseconds
   */
  getCacheTTL(): number {
    return this.config.cacheTTL;
  }

  /**
   * Check if rate limiting is enabled
   */
  isRateLimitEnabled(): boolean {
    return this.config.rateLimitEnabled;
  }

  /**
   * Get the rate limit requests per window
   */
  getRateLimitRequests(): number {
    return this.config.rateLimitRequests;
  }

  /**
   * Get the rate limit window in milliseconds
   */
  getRateLimitWindow(): number {
    return this.config.rateLimitWindow;
  }

  /**
   * Check if circuit breaker is enabled
   */
  isCircuitBreakerEnabled(): boolean {
    return this.config.circuitBreakerEnabled;
  }

  /**
   * Get the circuit breaker failure threshold
   */
  getCircuitBreakerThreshold(): number {
    return this.config.circuitBreakerThreshold;
  }

  /**
   * Get the circuit breaker timeout in milliseconds
   */
  getCircuitBreakerTimeout(): number {
    return this.config.circuitBreakerTimeout;
  }

  /**
   * Get the log level
   */
  getLogLevel(): string {
    return this.config.logLevel;
  }

  /**
   * Validate the API key format and accessibility
   * For lazy loading, this doesn't throw if API key is undefined
   */
  validateApiKey(): { isValid: boolean; message?: string } {
    const apiKey = this.config.apiKey;
    
    // For lazy loading, undefined API key is acceptable during initialization
    if (!apiKey) {
      return {
        isValid: false,
        message: 'API key is required for tool execution'
      };
    }

    // Basic format validation
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return {
        isValid: false,
        message: 'API key must be a non-empty string'
      };
    }

    // Check for common invalid patterns
    if (apiKey.includes('your-api-key') || apiKey.includes('placeholder')) {
      return {
        isValid: false,
        message: 'API key appears to be a placeholder value'
      };
    }

    // Check for expired OAuth tokens (basic pattern)
    if (apiKey.startsWith('oauth_') && apiKey.includes('expired')) {
      return {
        isValid: false,
        message: 'OAuth token appears to be expired'
      };
    }

    return { isValid: true };
  }

  /**
   * Get the full configuration object (for debugging)
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Update configuration with new values
   */
  update(updates: Partial<Config>): void {
    const newConfig = { ...this.config, ...updates };
    const result = ConfigSchema.safeParse(newConfig);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Configuration update failed: ${errors}`);
    }

    this.config = result.data;
    logger.info('Configuration updated', { 
      baseURL: this.config.baseURL,
      hasApiKey: !!this.config.apiKey,
      userAgent: this.config.userAgent
    });
  }
}

/**
 * Create configuration from environment variables
 */
export function createConfigFromEnv(overrides: Partial<Config> = {}): Configuration {
  const envConfig: Partial<Config> = {
    baseURL: process.env.PRESEARCH_BASE_URL,
    apiKey: process.env.PRESEARCH_API_KEY,
    userAgent: process.env.PRESEARCH_USER_AGENT,
    timeout: process.env.PRESEARCH_TIMEOUT ? parseInt(process.env.PRESEARCH_TIMEOUT, 10) : undefined,
    maxRetries: process.env.PRESEARCH_MAX_RETRIES ? parseInt(process.env.PRESEARCH_MAX_RETRIES, 10) : undefined,
    retryDelay: process.env.PRESEARCH_RETRY_DELAY ? parseInt(process.env.PRESEARCH_RETRY_DELAY, 10) : undefined,
    cacheEnabled: process.env.PRESEARCH_CACHE_ENABLED ? process.env.PRESEARCH_CACHE_ENABLED === 'true' : undefined,
    cacheTTL: process.env.PRESEARCH_CACHE_TTL ? parseInt(process.env.PRESEARCH_CACHE_TTL, 10) : undefined,
    rateLimitEnabled: process.env.PRESEARCH_RATE_LIMIT_ENABLED ? process.env.PRESEARCH_RATE_LIMIT_ENABLED === 'true' : undefined,
    rateLimitRequests: process.env.PRESEARCH_RATE_LIMIT_REQUESTS ? parseInt(process.env.PRESEARCH_RATE_LIMIT_REQUESTS, 10) : undefined,
    rateLimitWindow: process.env.PRESEARCH_RATE_LIMIT_WINDOW ? parseInt(process.env.PRESEARCH_RATE_LIMIT_WINDOW, 10) : undefined,
    circuitBreakerEnabled: process.env.PRESEARCH_CIRCUIT_BREAKER_ENABLED ? process.env.PRESEARCH_CIRCUIT_BREAKER_ENABLED === 'true' : undefined,
    circuitBreakerThreshold: process.env.PRESEARCH_CIRCUIT_BREAKER_THRESHOLD ? parseInt(process.env.PRESEARCH_CIRCUIT_BREAKER_THRESHOLD, 10) : undefined,
    circuitBreakerTimeout: process.env.PRESEARCH_CIRCUIT_BREAKER_TIMEOUT ? parseInt(process.env.PRESEARCH_CIRCUIT_BREAKER_TIMEOUT, 10) : undefined,
    logLevel: process.env.PRESEARCH_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | undefined,
  };

  // Filter out undefined values from envConfig so they don't overwrite defaults or overrides
  const cleanEnvConfig = Object.fromEntries(Object.entries(envConfig).filter(([, v]) => v !== undefined));

  // Merge overrides on top of env config. Overrides take precedence.
  const finalConfig = { ...cleanEnvConfig, ...overrides };

  return new Configuration(finalConfig);
}

// Export default configuration instance
export const config = createConfigFromEnv();