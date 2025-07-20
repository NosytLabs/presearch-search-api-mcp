import { Configuration, createConfigFromEnv } from '../src/config/configuration';

describe('Configuration', () => {
  let config: Configuration;
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    process.env.PRESEARCH_API_KEY = 'test-api-key';
    process.env.PRESEARCH_BASE_URL = 'https://api.presearch.io';
    process.env.PRESEARCH_TIMEOUT = '5000';
    config = createConfigFromEnv();
    mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    delete process.env.PRESEARCH_API_KEY;
    delete process.env.PRESEARCH_BASE_URL;
    delete process.env.PRESEARCH_TIMEOUT;
    mockFetch.mockRestore();
  });

  test('should initialize with environment variables', () => {
    expect(config.getBaseURL()).toBe('https://api.presearch.io');
    expect(config.getTimeout()).toBe(5000);
  });

  test('should get API key', async () => {
    const apiKey = await config.getApiKey();
    expect(apiKey).toBe('test-api-key');
  });

  test('should validate API key', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    await expect(config.validateApiKey()).resolves.not.toThrow();
  });

  test('should throw error for invalid API key', async () => {
    process.env.PRESEARCH_API_KEY = 'invalid-key';
    config = createConfigFromEnv();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await expect(config.validateApiKey()).rejects.toThrow('API key validation failed: 401');
  });
});