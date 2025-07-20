/**
 * Tests for Configuration module
 */

import { Configuration, createConfigFromEnv } from '../../src/config/configuration.js';

describe('Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should create configuration with default values', () => {
      const config = new Configuration();
      
      expect(config.getBaseURL()).toBe('https://api.presearch.io');
      expect(config.isCacheEnabled()).toBe(true);
      expect(config.getCacheTTL()).toBe(300000);
      expect(config.getCacheMaxSize()).toBe(1000);
      expect(config.getRateLimitRequests()).toBe(60);
      expect(config.getRateLimitWindow()).toBe(60000);
      expect(config.isCircuitBreakerEnabled()).toBe(true);
      expect(config.getLogLevel()).toBe('info');
      expect(config.getTimeout()).toBe(30000);
      expect(config.getMaxRetries()).toBe(3);
      expect(config.getRetryDelay()).toBe(1000);
    });

    it('should create configuration with custom values', () => {
      const customConfig = {
        baseURL: 'https://custom.api.com',
        apiKey: 'custom-api-key',
        userAgent: 'CustomAgent/1.0',
        timeout: 15000,
        cache: {
          enabled: false,
          ttl: 600000,
          maxSize: 500,
        },
        rateLimit: {
          requests: 30,
          window: 30000,
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 10,
          resetTimeout: 60000,
        },
        retry: {
          maxRetries: 5,
          baseDelay: 2000,
        },
        logLevel: 'debug' as const,
      };

      const config = new Configuration(customConfig);
      
      expect(config.getBaseURL()).toBe('https://custom.api.com');
      expect(config.getApiKey()).toBe('custom-api-key');
      expect(config.getUserAgent()).toBe('CustomAgent/1.0');
      expect(config.getTimeout()).toBe(15000);
      expect(config.isCacheEnabled()).toBe(false);
      expect(config.getCacheTTL()).toBe(600000);
      expect(config.getCacheMaxSize()).toBe(500);
      expect(config.getRateLimitRequests()).toBe(30);
      expect(config.getRateLimitWindow()).toBe(30000);
      expect(config.isCircuitBreakerEnabled()).toBe(false);
      expect(config.getLogLevel()).toBe('debug');
      expect(config.getMaxRetries()).toBe(5);
      expect(config.getRetryDelay()).toBe(2000);
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        new Configuration({
          baseURL: 'invalid-url',
        });
      }).toThrow();

      expect(() => {
        new Configuration({
          timeout: -1000,
        });
      }).toThrow();

      expect(() => {
        new Configuration({
          cache: {
            enabled: true,
            ttl: -1,
            maxSize: 0,
          },
        });
      }).toThrow();
    });
  });

  describe('API Key Management', () => {
    it('should handle API key presence correctly', () => {
      const configWithKey = new Configuration({
        apiKey: 'test-api-key',
      });
      
      expect(configWithKey.hasApiKey()).toBe(true);
      expect(configWithKey.getApiKey()).toBe('test-api-key');

      const configWithoutKey = new Configuration();
      expect(configWithoutKey.hasApiKey()).toBe(false);
      expect(configWithoutKey.getApiKey()).toBeUndefined();
    });

    it('should validate API key format', async () => {
      const config = new Configuration({
        apiKey: 'test-api-key',
        baseURL: 'https://api.presearch.io',
      });

      // Mock fetch for API key validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const isValid = await config.validateApiKey();
      expect(isValid).toBe(true);

      // Test invalid API key
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(config.validateApiKey()).rejects.toThrow('API key validation failed: 401');
    });

    it('should handle network errors during API key validation', async () => {
      const config = new Configuration({
        apiKey: 'test-api-key',
        baseURL: 'https://api.presearch.io',
      });

      // Mock network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const isValid = await config.validateApiKey();
      expect(isValid).toBe(false);
    });

    it('should cache API key validation results', async () => {
      const config = new Configuration({
        apiKey: 'test-api-key',
        baseURL: 'https://api.presearch.io',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      // First validation
      await config.validateApiKey();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second validation should use cache
      await config.validateApiKey();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const config = new Configuration({
        timeout: 5000,
        logLevel: 'info',
      });

      expect(config.getTimeout()).toBe(5000);
      expect(config.getLogLevel()).toBe('info');

      config.updateConfig({
        timeout: 10000,
        logLevel: 'debug',
      });

      expect(config.getTimeout()).toBe(10000);
      expect(config.getLogLevel()).toBe('debug');
    });

    it('should validate updated configuration', () => {
      const config = new Configuration();

      expect(() => {
        config.updateConfig({
          timeout: -1000,
        });
      }).toThrow();

      expect(() => {
        config.updateConfig({
          baseURL: 'invalid-url',
        });
      }).toThrow();
    });

    it('should return immutable configuration copy', () => {
      const config = new Configuration({
        timeout: 5000,
      });

      const configCopy = config.getConfig();
      configCopy.timeout = 10000;

      expect(config.getTimeout()).toBe(5000);
    });
  });

  describe('Feature Flags', () => {
    it('should check cache enablement correctly', () => {
      const configWithCache = new Configuration({
        cache: { enabled: true, ttl: 300000, maxSize: 1000 },
      });
      expect(configWithCache.isCacheEnabled()).toBe(true);

      const configWithoutCache = new Configuration({
        cache: { enabled: false, ttl: 300000, maxSize: 1000 },
      });
      expect(configWithoutCache.isCacheEnabled()).toBe(false);
    });

    it('should check rate limiting enablement correctly', () => {
      const configWithRateLimit = new Configuration({
        rateLimit: { requests: 60, window: 60000 },
      });
      expect(configWithRateLimit.isRateLimitEnabled()).toBe(true);

      // Rate limiting is considered disabled when requests is 1 (minimum allowed)
      // but in practice, 1 request per window effectively disables it
      const configWithMinimalRateLimit = new Configuration({
        rateLimit: { requests: 1, window: 60000 },
      });
      expect(configWithMinimalRateLimit.isRateLimitEnabled()).toBe(true);
    });

    it('should check circuit breaker enablement correctly', () => {
      const configWithCircuitBreaker = new Configuration({
        circuitBreaker: { enabled: true, failureThreshold: 5, resetTimeout: 30000 },
      });
      expect(configWithCircuitBreaker.isCircuitBreakerEnabled()).toBe(true);

      const configWithoutCircuitBreaker = new Configuration({
        circuitBreaker: { enabled: false, failureThreshold: 5, resetTimeout: 30000 },
      });
      expect(configWithoutCircuitBreaker.isCircuitBreakerEnabled()).toBe(false);
    });

    it('should return circuit breaker configuration', () => {
      const config = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 10,
          resetTimeout: 60000,
        },
      });

      const cbConfig = config.getCircuitBreakerConfig();
      expect(cbConfig.enabled).toBe(true);
      expect(cbConfig.failureThreshold).toBe(10);
      expect(cbConfig.resetTimeout).toBe(60000);
    });
  });
});

describe('createConfigFromEnv', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear environment variables
    delete process.env.PRESEARCH_API_KEY;
    delete process.env.PRESEARCH_BASE_URL;
    delete process.env.PRESEARCH_USER_AGENT;
    delete process.env.PRESEARCH_TIMEOUT;
    delete process.env.LOG_LEVEL;
    delete process.env.CACHE_ENABLED;
    delete process.env.CACHE_TTL;
    delete process.env.CACHE_MAX_SIZE;
    delete process.env.RATE_LIMIT_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW;
    delete process.env.CIRCUIT_BREAKER_ENABLED;
    delete process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    delete process.env.CIRCUIT_BREAKER_RESET_TIMEOUT;
    delete process.env.MAX_RETRIES;
    delete process.env.RETRY_DELAY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create configuration from environment variables', () => {
    process.env.PRESEARCH_API_KEY = 'env-api-key';
    process.env.PRESEARCH_BASE_URL = 'https://env.api.com';
    process.env.PRESEARCH_USER_AGENT = 'EnvAgent/1.0';
    process.env.PRESEARCH_TIMEOUT = '15000';
    process.env.LOG_LEVEL = 'debug';
    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_TTL = '600000';
    process.env.CACHE_MAX_SIZE = '500';
    process.env.RATE_LIMIT_REQUESTS = '30';
    process.env.RATE_LIMIT_WINDOW = '30000';
    process.env.CIRCUIT_BREAKER_ENABLED = 'true';
    process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '10';
    process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '60000';
    process.env.MAX_RETRIES = '5';
    process.env.RETRY_DELAY = '2000';

    const config = createConfigFromEnv();

    expect(config.getApiKey()).toBe('env-api-key');
    expect(config.getBaseURL()).toBe('https://env.api.com');
    expect(config.getUserAgent()).toBe('EnvAgent/1.0');
    expect(config.getTimeout()).toBe(15000);
    expect(config.getLogLevel()).toBe('debug');
    expect(config.isCacheEnabled()).toBe(true);
    expect(config.getCacheTTL()).toBe(600000);
    expect(config.getCacheMaxSize()).toBe(500);
    expect(config.getRateLimitRequests()).toBe(30);
    expect(config.getRateLimitWindow()).toBe(30000);
    expect(config.isCircuitBreakerEnabled()).toBe(true);
    expect(config.getMaxRetries()).toBe(5);
    expect(config.getRetryDelay()).toBe(2000);
  });

  it('should use default values when environment variables are not set', () => {
    const config = createConfigFromEnv();

    expect(config.getBaseURL()).toBe('https://api.presearch.io');
    expect(config.getTimeout()).toBe(30000);
    expect(config.getLogLevel()).toBe('info');
    expect(config.getCacheTTL()).toBe(300000);
    expect(config.getCacheMaxSize()).toBe(1000);
    expect(config.getRateLimitRequests()).toBe(60);
    expect(config.getRateLimitWindow()).toBe(60000);
    expect(config.getMaxRetries()).toBe(3);
    expect(config.getRetryDelay()).toBe(1000);
  });

  it('should apply overrides over environment variables', () => {
    process.env.PRESEARCH_TIMEOUT = '15000';
    process.env.LOG_LEVEL = 'debug';

    const config = createConfigFromEnv({
      timeout: 20000,
      logLevel: 'error',
    });

    expect(config.getTimeout()).toBe(20000);
    expect(config.getLogLevel()).toBe('error');
  });

  it('should handle invalid environment variable values', () => {
    process.env.PRESEARCH_TIMEOUT = 'invalid-number';
    process.env.CACHE_TTL = 'not-a-number';

    const config = createConfigFromEnv();

    // Should fall back to defaults for invalid values
    expect(config.getTimeout()).toBe(30000);
    expect(config.getCacheTTL()).toBe(300000);
  });
});