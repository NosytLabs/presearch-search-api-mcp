import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PresearchApiClient } from "../api/api-client.js";
import { PresearchServerConfig, ConfigType } from "../config/configuration.js";
import { logger } from "../utils/logger.js";
import { cacheManager } from "../utils/cache-manager.js";

export class PresearchServer {
  private server: McpServer;
  private config: PresearchServerConfig;
  private apiClient: PresearchApiClient | null = null;

  private isInitialized = false;
  private listening = false;

  constructor(config?: PresearchServerConfig) {
    this.config = config || new PresearchServerConfig();
    this.server = new McpServer({
      port: 3000,
      name: "presearch-mcp-server",
      version: "3.0.0",
    });
  }

  public async stop(): Promise<void> {
    if (this.listening) {
      await this.server.close();
      this.listening = false;
      logger.info("Presearch MCP Server stopped.");
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info("Initializing Presearch MCP Server...");

    this.server.registerTool(
      "presearch_search",
      {
        title: "Presearch Search",
        description:
          "Performs a web search using the Presearch engine with comprehensive filtering options.",
        inputSchema: {
          query: z.string().min(1, "Query must be a non-empty string"),
          page: z.number().int().positive().optional(),
          resultsPerPage: z.number().int().min(1).max(50).optional(),
          lang: z.string().optional(),
          time: z.enum(["any", "day", "week", "month", "year"]).optional(),
          location: z.string().optional(),
          ip: z.string().optional(),
          safe: z.enum(["0", "1"]).optional(),
        },
      },
      this.handleSearchTool.bind(this),
    );

    this.isInitialized = true;
    logger.info("Presearch MCP Server initialized.");
  }

  public async updateConfig(
    newConfig: Partial<PresearchServerConfig>,
  ): Promise<void> {
    this.config.updateConfig(newConfig as Partial<ConfigType>);
    logger.info("Server configuration updated.");
    // Re-initialize components that depend on config
    this.apiClient = new PresearchApiClient(this.config);
  }

  private async lazyInitializeComponents(): Promise<void> {
    if (!this.apiClient) {
      this.apiClient = new PresearchApiClient(this.config);
    }
  }

  public async handleSearchTool(args: Record<string, unknown>) {
    try {
      // Validate arguments using Zod
      const schema = z.object({
        query: z.string().min(1, "Query must be a non-empty string"),
        page: z.number().int().positive().optional(),
        resultsPerPage: z.number().int().min(1).max(50).optional().default(10),
        lang: z.string().optional(),
        time: z.enum(["any", "day", "week", "month", "year"]).optional(),
        location: z.string().optional(),
        ip: z.string().optional(),
        safe: z.enum(["0", "1"]).optional(),
      });

      const validated = schema.parse(args);
      const { resultsPerPage } = validated;

      await this.lazyInitializeComponents();

      if (!this.config.getApiKey()) {
        throw new Error(
          "API key is required for search execution. Please configure PRESEARCH_API_KEY environment variable.",
        );
      }

      if (!this.apiClient) {
        throw new Error("API client not initialized");
      }

      const searchRequest = {
        q: validated.query,
        page: validated.page,
        ...(validated.lang && { lang: validated.lang }),
        ...(validated.time && { time: validated.time }),
        ...(validated.location && { location: validated.location }),
        ...(validated.ip && { ip: validated.ip }),
        ...(validated.safe && { safe: validated.safe }),
      };

      const searchResponse = await this.apiClient.search(searchRequest);

      if (
        searchResponse.results &&
        searchResponse.results.length > resultsPerPage
      ) {
        searchResponse.results = searchResponse.results.slice(
          0,
          resultsPerPage,
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(searchResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Search tool execution failed", {
        query: args.query,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              error instanceof Error
                ? error.message
                : "An unknown error occurred",
          },
        ],
        isError: true,
      };
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    this.listening = true;
    logger.info("Presearch MCP Server started successfully");
  }

  getServer(): McpServer {
    return this.server;
  }

  public isListening(): boolean {
    return this.listening;
  }

  public hasApiKey(): boolean {
    return this.config.hasApiKey();
  }

  public getToolDefinitions(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }> {
    // Return registered tools from the MCP server
    // Since we can't directly access registered tools from McpServer,
    // we'll maintain our own registry
    return [
      {
        name: "presearch_search",
        description:
          "Performs a web search using the Presearch engine with comprehensive filtering options.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            page: { type: "number", description: "Page number" },
            resultsPerPage: { type: "number", description: "Results per page" },
            lang: { type: "string", description: "Language" },
            time: {
              type: "string",
              enum: ["any", "day", "week", "month", "year"],
              description: "Time filter",
            },
            location: { type: "string", description: "Location" },
            ip: { type: "string", description: "IP address" },
            safe: {
              type: "string",
              enum: ["0", "1"],
              description: "Safe search",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "presearch_cache_stats",
        description: "Get cache statistics and performance metrics.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "presearch_cache_clear",
        description: "Clear all cached data.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "presearch_scrape_content",
        description: "Scrape content from a web page.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to scrape" },
          },
          required: ["url"],
        },
      },
      {
        name: "presearch_health_check",
        description: "Check the health status of the Presearch service.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "presearch_system_info",
        description: "Get system information and status.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
  }

  public getTool(name: string):
    | {
        definition: { name: string; description: string; inputSchema: any };
        handler: (args: Record<string, unknown>) => Promise<any>;
      }
    | undefined {
    switch (name) {
      case "presearch_search":
        return {
          definition: {
            name: "presearch_search",
            description:
              "Performs a web search using the Presearch engine with comprehensive filtering options.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
                page: { type: "number", description: "Page number" },
                resultsPerPage: {
                  type: "number",
                  description: "Results per page",
                },
                lang: { type: "string", description: "Language" },
                time: {
                  type: "string",
                  enum: ["any", "day", "week", "month", "year"],
                  description: "Time filter",
                },
                location: { type: "string", description: "Location" },
                ip: { type: "string", description: "IP address" },
                safe: {
                  type: "string",
                  enum: ["0", "1"],
                  description: "Safe search",
                },
              },
              required: ["query"],
            },
          },
          handler: this.handleSearchTool.bind(this),
        };

      case "presearch_health_check":
        return {
          definition: {
            name: "presearch_health_check",
            description: "Check the health status of the Presearch service.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          handler: this.handleHealthCheck.bind(this),
        };

      case "presearch_cache_stats":
        return {
          definition: {
            name: "presearch_cache_stats",
            description: "Get cache statistics and performance metrics.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          handler: this.handleCacheStats.bind(this),
        };

      case "presearch_cache_clear":
        return {
          definition: {
            name: "presearch_cache_clear",
            description: "Clear all cached data.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          handler: this.handleCacheClear.bind(this),
        };

      case "presearch_scrape_content":
        return {
          definition: {
            name: "presearch_scrape_content",
            description: "Scrape content from a web page.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "URL to scrape" },
              },
              required: ["url"],
            },
          },
          handler: this.handleScrapeContent.bind(this),
        };

      case "presearch_system_info":
        return {
          definition: {
            name: "presearch_system_info",
            description: "Get system information and status.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          handler: this.handleSystemInfo.bind(this),
        };

      default:
        return undefined;
    }
  }

  private async handleHealthCheck(_args: Record<string, unknown>) {
    try {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "healthy",
                timestamp: new Date().toISOString(),
                server: "presearch-mcp-server",
                version: "3.0.0",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCacheStats(_args: Record<string, unknown>) {
    try {
      const stats = cacheManager.getStats();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                cacheStats: {
                  hits: stats.hits,
                  misses: stats.misses,
                  hitRate: Math.round(stats.hitRate * 100) / 100,
                  totalEntries: stats.totalEntries,
                  totalSize: stats.totalSize,
                  evictions: stats.evictions,
                  warmingRequests: stats.warmingRequests,
                },
                memoryUsage: {
                  used: stats.totalSize,
                  unit: "bytes",
                },
                performance: {
                  averageAccessTime: stats.averageAccessTime,
                  hitRatePercentage: Math.round(stats.hitRate * 100),
                },
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Cache stats retrieval failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Cache stats retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCacheClear(_args: Record<string, unknown>) {
    try {
      const beforeStats = cacheManager.getStats();
      const beforeEntries = beforeStats.totalEntries;
      const beforeSize = beforeStats.totalSize;

      cacheManager.clear();

      const afterStats = cacheManager.getStats();
      const afterEntries = afterStats.totalEntries;
      const afterSize = afterStats.totalSize;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: "Cache cleared successfully",
                before: {
                  entries: beforeEntries,
                  size: beforeSize,
                },
                after: {
                  entries: afterEntries,
                  size: afterSize,
                },
                cleared: {
                  entries: beforeEntries - afterEntries,
                  size: beforeSize - afterSize,
                },
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Cache clear operation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Cache clear failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleScrapeContent(args: Record<string, unknown>) {
    try {
      // Validate arguments using Zod
      const schema = z.object({
        url: z.string().url("Invalid URL format"),
      });

      const validated = schema.parse(args);
      const { url } = validated;

      // Use Node.js built-in fetch for web scraping
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.config.getUserAgent(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const content = await response.text();

      // Basic content extraction
      const title = content.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "No title found";
      const description = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] || "No description found";

      // Extract main content (basic approach)
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, "").trim() : content;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                url: validated.url,
                status: response.status,
                contentType,
                title,
                description,
                contentLength: content.length,
                extractedContent: bodyContent.substring(0, 2000), // Limit content length
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Content scraping failed", {
        url: args.url,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Content scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSystemInfo(_args: Record<string, unknown>) {
    try {
      const config = this.config.getConfig();
      const cacheStats = cacheManager.getStats();

      // Get system information
      const systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                server: {
                  name: "presearch-mcp-server",
                  version: "3.0.0",
                  status: "running",
                  uptime: process.uptime(),
                  initialized: this.isInitialized,
                  listening: this.listening,
                },
                configuration: {
                  baseURL: config.baseURL,
                  cacheEnabled: config.cache.enabled,
                  rateLimitEnabled: config.rateLimit.requests > 0,
                  circuitBreakerEnabled: config.circuitBreaker.enabled,
                  timeout: config.timeout,
                  logLevel: config.logLevel,
                },
                cache: {
                  enabled: config.cache.enabled,
                  ttl: config.cache.ttl,
                  maxSize: config.cache.maxSize,
                  currentStats: {
                    entries: cacheStats.totalEntries,
                    size: cacheStats.totalSize,
                    hitRate: Math.round(cacheStats.hitRate * 100) / 100,
                  },
                },
                system: {
                  platform: systemInfo.platform,
                  architecture: systemInfo.arch,
                  nodeVersion: systemInfo.nodeVersion,
                  memoryUsage: {
                    rss: systemInfo.memoryUsage.rss,
                    heapTotal: systemInfo.memoryUsage.heapTotal,
                    heapUsed: systemInfo.memoryUsage.heapUsed,
                    external: systemInfo.memoryUsage.external,
                  },
                  cpuUsage: systemInfo.cpuUsage,
                },
                connectivity: {
                  hasApiKey: this.hasApiKey(),
                },
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("System info retrieval failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `System info retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down Presearch MCP Server...");
    try {
      await this.server.close();
      logger.info("Presearch MCP Server shut down gracefully.");
    } catch (error) {
      logger.error("Error during server shutdown", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.listening = false;
    }
  }
}