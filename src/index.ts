#!/usr/bin/env node

import { PresearchServer } from "./server/presearch-mcp-server.js";
import { logger } from "./utils/logger.js";

/**
 * Main entry point for the Presearch MCP Server
 */
async function main(): Promise<void> {
  try {
    logger.info("Starting Presearch MCP Server v3.0.0");

    const server = new PresearchServer();
    await server.start();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully");
      await server.stop();
      process.exit(0);
    });




  } catch (error: any) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
}

main();
