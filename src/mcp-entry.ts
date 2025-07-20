#!/usr/bin/env node
/**
 * FIXED: Dedicated MCP stdio entry point
 * This file provides a proper MCP server that communicates via stdio
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PresearchServer } from "./server/presearch-mcp-server.js";
import { createConfigFromEnv } from "./config/presearch-server-config.js";

/**
 * Main entry point for MCP stdio server
 */
async function main() {
  try {
    console.error("Starting Presearch MCP Server...");

    // Create configuration from environment
    const config = createConfigFromEnv();

    // Create the Presearch server instance
    const presearchServer = new PresearchServer(config);

    // Initialize the server BEFORE connecting
    await presearchServer.initialize();

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect the server to the transport AFTER initialization
    await presearchServer.getServer().connect(transport);

    console.error("Presearch MCP Server started successfully");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Received SIGINT, shutting down gracefully...");
      await presearchServer.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.error("Received SIGTERM, shutting down gracefully...");
      await presearchServer.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start Presearch MCP Server:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
