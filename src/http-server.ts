import express from "express";
import { createServer, Server } from "http";
import { PresearchServer } from "./server/presearch-mcp-server.js";
import { logger } from "./utils/logger.js";
import { createConfigFromEnv } from "./config/configuration.js";

/**
 * HTTP server wrapper for Smithery deployment
 * Implements Streamable HTTP protocol as required by Smithery
 */
export class PresearchHttpServer {
  private app: express.Application;
  private httpServer: Server;
  private port: number;
  private presearchServer: PresearchServer;

  constructor() {
    this.port = parseInt(process.env.PORT || "3001", 10);
    this.app = express();
    this.app.use(express.json());
    this.httpServer = createServer(this.app);

    // Create a single PresearchServer instance
    const initialConfig = createConfigFromEnv();
    this.presearchServer = new PresearchServer(initialConfig);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.all("/mcp", this.handleMcpRequest.bind(this));
    this.app.get("/", (_req: express.Request, res: express.Response) => {
      res.status(200).json({ message: "Presearch MCP Server is running" });
    });

    // Centralized error handler
    this.app.use((err: Error, _req: express.Request, res: express.Response) => {
      logger.error("An unexpected error occurred", {
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal Server Error",
          data: err.message,
        },
      });
    });
  }

  /**
   * Apply configuration from query parameters to environment variables
   */
  private createConfigFromRequest(
    req: express.Request,
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    const queryConfig = req.query;

    // Prefer API key from Authorization header, fallback to query parameter for backward compatibility
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      config.PRESEARCH_API_KEY = authHeader.substring(7, authHeader.length);
    } else if (queryConfig.apiKey) {
      config.PRESEARCH_API_KEY = queryConfig.apiKey;
    }

    if (queryConfig.baseUrl) config.PRESEARCH_BASE_URL = queryConfig.baseUrl;
    if (queryConfig.requestTimeout)
      config.REQUEST_TIMEOUT = queryConfig.requestTimeout.toString();
    if (queryConfig.maxRetries)
      config.MAX_RETRIES = queryConfig.maxRetries.toString();
    if (queryConfig.rateLimit)
      config.RATE_LIMIT = queryConfig.rateLimit.toString();
    if (queryConfig.cacheTtl)
      config.CACHE_TTL = (Number(queryConfig.cacheTtl) * 1000).toString();
    if (queryConfig.debug)
      config.DEBUG = queryConfig.debug === "true" ? "presearch-mcp" : "";
    return config;
  }

  /**
   * Handle HTTP requests to /mcp endpoint
   */
  private async handleMcpRequest(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    try {
      let mcpRequest;

      if (req.method === "GET") {
        // Handle GET request for tool listing (lazy loading) without config
        mcpRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        };
        const response = await this.processMcpRequest(mcpRequest);
        res.status(200).json(response);
        return;
      } else if (req.method === "POST") {
        // Handle POST request for tool calls with config
        const requestConfig = this.createConfigFromRequest(req);
        await this.presearchServer.updateConfig(requestConfig);
        mcpRequest = req.body;
        const response = await this.processMcpRequest(mcpRequest);
        res.status(200).json(response);
        return;
      } else if (req.method === "DELETE") {
        // Handle DELETE request
        res.status(200).json({
          jsonrpc: "2.0",
          id: 1,
          result: { message: "Server shutdown requested" },
        });
        return;
      } else {
        res.status(405).json({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32601,
            message: "Method not allowed",
            data: `HTTP method ${req.method} is not supported. Use GET for tool listing or POST for tool calls.`,
          },
        });
        return;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process MCP JSON-RPC request
   *
   * Implements Smithery's lazy loading pattern:
   * - tools/list: Returns tool definitions without requiring API key
   * - tools/call: Validates API key and executes tools
   */
  private async processMcpRequest(
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    logger.info("Processing MCP request", {
      method: request.method,
      id: request.id,
      hasParams: !!request.params,
    });

    const { method, params, id } = request;

    if (method === "tools/list") {
      const tools = this.presearchServer.getToolDefinitions();
      return { jsonrpc: "2.0", id, result: { tools } };
    }

    if (method === "tools/call") {
      // Check for required config (e.g., apiKey)
      if (!this.presearchServer.hasApiKey()) {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: "Missing required configuration",
            data: "API key is required for tool calls",
          },
        };
      }

      const toolParams = (params as Record<string, unknown>) || {};
      const { name, arguments: args } = toolParams as {
        name: string;
        arguments: Record<string, unknown>;
      };
      const tool = this.presearchServer.getTool(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = await tool.handler(args || {});
      return { jsonrpc: "2.0", id, result };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    };
  }

  /**
   * Start the HTTP server
   */
  public async start(): Promise<void> {
    try {
      // eslint-disable-next-line no-console
      console.log("Starting Presearch HTTP Server...");
      logger.info("Starting Presearch HTTP Server for Smithery deployment");

      this.httpServer.listen(this.port, () => {
        // eslint-disable-next-line no-console
        console.log(`Server listening on port ${this.port}`);
        logger.info(`Presearch HTTP Server listening on port ${this.port}`);
        logger.info(
          `MCP endpoint available at: http://localhost:${this.port}/mcp`,
        );
      });
      // eslint-disable-next-line no-console
      console.log("Start method completed, server should be running");

      // Handle graceful shutdown
      process.on("SIGINT", () => this.shutdown());
      process.on("SIGTERM", () => this.shutdown());
    } catch (error) {
      logger.error("Failed to start HTTP server", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Shutdown the server gracefully
   */
  private shutdown(): void {
    logger.info("Shutting down HTTP server gracefully");
    if (this.httpServer) {
      this.httpServer.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

(async () => {
  const server = new PresearchHttpServer();
  await server.start();
  // eslint-disable-next-line no-console
  console.log("Server startup complete, process should remain active.");
  // Removed: await new Promise(() => {});
})();
