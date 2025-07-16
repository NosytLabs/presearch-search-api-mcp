import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { PresearchMcpServer } from "./server/presearch-mcp-server.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./utils/error-handler.js";
import { Configuration } from "./config/configuration.js";

/**
 * HTTP server wrapper for the Presearch MCP Server
 * Provides HTTP endpoints for MCP protocol communication
 */
export class PresearchHttpServer {
  private server?: ReturnType<typeof createServer>;
  private presearchServer: PresearchMcpServer;
  private port: number;
  private isInitialized = false;

  constructor(port?: number) {
    this.port = port || parseInt(process.env.PORT || "3001", 10);
    this.presearchServer = new PresearchMcpServer();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    try {
      // Initialize the MCP server first
      await this.presearchServer.initialize();
      this.isInitialized = true;
      
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          const handledError = errorHandler.handleError(error, {
            operation: "http-request",
            context: { url: req.url, method: req.method },
          });
          logger.error("Request handling failed", {
            error: handledError.message,
            url: req.url,
            method: req.method,
          });
          this.sendErrorResponse(res, 500, "Internal Server Error");
        });
      });

      this.server.listen(this.port, () => {
        logger.info(`Presearch MCP HTTP Server started on port ${this.port}`);
        logger.info(`MCP endpoint available at: http://localhost:${this.port}/mcp`);
        logger.info(`Health check available at: http://localhost:${this.port}/health`);
      });

      this.server.on("error", (error) => {
        const handledError = errorHandler.handleError(error, {
          operation: "http-server-error",
        });
        logger.error("HTTP server error", { error: handledError.message });
      });
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        operation: "http-server-start",
      });
      logger.error("Failed to start HTTP server", {
        error: handledError.message,
      });
      throw handledError;
    }
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          const handledError = errorHandler.handleError(error, {
            operation: "http-server-stop",
          });
          logger.error("Error stopping HTTP server", {
            error: handledError.message,
          });
          reject(handledError);
        } else {
          logger.info("HTTP server stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    logger.debug("Handling request", {
      method: req.method,
      pathname,
      query: Object.fromEntries(url.searchParams),
    });

    try {
      if (pathname === "/health") {
        await this.handleHealthCheck(req, res);
      } else if (pathname === "/mcp") {
        await this.handleMcpRequest(req, res);
      } else {
        this.sendErrorResponse(res, 404, "Not Found");
      }
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        operation: "request-routing",
        context: { pathname, method: req.method },
      });
      logger.error("Request routing failed", {
        error: handledError.message,
        pathname,
        method: req.method,
      });
      this.sendErrorResponse(res, 500, "Internal Server Error");
    }
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      server: "presearch-mcp-server",
      version: "3.0.0",
      initialized: this.isInitialized,
    };

    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * Handle MCP protocol requests
   */
  private async handleMcpRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    if (!this.isInitialized) {
      this.sendErrorResponse(res, 503, "Server not initialized");
      return;
    }

    if (req.method === "GET") {
      // GET request - return available tools
      const tools = await this.presearchServer.listTools();
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify(tools, null, 2));
      return;
    }

    if (req.method === "POST") {
      // POST request - handle MCP protocol messages
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const mcpRequest = JSON.parse(body);
          
          // Skip configuration update for tools/list requests
          if (mcpRequest.method !== "tools/list") {
            // Update configuration from request parameters if provided
            const url = new URL(req.url || "/", `http://${req.headers.host}`);
            const config = this.extractConfigFromParams(url.searchParams);
            if (Object.keys(config).length > 0) {
              await this.presearchServer.updateConfiguration(config);
            }
          }

          const response = await this.presearchServer.handleRequest(mcpRequest);
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify(response));
        } catch (error) {
          const handledError = errorHandler.handleError(error, {
            operation: "mcp-request-processing",
            context: { body: body.substring(0, 200) },
          });
          logger.error("MCP request processing failed", {
            error: handledError.message,
            body: body.substring(0, 200),
          });
          this.sendErrorResponse(res, 400, "Bad Request");
        }
      });
      return;
    }

    this.sendErrorResponse(res, 405, "Method Not Allowed");
  }

  /**
   * Extract configuration from URL parameters
   */
  private extractConfigFromParams(params: URLSearchParams): Partial<Configuration> {
    const config: Partial<Configuration> = {};

    if (params.has("apiKey")) {
      config.apiKey = params.get("apiKey")!;
    }
    if (params.has("baseUrl")) {
      config.baseUrl = params.get("baseUrl")!;
    }
    if (params.has("requestTimeout")) {
      config.requestTimeout = parseInt(params.get("requestTimeout")!, 10);
    }
    if (params.has("maxRetries")) {
      config.maxRetries = parseInt(params.get("maxRetries")!, 10);
    }
    if (params.has("rateLimit")) {
      config.rateLimit = parseInt(params.get("rateLimit")!, 10);
    }
    if (params.has("cacheTtl")) {
      config.cacheTtl = parseInt(params.get("cacheTtl")!, 10);
    }
    if (params.has("debug")) {
      config.debug = params.get("debug") === "true";
    }

    return config;
  }

  /**
   * Send error response
   */
  private sendErrorResponse(
    res: ServerResponse,
    statusCode: number,
    message: string
  ): void {
    const error = {
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    res.writeHead(statusCode);
    res.end(JSON.stringify(error, null, 2));
  }
}