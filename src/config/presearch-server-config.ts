import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenvConfig();

import { LogLevel } from '../utils/logger.js';

// Enhanced configuration schema with security best practices
const configSchema = z.object({
  baseURL: z.string().url().default('https://na-us-1.presearch.com'),
  apiKey: z.string().optional(), // Lazy loading for security
  userAgent: z.string().default('PresearchMCP/1.0'),
  timeout: z.number().min(1000).max(60000).default(30000),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().min(0).default(300000),
    maxSize: z.number().min(1).default(1000),
  }).default({}),
  rateLimit: z.object({
    requests: z.number().min(1).default(60),
    window: z.number().min(1000).default(60000),
  }).default({}),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    failureThreshold: z.number().min(1).default(5),
    resetTimeout: z.number().min(1000).default(30000),
  }).default({}),
  retry: z.object({
    maxRetries: z.number().min(0).default(3),
    baseDelay: z.number().min(100).default(1000),
  }).default({}),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ConfigType = z.infer<typeof configSchema>;

function parseIntWithDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export class PresearchServerConfig {
  private config: ConfigType;
  private apiKeyValidated = false;
  private apiKeyLastCheck = 0;
    private static CHECK_INTERVAL = 3600000; // 1 hour

  constructor(initialConfig: Partial<ConfigType> = {}) {
    this.config = configSchema.parse({ ...initialConfig });
  }

  getBaseURL(): string {
    return this.config.baseURL;
  }

  getRateLimitRequests(): number {
    return this.config.rateLimit.requests;
  }

  getRateLimitWindow(): number {
    return this.config.rateLimit.window;
  }

  getCacheTTL(): number {
    return this.config.cache.ttl;
  }

  getCacheMaxSize(): number {
    return this.config.cache.maxSize;
  }

  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.config.apiKey;
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const now = Date.now();
      if (this.apiKeyValidated && now - this.apiKeyLastCheck < PresearchServerConfig.CHECK_INTERVAL) {
        return true;
      }

      // Perform a test request to validate key
      const response = await fetch(`${this.config.baseURL}/v1/search?limit=1&q=test`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': this.config.userAgent,
        },
        method: 'GET',
      });

      if (!response.ok) {
        this.apiKeyValidated = false;
        console.warn('API key validation failed', { status: response.status });
        throw new Error(`API key validation failed: ${response.status}`);
      }

      this.apiKeyValidated = true;
      this.apiKeyLastCheck = Date.now();
      console.log('API key validated successfully');
      return true;
    } catch (error) {
      this.apiKeyValidated = false;
      // Re-throw API validation errors, but handle network errors gracefully
      if (error instanceof Error && error.message.includes('API key validation failed:')) {
        throw error;
      }
      console.warn('API key validation failed:', error);
      return false;
    }
  }

  public setApiKeyValidated(isValid: boolean): void {
    this.apiKeyValidated = isValid;
  }

  public setApiKeyLastCheck(timestamp: number): void {
    this.apiKeyLastCheck = timestamp;
  }

  getUserAgent(): string {
    return this.config.userAgent;
  }

  isCacheEnabled(): boolean {
    return this.config.cache.enabled;
  }

  isRateLimitEnabled(): boolean {
    return this.config.rateLimit.requests > 0;
  }

  isCircuitBreakerEnabled(): boolean {
    return this.config.circuitBreaker.enabled;
  }

  getCircuitBreakerConfig() {
    return this.config.circuitBreaker;
  }

  updateConfig(newConfig: Partial<ConfigType>): void {
    // Deep merge nested configuration objects to prevent overwrites
    const mergedConfig = {
      ...this.config,
      ...newConfig,
      cache: {
        ...this.config.cache,
        ...(newConfig.cache ?? {}),
      },
      rateLimit: {
        ...this.config.rateLimit,
        ...(newConfig.rateLimit ?? {}),
      },
      circuitBreaker: {
        ...this.config.circuitBreaker,
        ...(newConfig.circuitBreaker ?? {}),
      },
      retry: {
        ...this.config.retry,
        ...(newConfig.retry ?? {}),
      },
    };

    this.config = configSchema.parse(mergedConfig);
    console.log('Configuration updated');
  }

  getConfig(): ConfigType {
    return { ...this.config };
  }

  public getLogLevel(): LogLevel {
    switch (this.config.logLevel) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  public getTimeout(): number {
    return this.config.timeout;
  }

  public getMaxRetries(): number {
    return this.config.retry.maxRetries;
  }

  public getRetryDelay(): number {
    return this.config.retry.baseDelay;
  }
}



export function createConfigFromEnv(overrides: Partial<ConfigType> = {}): PresearchServerConfig {
  const envConfig: Partial<ConfigType> = {
    baseURL: process.env.PRESEARCH_BASE_URL,
    apiKey: process.env.PRESEARCH_API_KEY,
    userAgent: process.env.PRESEARCH_USER_AGENT,
    timeout: parseIntWithDefault(process.env.PRESEARCH_TIMEOUT, 30000),
    logLevel: process.env.LOG_LEVEL as ConfigType['logLevel'],
    cache: {
      enabled: process.env.CACHE_ENABLED === 'true',
      ttl: parseIntWithDefault(process.env.CACHE_TTL, 300000),
      maxSize: parseIntWithDefault(process.env.CACHE_MAX_SIZE, 1000),
    },
    rateLimit: {
      requests: parseIntWithDefault(process.env.RATE_LIMIT_REQUESTS, 60),
      window: parseIntWithDefault(process.env.RATE_LIMIT_WINDOW, 60000),
    },
    circuitBreaker: {
      enabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
      failureThreshold: parseIntWithDefault(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 5),
      resetTimeout: parseIntWithDefault(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 30000),
    },
    retry: {
      maxRetries: parseIntWithDefault(process.env.MAX_RETRIES, 3),
      baseDelay: parseIntWithDefault(process.env.RETRY_DELAY, 1000),
    },
  };

  return new PresearchServerConfig({ ...envConfig, ...overrides });
}

export const config = createConfigFromEnv();
