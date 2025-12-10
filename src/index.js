import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import path from "path";
import {
  searchTool,
  contentAnalysisTool,
  exportResultsTool,
  scrapeTool,
  searchAndScrapeTool,
  siteExportTool,
  cacheStatsTool,
  cacheClearTool,
  healthTool,
  nodeStatusTool,
  deepResearchTool,
} from "./tools/index.js";

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
    logger.info("🚀 Starting Presearch MCP Server v2.1.4");
    logger.info(
      "📡 Connecting to Presearch API with Bearer OAuth authentication",
    );

    const config = await loadConfig();
    const flags = parseArgs();

    // Enhanced startup logging
    if (config.apiKey) {
      logger.info("✅ Presearch API key configured");
    } else {
      logger.warn(
        "⚠️  No Presearch API key configured. Some features may be limited.",
      );
      logger.info("💡 Get your free API key at: https://presearch.com/");
    }

    logger.info(`🔧 Server configuration:`, {
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimit: config.rateLimit,
      cache: config.cache.enabled ? "enabled" : "disabled",
      port: flags.port || config.port,
      transport: flags.stdio ? "stdio" : "http",
    });

    const createMcpServer = async () => {
      const server = new McpServer({
        name: "presearch-mcp-server",
        description:
          "Privacy-focused MCP server for web search and content export with intelligent caching, rate limiting, and comprehensive Presearch API integration.",
        version: "2.1.5",
      });

      const tools = [
        searchTool,
        contentAnalysisTool,
        exportResultsTool,
        scrapeTool,
        searchAndScrapeTool,
        siteExportTool,
        cacheStatsTool,
        cacheClearTool,
        healthTool,
        nodeStatusTool,
        deepResearchTool,
      ];

      for (const tool of tools) {
        server.tool(
          tool.name,
          tool.description,
          tool.inputSchema,
          async (args) => tool.execute(args),
        );
      }

      registerResources(server);
      registerPrompts(server);

      return server;
    };

    if (flags.stdio) {
      const server = await createMcpServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("✅ Presearch MCP Server running on stdio");
    } else {
      const app = express();
      const port = flags.port || config.port || 3002;

      // Enable JSON parsing for POST bodies
      app.use(express.json());

      // CORS Middleware
      app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Authorization",
        );
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS",
        );
        if (req.method === "OPTIONS") {
          return res.sendStatus(200);
        }
        next();
      });

      // Serve MCP Config for Smithery
      app.get("/.well-known/mcp-config", (req, res) => {
        res.sendFile(path.join(process.cwd(), "mcp-config.json"));
      });

      // Request logging middleware
      app.use((req, res, next) => {
        logger.info(`Incoming request: ${req.method} ${req.url}`, {
          headers: req.headers,
        });
        next();
      });

      // Middleware to fix Accept header for MCP clients that don't send strict headers
      app.use((req, res, next) => {
        if (req.path === "/mcp" || req.path === "/mcp/") {
          const accept = req.headers.accept || "";
          const needsEventStream = !accept.includes("text/event-stream");
          const needsJson = !accept.includes("application/json");

          if (needsEventStream || needsJson) {
            let newAccept = accept;
            if (needsEventStream) {
              newAccept = newAccept
                ? `${newAccept}, text/event-stream`
                : "text/event-stream";
            }
            if (needsJson) {
              newAccept = newAccept
                ? `${newAccept}, application/json`
                : "application/json";
            }
            req.headers.accept = newAccept;
            logger.info(`Patched Accept header for /mcp: ${newAccept}`);
          }
        }
        next();
      });

      app.get("/", (req, res) => {
        res.json({ status: "online", service: "presearch-mcp-server" });
      });

      app.get("/health", async (req, res) => {
        const status = await healthTool.execute({});
        res.json(status);
      });

      // Store active sessions: sessionId -> { server, transport }
      const sessions = new Map();

      app.get("/sse", async (req, res) => {
        logger.info("New SSE connection initiated");
        const transport = new SSEServerTransport("/messages", res);
        const sessionId = transport.sessionId;

        const server = await createMcpServer();
        sessions.set(sessionId, { server, transport });

        transport.on("close", async () => {
          sessions.delete(sessionId);
          await server.close();
          logger.info(`SSE connection closed for session ${sessionId}`);
        });

        await server.connect(transport);
      });

      app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId) {
          return res.status(400).send("Missing sessionId query parameter");
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return res.status(404).send("Session not found");
        }

        await session.transport.handlePostMessage(req, res);
      });

      // Proper HTTP-based MCP endpoint using StreamableHTTPServerTransport
      app.post("/mcp", async (req, res) => {
        logger.info("Received POST to /mcp", { body: req.body });

        const server = await createMcpServer();
        try {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });

          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);

          res.on("close", () => {
            logger.info("MCP HTTP request closed");
            transport.close();
            server.close();
          });
        } catch (error) {
          logger.error("Error handling MCP HTTP request:", error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: "Internal server error",
                data: error.message,
              },
              id: req.body?.id || null,
            });
          }
        }
      });

      // Catch-all for 404s to help debugging
      app.use((req, res) => {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
        res.status(404).send(`Cannot ${req.method} ${req.url}`);
      });

      app.listen(port, () => {
        logger.info(
          `✅ Presearch MCP Server running on http://localhost:${port}/sse`,
        );
      });
    }
  } catch (error) {
    logger.error("Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

main();
