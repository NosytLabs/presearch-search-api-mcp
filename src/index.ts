import { z } from 'zod';
import { createMcpServer } from './mcp-server.js';
import { loadConfig } from './core/config.js';

// Configuration schema for Smithery
export const configSchema = z.object({
  PRESEARCH_API_KEY: z.string().describe("Your Presearch API Key for authentication. Get one at https://presearch.com/"),
  PRESEARCH_TIMEOUT: z.number().default(10000).describe("Maximum time in milliseconds to wait for API requests."),
  SEARCH_MAX_RESULTS: z.number().default(50).describe("Maximum number of search results to return per query."),
  PRESEARCH_SAFE_SEARCH: z.enum(["off", "moderate", "strict"]).default("moderate").describe("Filter adult content from search results."),
  PRESEARCH_DEFAULT_LANGUAGE: z.string().default("en-US").describe("Default language code for searches (e.g., en-US)."),
  CACHE_ENABLED: z.boolean().default(true).describe("Enable in-memory caching of search results to improve performance."),
  CACHE_TTL: z.number().default(300).describe("Time-To-Live for cached entries in seconds."),
  CACHE_MAX_KEYS: z.number().default(1000).describe("Maximum number of entries to store in the cache."),
  PRESEARCH_RETRIES: z.number().default(3).describe("Number of retry attempts for failed API requests."),
  CONNECTION_POOL_MAX_SOCKETS: z.number().default(10).describe("Maximum number of concurrent connections in the HTTP connection pool."),
  CONNECTION_POOL_KEEP_ALIVE: z.boolean().default(true).describe("Enable persistent connections for better performance."),
  SCRAPE_MAX_RETRIES: z.number().default(3).describe("Maximum retry attempts for web scraping failures."),
  RATE_LIMIT_MAX_REQUESTS: z.number().default(100).describe("Maximum number of requests allowed per window."),
  RATE_LIMIT_WINDOW_MS: z.number().default(60000).describe("Time window for rate limiting in milliseconds."),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info").describe("Verbosity of logging output."),
  LOG_PRETTY: z.boolean().default(false).describe("Format logs for human readability (not recommended for production).")
});

// Default export function required by Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  // Convert Smithery config to our internal config format
  const internalConfig = {
    apiKey: config.PRESEARCH_API_KEY,
    timeout: config.PRESEARCH_TIMEOUT,
    maxResults: config.SEARCH_MAX_RESULTS,
    safeSearch: config.PRESEARCH_SAFE_SEARCH,
    defaultLanguage: config.PRESEARCH_DEFAULT_LANGUAGE,
    cache: {
      enabled: config.CACHE_ENABLED,
      ttl: config.CACHE_TTL,
      maxKeys: config.CACHE_MAX_KEYS
    },
    retries: config.PRESEARCH_RETRIES,
    connectionPool: {
      maxSockets: config.CONNECTION_POOL_MAX_SOCKETS,
      keepAlive: config.CONNECTION_POOL_KEEP_ALIVE
    },
    scrape: {
      maxRetries: config.SCRAPE_MAX_RETRIES
    },
    rateLimit: {
      maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
      windowMs: config.RATE_LIMIT_WINDOW_MS
    },
    log: {
      level: config.LOG_LEVEL,
      pretty: config.LOG_PRETTY
    }
  };

  // Create and return the MCP server
  const server = await createMcpServer(internalConfig);
  return server.server;
}