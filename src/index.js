import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import searchTool from "./tools/search.js";
import { contentAnalysisTool } from "./tools/content-analysis.js";
import { exportResultsTool } from "./tools/export.js";
import { scrapeTool } from "./tools/scrape.js";
import { searchAndScrapeTool } from "./tools/search-scrape.js";
import { enhancedExportTool } from "./tools/enhanced-export.js";
import { cacheStatsTool, cacheClearTool } from "./tools/cache.js";
import { healthTool } from "./tools/health.js";
import { nodeStatusTool } from "./tools/node-status.js";
import { deepResearchTool } from "./tools/deep-research.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import logger from "./core/logger.js";
import { loadConfig } from "./core/config.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    stdio: args.includes("--stdio"),
    port: undefined,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      flags.port = parseInt(args[i + 1]);
      i++;
    }
  }
  if (process.env.MCP_TRANSPORT === "stdio") flags.stdio = true;
  if (process.env.PORT && !flags.port) flags.port = parseInt(process.env.PORT);
  return flags;
}

const main = async () => {
  try {
    const config = await loadConfig();
    const flags = parseArgs();

    if (flags.stdio) {
      const server = new McpServer({
        name: "presearch-mcp-server",
        description:
          "Privacy-focused MCP server for web search and content export with caching and result processing.",
        version: "2.1.0",
      });

      // Register tools without specific context (uses global env)
      server.registerTool(
        searchTool.name,
        searchTool.inputSchema,
        async (args) => searchTool.execute(args),
      );
      server.registerTool(
        contentAnalysisTool.name,
        contentAnalysisTool.inputSchema,
        async (args) => contentAnalysisTool.execute(args),
      );
      server.registerTool(
        exportResultsTool.name,
        exportResultsTool.inputSchema,
        async (args) => exportResultsTool.execute(args),
      );
      server.registerTool(
        scrapeTool.name,
        scrapeTool.inputSchema,
        async (args) => scrapeTool.execute(args),
      );
      server.registerTool(
        searchAndScrapeTool.name,
        searchAndScrapeTool.inputSchema,
        async (args) => searchAndScrapeTool.execute(args),
      );
      server.registerTool(
        enhancedExportTool.name,
        enhancedExportTool.inputSchema,
        async (args) => enhancedExportTool.execute(args),
      );
      server.registerTool(
        cacheStatsTool.name,
        cacheStatsTool.inputSchema,
        async (args) => cacheStatsTool.execute(args),
      );
      server.registerTool(
        cacheClearTool.name,
        cacheClearTool.inputSchema,
        async (args) => cacheClearTool.execute(args),
      );
      server.registerTool(
        healthTool.name,
        healthTool.inputSchema,
        async (args) => healthTool.execute(args),
      );
      server.registerTool(
        nodeStatusTool.name,
        nodeStatusTool.inputSchema,
        async (args) => nodeStatusTool.execute(args),
      );
      server.registerTool(
        deepResearchTool.name,
        deepResearchTool.inputSchema,
        async (args) => deepResearchTool.execute(args),
      );

      // Register Resources and Prompts
      registerResources(server);
      registerPrompts(server);

      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("MCP Server (STDIO) starting");
      return;
    }

    const app = express();
    app.use(express.json());

    app.all("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      // Extract configuration from query parameters (Smithery.ai style)
      // Helper to safely parse numbers and booleans from query strings
      const parseBool = (val) => {
        if (typeof val === "string") return val.toLowerCase() === "true";
        return !!val;
      };
      const parseIntSafe = (val) => {
        if (!val) return undefined;
        const num = parseInt(val);
        return isNaN(num) ? undefined : num;
      };

      const queryConfig = {
        apiKey: req.query.PRESEARCH_API_KEY,
        timeout: parseIntSafe(req.query.PRESEARCH_TIMEOUT),
        search: {
          maxResults: parseIntSafe(req.query.SEARCH_MAX_RESULTS),
          defaultSafeSearch: req.query.PRESEARCH_SAFE_SEARCH,
          defaultLanguage: req.query.PRESEARCH_DEFAULT_LANGUAGE,
        },
        cache: {
          enabled:
            req.query.CACHE_ENABLED !== undefined
              ? parseBool(req.query.CACHE_ENABLED)
              : undefined,
          ttl: parseIntSafe(req.query.CACHE_TTL),
          maxKeys: parseIntSafe(req.query.CACHE_MAX_KEYS),
        },
        logging: {
          level: req.query.LOG_LEVEL,
          pretty:
            req.query.LOG_PRETTY !== undefined
              ? parseBool(req.query.LOG_PRETTY)
              : undefined,
        },
      };

      // Merge with global config defaults (basic implementation)
      // We filter out undefined values to avoid overwriting defaults with undefined
      const cleanQueryConfig = {};

      if (queryConfig.apiKey) cleanQueryConfig.apiKey = queryConfig.apiKey;
      if (queryConfig.timeout) cleanQueryConfig.timeout = queryConfig.timeout;

      const searchConfig = {};
      if (queryConfig.search.maxResults)
        searchConfig.maxResults = queryConfig.search.maxResults;
      if (queryConfig.search.defaultSafeSearch)
        searchConfig.defaultSafeSearch = queryConfig.search.defaultSafeSearch;
      if (queryConfig.search.defaultLanguage)
        searchConfig.defaultLanguage = queryConfig.search.defaultLanguage;
      if (Object.keys(searchConfig).length > 0)
        cleanQueryConfig.search = { ...config.search, ...searchConfig };

      const cacheConfig = {};
      if (queryConfig.cache.enabled !== undefined)
        cacheConfig.enabled = queryConfig.cache.enabled;
      if (queryConfig.cache.ttl) cacheConfig.ttl = queryConfig.cache.ttl;
      if (queryConfig.cache.maxKeys)
        cacheConfig.maxKeys = queryConfig.cache.maxKeys;
      if (Object.keys(cacheConfig).length > 0)
        cleanQueryConfig.cache = { ...config.cache, ...cacheConfig };

      const loggingConfig = {};
      if (queryConfig.logging.level)
        loggingConfig.level = queryConfig.logging.level;
      if (queryConfig.logging.pretty !== undefined)
        loggingConfig.pretty = queryConfig.logging.pretty;
      if (Object.keys(loggingConfig).length > 0)
        cleanQueryConfig.logging = { ...config.logging, ...loggingConfig };

      const context = {
        apiKey: cleanQueryConfig.apiKey || config.apiKey,
        config: {
          ...config,
          ...cleanQueryConfig,
        },
      };

      // Create a fresh server instance for this request/session
      const server = new McpServer({
        name: "presearch-mcp-server",
        description:
          "Privacy-focused MCP server for web search and content export with caching and result processing.",
        version: "2.1.0",
      });

      // Register tools with context
      server.registerTool(
        searchTool.name,
        searchTool.inputSchema,
        async (args) => searchTool.execute(args, context),
      );
      server.registerTool(
        contentAnalysisTool.name,
        contentAnalysisTool.inputSchema,
        async (args) => contentAnalysisTool.execute(args, context),
      );
      server.registerTool(
        exportResultsTool.name,
        exportResultsTool.inputSchema,
        async (args) => exportResultsTool.execute(args, context),
      );
      server.registerTool(
        scrapeTool.name,
        scrapeTool.inputSchema,
        async (args) => scrapeTool.execute(args, context),
      );
      server.registerTool(
        searchAndScrapeTool.name,
        searchAndScrapeTool.inputSchema,
        async (args) => searchAndScrapeTool.execute(args, context),
      );
      server.registerTool(
        enhancedExportTool.name,
        enhancedExportTool.inputSchema,
        async (args) => enhancedExportTool.execute(args, context),
      );
      server.registerTool(
        cacheStatsTool.name,
        cacheStatsTool.inputSchema,
        async (args) => cacheStatsTool.execute(args, context),
      );
      server.registerTool(
        cacheClearTool.name,
        cacheClearTool.inputSchema,
        async (args) => cacheClearTool.execute(args, context),
      );
      server.registerTool(
        healthTool.name,
        healthTool.inputSchema,
        async (args) => healthTool.execute(args, context),
      );
      server.registerTool(
        nodeStatusTool.name,
        nodeStatusTool.inputSchema,
        async (args) => nodeStatusTool.execute(args, context),
      );
      server.registerTool(
        deepResearchTool.name,
        deepResearchTool.inputSchema,
        async (args) => deepResearchTool.execute(args, context),
      );

      // Register Resources and Prompts
      registerResources(server);
      registerPrompts(server);

      res.on("close", () => transport.close());

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    const port = flags.port || config.port;
    app
      .listen(port, () => {
        logger.info(`MCP Server (HTTP) on http://localhost:${port}/mcp`);
      })
      .on("error", (error) => {
        logger.error("Server error:", error);
        process.exit(1);
      });
  } catch (error) {
    logger.error("Failed to start the server:", error);
    process.exit(1);
  }
};

main();
