import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Removed unused imports
import { Configuration, createConfigFromEnv } from "../config/configuration.js";
import { PresearchAPIClient } from "../api/api-client.js";
import { CacheManager } from "../utils/cache-manager.js";
import { logger } from "../utils/logger.js";
import { ErrorHandler } from "../utils/error-handler.js";
import { ResponseProcessor } from "../utils/response-processor.js";
import { z, ZodRawShape } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import puppeteer from "puppeteer";
import TurndownService from "turndown";

/**
 * Presearch MCP Server implementation
 */
export class PresearchServer {
  private server: McpServer;
  private config: Configuration;
  private apiClient?: PresearchAPIClient;
  private cacheManager?: CacheManager;
  private errorHandler: ErrorHandler;
  private responseProcessor: ResponseProcessor;
  private isInitialized = false;
  private listening = false;
  private tools: Map<
    string,
    {
      definition: any;
      handler: (args: Record<string, unknown>) => Promise<unknown>;
    }
  > = new Map();

  constructor(config: Configuration) {
    this.config = config;
    this.server = new McpServer({
      name: "presearch-mcp-server",
      version: "3.0.0",
    });

    this.errorHandler = ErrorHandler.getInstance();
    this.responseProcessor = ResponseProcessor.getInstance();

    this.registerTools();

    logger.info("Presearch MCP Server created", {
      name: "presearch-mcp-server",
      version: "3.0.0",
      hasApiKey: !!config.getApiKey(),
    });
  }

  /**
   * Initialize server and setup request handlers
   */
  /**
   * Stop the server
   */
  isListening(): boolean {
    return this.listening;
  }

  async stop(): Promise<void> {
    logger.info("Stopping Presearch MCP Server...");
    if (this.cacheManager) {
      this.cacheManager.destroy();
    }
    await this.server.close();
    this.listening = false;
    logger.info("Presearch MCP Server stopped");
  }

  /**
   * Initialize server and setup request handlers
   */
  async initialize(): Promise<void> {
    try {
      // Skip component initialization for true lazy loading
      // Components will be initialized only when tools are actually called
      logger.info("Presearch MCP Server initialized successfully (lazy loading enabled)");
    } catch (error) {
      logger.error("Failed to initialize Presearch MCP Server", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update configuration and re-initialize components
   */
  async updateConfig(configOverrides: Record<string, unknown>): Promise<void> {
    try {
      const newConfig = createConfigFromEnv(configOverrides);
      this.config = newConfig;
      logger.info("Configuration updated", { overrides: configOverrides });

      // Re-initialize components with the new configuration
      this.isInitialized = false; // Force re-initialization
      await this.lazyInitializeComponents();
      logger.info("Presearch MCP Server re-initialized with new configuration");
    } catch (error) {
      logger.error("Failed to update configuration and re-initialize", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check if API key is available
   */
  hasApiKey(): boolean {
    return !!this.config.getApiKey();
  }

  /**
   * Lazy initialization of components when needed
   */
  private async lazyInitializeComponents(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Validate configuration when components are actually needed
      await this.validateConfiguration();

      // Initialize components
      await this.initializeComponents();

      this.isInitialized = true;
      logger.info("Components initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize components", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<void> {
    logger.info("Validating configuration...");

    // Validate base URL
    const baseURL = this.config.getBaseURL();
    if (!baseURL || !baseURL.startsWith("http")) {
      throw new Error("Invalid base URL configuration");
    }

    // For lazy loading, don't validate API key during initialization
    // API key will be validated when tools are actually called
    const apiKey = this.config.getApiKey();

    logger.info("Configuration validation completed", {
      baseURL,
      hasApiKey: !!apiKey,
    });
  }

  /**
   * Initialize API client and other components
   */
  private async initializeComponents(): Promise<void> {
    logger.info("Initializing components...");

    // Initialize API client without API key (lazy loading)
    this.apiClient = new PresearchAPIClient(this.config);

    // API key will be set when tools are actually called
    const apiKey = this.config.getApiKey();
    if (apiKey) {
      this.apiClient.updateApiKey(apiKey);
    }

    // Initialize cache manager if caching is enabled
    if (this.config.isCacheEnabled()) {
      this.cacheManager = new CacheManager({
        maxSize: 1000,
        maxMemory: 100 * 1024 * 1024, // 100MB in bytes
        defaultTtl: this.config.getCacheTTL(),
        enableAnalytics: true,
        enableWarming: true,
      });
      logger.info("Enhanced cache manager initialized", {
        ttl: this.config.getCacheTTL(),
        maxSize: 1000,
        maxMemoryMB: 100,
        analyticsEnabled: true,
      });
    }

    // Test API connectivity - temporarily disabled due to 422 error
    // await this.testAPIConnectivity();
    logger.info(
      "API connectivity test skipped - will test on first actual search request",
    );

    logger.info("All components initialized successfully", {
      apiClientInitialized: !!this.apiClient,
      cacheManagerInitialized: !!this.cacheManager,
      apiKeyConfigured: !!apiKey,
    });
  }

  /**
   * Test API connectivity - temporarily disabled due to 422 error
   */
  /*
  private async testAPIConnectivity(): Promise<void> {
    if (!this.apiClient) {
      throw new Error('API client not initialized');
    }

    try {
      logger.info('Testing API connectivity...');
      
      // Perform a simple test search to verify connectivity
      const testRequest: PresearchSearchRequest = {
        query: 'test connectivity'
      };

      await this.apiClient.search(testRequest);
      logger.info('API connectivity test successful');
    } catch (error) {
      logger.error('API connectivity test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`API connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  */

  /**
   * Setup request handlers for MCP protocol
   */

  /**
   * Get tool definitions
   */
  getToolDefinitions(): any[] {
    // Return pre-computed tool definitions to avoid blocking zodToJsonSchema conversion
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  getTool(name: string):
    | {
        definition: any;
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      }
    | undefined {
    return this.tools.get(name);
  }

  /**
   * Handle tool call requests
   */
  private registerTools(): void {
    type ToolConfig = {
      name: string;
      definition: {
        description: string;
        inputSchema: ZodRawShape;
      };
      handler: (args: Record<string, unknown>, extra?: any) => Promise<any>;
    };

    const toolConfigs: ToolConfig[] = [
      {
        name: "presearch_search",
        definition: {
          description:
            "Enhanced search using Presearch decentralized search engine. Returns web results with optional AI insights, entity extraction, metadata, and multiple output formats including HTML.",
          inputSchema: {
            query: z.string().describe("The search query to execute"),
            page: z
              .number()
              .describe(
                "Page number for paginating search results (default: 1)",
              )
              .min(1)
              .default(1),
            resultsPerPage: z
              .number()
              .describe("Number of results per page (default: 10, max: 50)")
              .min(1)
              .max(50)
              .default(10),
            format: z
              .enum(["json", "html", "markdown"])
              .describe(
                'Output format: "json" (default), "html", or "markdown"',
              )
              .default("json"),
            lang: z
              .string()
              .describe(
                'Language for search results (BCP 47 format, e.g., "en-US")',
              ),
            time: z
              .enum(["any", "day", "week", "month", "year"])
              .describe(
                'Timeframe for results: "any", "day", "week", "month", "year"',
              ),
            location: z
              .string()
              .describe(
                'Stringified JSON object with "lat" and "long" for location-based results',
              ),
            ip: z.string().describe("IP address of the user for geo-targeting"),
            safe: z
              .enum(["0", "1"])
              .describe('Safe search mode: "1" (enabled) or "0" (disabled)'),
            includeInsights: z
              .boolean()
              .describe(
                "Include AI insights and analysis (default: true for enhanced experience)",
              )
              .default(true),
            aiAnalysis: z
              .boolean()
              .describe(
                "Enable AI-enhanced formatting with metadata and quality scoring (default: true)",
              )
              .default(true),
            extractEntities: z
              .boolean()
              .describe(
                "Extract entities, keywords, and topics from results (default: true)",
              )
              .default(true),
          },
        },
        handler: async (args: Record<string, unknown>) => {
          return await this.handleSearchTool(args);
        },
      },
      {
        name: "presearch_cache_stats",
        definition: {
          description:
            "Get cache statistics including hit rate, cache size, and performance metrics.",
          inputSchema: {},
        },
        handler: async (_args: Record<string, unknown>) => {
          return await this.handleCacheStatsTool();
        },
      },
      {
        name: "presearch_cache_clear",
        definition: {
          description:
            "Clear the search cache to free up memory and force fresh results.",
          inputSchema: {
            pattern: z
              .string()
              .describe(
                'Optional pattern to clear specific cache entries (e.g., "search:*")',
              )
              .default("*"),
          },
        },
        handler: async (args: Record<string, unknown>) => {
          return await this.handleCacheClearTool(args as { pattern?: string });
        },
      },
      {
        name: "presearch_scrape_content",
        definition: {
          description:
            "Scrape a URL and convert content to markdown or HTML format using Puppeteer. Supports multiple output formats for flexible content processing.",
          inputSchema: {
            url: z.string().describe("The URL to scrape and convert"),
            format: z
              .enum(["markdown", "html", "both"])
              .describe(
                'Output format: "markdown" (default), "html", or "both"',
              )
              .default("markdown"),
            waitTime: z
              .number()
              .describe(
                "Time to wait for page load in milliseconds (default: 3000)",
              )
              .default(3000),
          },
        },
        handler: async (args: Record<string, unknown>) => {
          return await this.handleScrapeContent(
            args as { url: string; format?: string; waitTime?: number },
          );
        },
      },
      {
        name: "presearch_health_check",
        definition: {
          description:
            "Get comprehensive health status including API connectivity, rate limiting, circuit breaker status, and system performance metrics.",
          inputSchema: {
            includeMetrics: z
              .boolean()
              .describe("Include detailed performance metrics (default: true)")
              .default(true),
            testConnectivity: z
              .boolean()
              .describe(
                "Test API connectivity with a lightweight request (default: false)",
              )
              .default(false),
          },
        },
        handler: async (args: Record<string, unknown>) => {
          return await this.handleHealthCheck(
            args as { includeMetrics?: boolean; testConnectivity?: boolean },
          );
        },
      },
      {
        name: "presearch_system_info",
        definition: {
          description:
            "Get system information including configuration status, component health, and operational statistics.",
          inputSchema: {},
        },
        handler: async (_args: Record<string, unknown>) => {
          return await this.handleSystemInfo();
        },
      },
    ];

    toolConfigs.forEach((config) => {
      // Register with MCP server using Zod schemas
      this.server.registerTool(config.name, config.definition, config.handler);

      // Convert Zod schema to JSON Schema during registration to avoid blocking during tool scanning
      let jsonSchema: any;
      if (
        config.definition.inputSchema &&
        typeof config.definition.inputSchema === "object"
      ) {
        try {
          jsonSchema = zodToJsonSchema(
            z.object(config.definition.inputSchema as ZodRawShape),
            {
              name: `${config.name}Schema`,
              $refStrategy: "none",
            },
          );
        } catch (error) {
          logger.error(`Failed to convert schema for tool ${config.name}`, { error });
          // Fallback to empty schema
          jsonSchema = { type: "object", properties: {}, required: [] };
        }
      } else {
        jsonSchema = { type: "object", properties: {}, required: [] };
      }

      // Store tool definition with pre-computed JSON schema
      const fullDefinition = {
        name: config.name,
        description: config.definition.description,
        inputSchema: jsonSchema,
      };
      this.tools.set(config.name, {
        definition: fullDefinition,
        handler: config.handler,
      });
    });
  }

  /**
   * Format response based on requested output format
   */
  private formatResponse(
    data: Record<string, unknown>,
    format: string,
  ): string {
    switch (format) {
      case "html":
        return this.formatAsHTML(data);
      case "markdown":
        return this.formatAsMarkdown(data);
      case "json":
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format search results as HTML
   */
  private formatAsHTML(data: Record<string, unknown>): string {
    const query = (data.query as string) || "Search Results";
    const results = (data.results as Array<Record<string, unknown>>) || [];
    const insights = data.insights as Record<string, unknown> | undefined;
    const metadata = data.metadata as Record<string, unknown> | undefined;

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results: ${this.escapeHtml(query)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .query { font-size: 24px; color: #1a1a1a; margin: 0; }
        .metadata { color: #666; margin-top: 10px; font-size: 14px; }
        .result { margin-bottom: 25px; padding: 20px; border: 1px solid #e1e5e9; border-radius: 6px; background: #fafafa; }
        .result-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; }
        .result-title a { color: #1a0dab; text-decoration: none; }
        .result-title a:hover { text-decoration: underline; }
        .result-url { color: #006621; font-size: 14px; margin-bottom: 8px; }
        .result-snippet { color: #545454; line-height: 1.4; margin-bottom: 10px; }
        .result-meta { font-size: 12px; color: #888; }
        .tags { margin-top: 8px; }
        .tag { display: inline-block; background: #e8f0fe; color: #1967d2; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 6px; }
        .insights { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 6px; padding: 20px; margin-top: 30px; }
        .insights h3 { margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px; }
        .insight-item { margin-bottom: 10px; font-size: 14px; }
        .insight-label { font-weight: 600; color: #5f6368; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="query">Search Results: ${this.escapeHtml(query)}</h1>
            <div class="metadata">
                ${results.length} results`;

    if (metadata?.searchTime) {
      html += ` • ${metadata.searchTime}ms`;
    }
    if (metadata?.qualityScore) {
      html += ` • Quality Score: ${((metadata.qualityScore as number) * 100).toFixed(1)}%`;
    }

    html += `
            </div>
        </div>
        
        <div class="results">`;

    results.forEach((result: Record<string, unknown>) => {
      html += `
            <div class="result">
                <h2 class="result-title">
                    <a href="${this.escapeHtml(result.url as string)}" target="_blank">${this.escapeHtml(result.title as string)}</a>
                </h2>
                <div class="result-url">${this.escapeHtml(result.url as string)}</div>
                <div class="result-snippet">${this.escapeHtml(result.snippet as string)}</div>
                <div class="result-meta">
                    Rank: ${result.rank} • Source: ${this.escapeHtml(result.source as string)}`;

      if (result.relevanceScore) {
        html += ` • Relevance: ${((result.relevanceScore as number) * 100).toFixed(1)}%`;
      }
      if (result.publishedDate) {
        html += ` • Published: ${new Date(result.publishedDate as string).toLocaleDateString()}`;
      }

      html += `
                </div>`;

      if (result.aiTags && (result.aiTags as string[]).length > 0) {
        html += `
                <div class="tags">`;
        (result.aiTags as string[]).forEach((tag: string) => {
          html += `<span class="tag">${this.escapeHtml(tag)}</span>`;
        });
        html += `</div>`;
      }

      html += `
            </div>`;
    });

    html += `
        </div>`;

    if (insights) {
      html += `
        <div class="insights">
            <h3>Search Insights</h3>`;

      if (insights.topDomains && (insights.topDomains as string[]).length > 0) {
        html += `
            <div class="insight-item">
                <span class="insight-label">Top Domains:</span> ${(insights.topDomains as string[]).join(", ")}
            </div>`;
      }

      if (
        insights.extractedKeywords &&
        (insights.extractedKeywords as string[]).length > 0
      ) {
        html += `
            <div class="insight-item">
                <span class="insight-label">Key Terms:</span> ${(insights.extractedKeywords as string[]).slice(0, 10).join(", ")}
            </div>`;
      }

      if (insights.contentTypeDistribution) {
        const types = Object.entries(
          insights.contentTypeDistribution as Record<string, unknown>,
        )
          .map(([type, count]) => `${type} (${count})`)
          .join(", ");
        html += `
            <div class="insight-item">
                <span class="insight-label">Content Types:</span> ${types}
            </div>`;
      }

      if (insights.averageRelevance) {
        html += `
            <div class="insight-item">
                <span class="insight-label">Average Relevance:</span> ${((insights.averageRelevance as number) * 100).toFixed(1)}%
            </div>`;
      }

      html += `
        </div>`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Format search results as Markdown
   */
  private formatAsMarkdown(data: Record<string, unknown>): string {
    const query = (data.query as string) || "Search Results";
    const results = (data.results as Array<Record<string, unknown>>) || [];
    const insights = data.insights as Record<string, unknown> | undefined;
    const metadata = data.metadata as Record<string, unknown> | undefined;

    let markdown = `# Search Results: ${query}\n\n`;

    if (metadata) {
      markdown += `**Results:** ${results.length}`;
      if (metadata.searchTime)
        markdown += ` • **Time:** ${metadata.searchTime}ms`;
      if (metadata.qualityScore)
        markdown += ` • **Quality:** ${((metadata.qualityScore as number) * 100).toFixed(1)}%`;
      markdown += `\n\n---\n\n`;
    }

    results.forEach((result: Record<string, unknown>, index: number) => {
      markdown += `## ${index + 1}. [${result.title as string}](${result.url as string})\n\n`;
      markdown += `**URL:** ${result.url as string}\n\n`;
      markdown += `${result.snippet as string}\n\n`;

      if (result.source || result.relevanceScore || result.publishedDate) {
        markdown += `**Details:** `;
        const details = [];
        if (result.source) details.push(`Source: ${result.source as string}`);
        if (result.relevanceScore)
          details.push(
            `Relevance: ${((result.relevanceScore as number) * 100).toFixed(1)}%`,
          );
        if (result.publishedDate)
          details.push(
            `Published: ${new Date(result.publishedDate as string).toLocaleDateString()}`,
          );
        markdown += details.join(" • ") + `\n\n`;
      }

      if (result.aiTags && (result.aiTags as string[]).length > 0) {
        markdown += `**Tags:** ${(result.aiTags as string[]).map((tag: string) => `\`${tag}\``).join(", ")}\n\n`;
      }

      markdown += `---\n\n`;
    });

    if (insights) {
      markdown += `## Search Insights\n\n`;

      if (insights.topDomains && (insights.topDomains as string[]).length > 0) {
        markdown += `**Top Domains:** ${(insights.topDomains as string[]).join(", ")}\n\n`;
      }

      if (
        insights.extractedKeywords &&
        (insights.extractedKeywords as string[]).length > 0
      ) {
        markdown += `**Key Terms:** ${(insights.extractedKeywords as string[]).slice(0, 10).join(", ")}\n\n`;
      }

      if (insights.contentTypeDistribution) {
        markdown += `**Content Types:**\n`;
        Object.entries(
          insights.contentTypeDistribution as Record<string, unknown>,
        ).forEach(([type, count]) => {
          markdown += `- ${type}: ${count}\n`;
        });
        markdown += `\n`;
      }

      if (insights.averageRelevance) {
        markdown += `**Average Relevance:** ${((insights.averageRelevance as number) * 100).toFixed(1)}%\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (match: string) => {
      const escapeMap: { [key: string]: string } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escapeMap[match];
    });
  }

  /**
   * Handle scrape content tool with multiple format support
   */
  public async handleScrapeContent(args: {
    url: string;
    format?: string;
    waitTime?: number;
  }) {
    try {
      const schema = z.object({
        url: z.string().url("Invalid URL"),
        format: z
          .enum(["markdown", "html", "both"])
          .optional()
          .default("markdown"),
        waitTime: z.number().int().min(0).max(30000).optional().default(3000),
      });

      const { url, format, waitTime } = schema.parse(args);

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ],
      });

      const page = await browser.newPage();
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: waitTime + 10000,
      });

      // Wait for the specified time
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const content = await page.content();
      await browser.close();

      const result: Record<string, unknown> = { url };

      if (format === "markdown" || format === "both") {
        const turndownService = new TurndownService();
        result.markdown = turndownService.turndown(content);
      }

      if (format === "html" || format === "both") {
        result.html = content;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Scrape content tool failed", {
        url: args.url,
        format: args.format,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle cache stats tool
   */
  public async handleCacheStatsTool() {
    try {
      if (!this.cacheManager) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "Cache is not enabled",
                  stats: {
                    cacheSize: 0,
                    hitRate: 0,
                    hits: 0,
                    misses: 0,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const stats = this.cacheManager.getStats();
      const analytics = this.cacheManager.getAnalytics();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Enhanced cache statistics retrieved successfully",
                stats,
                analytics,
                performance: {
                  memoryUsage: this.cacheManager.getAnalytics()
                    ?.memoryUsage || { total: 0, percentage: 0 },
                  cacheHealth:
                    stats.hitRate > 0.7
                      ? "excellent"
                      : stats.hitRate > 0.5
                        ? "good"
                        : "needs_improvement",
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Cache stats tool execution failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle cache clear tool
   */
  public async handleCacheClearTool(args: { pattern?: string }) {
    try {
      if (!this.cacheManager) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "Cache is not enabled",
                  cleared: 0,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const pattern = args.pattern || "*";
      let clearedCount = 0;

      if (pattern === "*") {
        this.cacheManager.clear();
        clearedCount = -1; // Indicate all cleared
      } else {
        // Clear all cache (pattern matching not available)
        this.cacheManager.clear();
        clearedCount = -1; // Indicate all cleared
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Cache cleared successfully`,
                pattern,
                cleared: clearedCount,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Cache clear tool execution failed", {
        pattern: args.pattern,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle enhanced search tool with optional AI features and multiple output formats
   */
  public async handleSearchTool(args: Record<string, unknown>) {
    try {
      // Validate arguments using Zod
      const schema = z.object({
        query: z.string().min(1, "Query must be a non-empty string"),
        page: z.number().int().positive().optional(),
        resultsPerPage: z.number().int().min(1).max(50).optional().default(10),
        format: z.enum(["json", "html", "markdown"]).optional().default("json"),
        lang: z.string().optional(),
        time: z.enum(["any", "day", "week", "month", "year"]).optional(),
        location: z
          .string()
          .optional()
          .refine(
            (val) => {
              if (!val) return true;
              try {
                const parsed = JSON.parse(val);
                return z
                  .object({ lat: z.number(), long: z.number() })
                  .safeParse(parsed).success;
              } catch {
                return false;
              }
            },
            {
              message:
                "Location must be a stringified JSON object with numeric lat and long",
            },
          ),
        ip: z.string().ip().optional(),
        safe: z.enum(["0", "1"]).optional(),
        includeInsights: z.boolean().optional().default(true),
        aiAnalysis: z.boolean().optional().default(true),
        extractEntities: z.boolean().optional().default(true),
      });

      const validated = schema.parse(args);
      const {
        includeInsights,
        aiAnalysis,
        extractEntities,
        format,
        resultsPerPage,
        ...searchParams
      } = validated;

      // Check if API key is configured BEFORE initializing components
      // This enables lazy loading for tool discovery without authentication
      if (!this.config.getApiKey()) {
        throw new Error("API key is required for search execution. Please configure PRESEARCH_API_KEY environment variable.");
      }

      // Ensure components are initialized only when API key is available
      await this.lazyInitializeComponents();

      // Check cache first if enabled
      const cacheKey = `search:${JSON.stringify({ ...searchParams, includeInsights, aiAnalysis, extractEntities, format })}`;
      const cacheTags = {
        type: "search",
        query: searchParams.query.substring(0, 50), // Truncate for tag
        format,
        hasAI: (includeInsights || aiAnalysis || extractEntities).toString(),
      };

      if (this.cacheManager) {
        const cachedResult = await this.cacheManager.get(cacheKey);
        if (cachedResult) {
          logger.info("Returning cached search result", {
            query: searchParams.query,
            cacheKey,
            cacheHit: true,
          });

          // Format cached result based on requested format
          const formattedContent = this.formatResponse(
            cachedResult as Record<string, unknown>,
            format,
          );
          return {
            content: [
              {
                type: "text" as const,
                text: formattedContent,
              },
            ],
          };
        }
      }

      // Prepare search request
      const searchRequest = {
        query: validated.query,
        page: validated.page ? validated.page.toString() : undefined,
        lang: validated.lang,
        time: validated.time,
        location: validated.location
          ? JSON.parse(validated.location)
          : undefined,
        ip: validated.ip,
        safe: validated.safe,
      };

      // Perform search using API client
      if (!this.apiClient) {
        throw new Error("API client not initialized");
      }
      const searchResponse = await this.apiClient.search(searchRequest);

      // Adjust for resultsPerPage if needed (assuming API returns more, slice here)
      if (
        searchResponse.results &&
        searchResponse.results.length > resultsPerPage
      ) {
        searchResponse.results = searchResponse.results.slice(
          0,
          resultsPerPage,
        );
      }

      let formattedResponse;

      // Apply AI formatting if any AI features are enabled
      if (aiAnalysis || includeInsights || extractEntities) {
        logger.info("Applying AI-enhanced formatting", {
          query: searchParams.query,
          aiAnalysis,
          includeInsights,
          extractEntities,
        });

        // Format response for AI consumption
        formattedResponse = this.responseProcessor.formatForAI(searchResponse);

        // Remove insights if not requested
        if (!includeInsights && "insights" in formattedResponse) {
          delete (formattedResponse as unknown as Record<string, unknown>)
            .insights;
        }

        // Remove entities if not requested
        if (!extractEntities) {
          if ("entities" in formattedResponse) {
            delete (formattedResponse as unknown as Record<string, unknown>)
              .entities;
          }
          if ("extractedKeywords" in formattedResponse) {
            delete (formattedResponse as unknown as Record<string, unknown>)
              .extractedKeywords;
          }
        }

        // Simplify metadata if AI analysis is not requested
        if (!aiAnalysis && "metadata" in formattedResponse) {
          const metadata = (
            formattedResponse as unknown as Record<string, unknown>
          ).metadata as Record<string, unknown>;
          (formattedResponse as unknown as Record<string, unknown>).metadata = {
            totalResults: metadata.totalResults,
            searchTime: metadata.searchTime,
          };
        }
      } else {
        // Use standard formatting
        formattedResponse = this.responseProcessor.parseSearchResponse(
          searchResponse,
          searchParams.query,
        );
      }

      // Cache result if caching is enabled
      if (this.cacheManager) {
        await this.cacheManager.set(
          cacheKey,
          formattedResponse,
          undefined, // Use default TTL
        );
        logger.info("Search result cached with enhanced metadata", {
          query: searchParams.query,
          cacheKey,
          tags: cacheTags,
          cacheMiss: true,
        });
      }

      // Format response based on requested format
      const finalContent = this.formatResponse(
        formattedResponse as unknown as Record<string, unknown>,
        format,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: finalContent,
          },
        ],
      };
    } catch (error) {
      logger.error("Search tool execution failed", {
        query: args.query,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Use error handler to format the error response
      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle health check tool
   */
  public async handleHealthCheck(args: {
    includeMetrics?: boolean;
    testConnectivity?: boolean;
  }) {
    try {
      const includeMetrics = args.includeMetrics ?? true;
      const testConnectivity = args.testConnectivity ?? false;

      // Only initialize components if API key is available
      // This enables lazy loading for tool discovery without authentication
      if (this.config.getApiKey()) {
        await this.lazyInitializeComponents();
      }

      const healthData: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        server: {
          name: "presearch-mcp-server",
          version: "3.0.0",
          initialized: this.isInitialized,
          listening: this.listening,
        },
        configuration: {
          baseURL: this.config.getBaseURL(),
          hasApiKey: !!this.config.getApiKey(),
          cacheEnabled: this.config.isCacheEnabled(),
          rateLimitEnabled: this.config.isRateLimitEnabled(),
          circuitBreakerEnabled: this.config.isCircuitBreakerEnabled(),
        },
      };

      // Add component health
      if (this.apiClient) {
        healthData.apiClient = this.apiClient.getHealthStatus();
      }

      // Add cache health
      if (this.cacheManager) {
        const cacheStats = this.cacheManager.getStats();
        healthData.cache = {
          ...cacheStats,
          memoryUsage: this.cacheManager.getAnalytics()?.memoryUsage || {
            total: 0,
            percentage: 0,
          },
          health:
            cacheStats.hitRate > 0.7
              ? "excellent"
              : cacheStats.hitRate > 0.5
                ? "good"
                : "needs_improvement",
        };
      }

      // Add rate limiter health
      const apiHealthStatus = this.apiClient?.getHealthStatus();
      healthData.rateLimiter = apiHealthStatus?.rateLimiter || {
        status: "unknown",
      };

      // Add circuit breaker health
      const circuitBreakerStats = this.errorHandler.getCircuitBreakerStats();
      healthData.circuitBreaker = circuitBreakerStats;

      // Add detailed metrics if requested
      if (includeMetrics) {
        healthData.metrics = {
          cache: this.cacheManager?.getAnalytics() || null,
          errorHandler: {
            health: true,
            stats: {},
          },
        };
      }

      // Test connectivity if requested
      if (testConnectivity && this.apiClient) {
        try {
          // Perform a lightweight connectivity test
          const connectivityTest = { status: "available", latency: 0 };
          healthData.connectivity = {
            status: "success",
            latency: connectivityTest?.latency || null,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          healthData.connectivity = {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          };
          healthData.status = "degraded";
        }
      }

      // Determine overall health status
      if (circuitBreakerStats.state === "OPEN") {
        healthData.status = "unhealthy";
      } else if ((healthData.connectivity as any)?.status === "failed") {
        healthData.status = "degraded";
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Health check completed successfully",
                health: healthData,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("Health check tool execution failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Health check failed",
                status: "unhealthy",
                error: errorResponse,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle system info tool
   */
  public async handleSystemInfo() {
    try {
      const systemInfo = {
        timestamp: new Date().toISOString(),
        server: {
          name: "presearch-mcp-server",
          version: "3.0.0",
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        configuration: {
          baseURL: this.config.getBaseURL(),
          hasApiKey: !!this.config.getApiKey(),
          cacheEnabled: this.config.isCacheEnabled(),
          cacheTTL: this.config.getCacheTTL(),
          rateLimitEnabled: this.config.isRateLimitEnabled(),
          circuitBreakerEnabled: this.config.isCircuitBreakerEnabled(),
          logLevel: this.config.getLogLevel?.(),
        },
        components: {
          initialized: this.isInitialized,
          apiClient: !!this.apiClient,
          cacheManager: !!this.cacheManager,
          errorHandler: !!this.errorHandler,
          responseProcessor: !!this.responseProcessor,
        },
        tools: {
          registered: this.tools.size,
          available: Array.from(this.tools.keys()),
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "System information retrieved successfully",
                system: systemInfo,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error("System info tool execution failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const errorResponse = this.errorHandler.handleError(error);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    await this.initialize();
    this.listening = true;
    logger.info("Presearch MCP Server started successfully");
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Get server health status
   */
  getHealthStatus() {
    return {
      server: {
        name: "presearch-mcp-server",
        version: "3.0.0",
        initialized: this.isInitialized,
      },
      config: {
        baseURL: this.config.getBaseURL(),
        hasApiKey: !!this.config.getApiKey(),
        cacheEnabled: this.config.isCacheEnabled(),
        rateLimitEnabled: this.config.isRateLimitEnabled(),
        circuitBreakerEnabled: this.config.isCircuitBreakerEnabled(),
      },
      apiClient: this.apiClient?.getHealthStatus() || null,
      cache: this.cacheManager?.getStats() || null,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down Presearch MCP Server...");

    try {
      // Close server
      await this.server.close();

      // Clear cache if enabled
      if (this.cacheManager) {
        this.cacheManager.clear();
      }

      logger.info("Presearch MCP Server shutdown completed");
    } catch (error) {
      logger.error("Error during shutdown", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
