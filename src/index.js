import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createMcpServer } from "./mcp-server.js";
import { loadConfig } from "./core/config.js";
import { registerResources } from "./resources/index.js";
import { apiClient } from "./core/apiClient.js";
import logger from "./core/logger.js";

// Export for library usage
export { registerResources, apiClient, logger };

/**
 * Main entry point
 */
async function main() {
  try {
    const config = loadConfig();
    const server = await createMcpServer(config);

    // Check for PORT environment variable or argument
    const port =
      process.env.PORT ||
      process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1];

    if (port) {
      // HTTP/SSE Mode
      const app = express();
      const transport = new SSEServerTransport("/messages");

      app.get("/sse", async (req, res) => {
        logger.info("New SSE connection established");
        await server.connect(transport);
        await transport.handlePostMessage(req, res);
      });

      app.post("/messages", async (req, res) => {
        logger.debug("Received message via HTTP POST");
        await transport.handlePostMessage(req, res);
      });

      app.listen(port, () => {
        logger.info(
          `Starting Presearch MCP Server via HTTP on port ${port}...`,
        );
        logger.info(`SSE Endpoint: http://localhost:${port}/sse`);
        logger.info(`Messages Endpoint: http://localhost:${port}/messages`);
      });
    } else {
      // Stdio Mode (Default)
      const transport = new StdioServerTransport();
      logger.info("Starting Presearch MCP Server via Stdio...");
      await server.connect(transport);
      logger.info("Server connected and ready.");
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === import.meta.filename) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
