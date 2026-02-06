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
    
    // Check for PORT environment variable or argument
    const port = process.env.PORT || process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1];
    
    if (port) {
      // HTTP/SSE Mode
      const app = express();

      // Store active sessions: sessionId -> { transport, server }
      const sessions = new Map();
      
      app.get("/sse", async (req, res) => {
        logger.info("New SSE connection established");

        // Create a new transport for this connection, passing the response object
        const transport = new SSEServerTransport("/messages", res);

        // Create a new server instance for this connection
        const server = await createMcpServer(config);

        await server.connect(transport);

        // Store session
        sessions.set(transport.sessionId, { transport, server });

        // Clean up on close
        res.on('close', async () => {
            logger.info(`SSE connection closed: ${transport.sessionId}`);
            sessions.delete(transport.sessionId);
            await server.close();
        });

        // server.connect(transport) already calls transport.start()
      });
      
      app.post("/messages", async (req, res) => {
        logger.debug("Received message via HTTP POST");

        const sessionId = req.query.sessionId;
        if (!sessionId) {
            res.status(400).send("Missing sessionId parameter");
            return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
            res.status(404).send("Session not found");
            return;
        }

        await session.transport.handlePostMessage(req, res);
      });
      
      app.listen(port, () => {
        logger.info(`Starting Presearch MCP Server via HTTP on port ${port}...`);
        logger.info(`SSE Endpoint: http://localhost:${port}/sse`);
        logger.info(`Messages Endpoint: http://localhost:${port}/messages`);
      });
    } else {
      // Stdio Mode (Default)
      const server = await createMcpServer(config);
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
