#/usr/bin/env node

import { PresearchHttpServer } from "./http-server.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./utils/error-handler.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Main entry point for the Presearch MCP Server
 */
async function main(): Promise<void> {
  try {
    logger.info("Starting Presearch MCP Server v3.0.0");

    const httpServer = new PresearchHttpServer();
    await httpServer.start();

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      logger.info("Received SIGINT, shutting down gracefully");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("Received SIGTERM, shutting down gracefully");
      process.exit(0);
    });

    process.on("uncaughtException", (error) => {
      const handledError = errorHandler.handleError(error, {
        operation: "uncaught-exception",
      });
      logger.error("Uncaught exception", { error: handledError.message });
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      const handledError = errorHandler.handleError(reason, {
        operation: "unhandled-rejection",
      });
      logger.error("Unhandled rejection", { error: handledError.message });
      process.exit(1);
    });
  } catch (error) {
    const handledError = errorHandler.handleError(error, {
      operation: "main-startup",
    });
    logger.error("Failed to start server", { error: handledError.message });
    process.exit(1);
  }
}

// Start the server if this file is run directly
// @ts-ignore
const isCJS = typeof require === "function" && require.main === module;
const filename = isCJS ? __filename : fileURLToPath(import.meta.url);
const mainFilename = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const currentFilename = path.resolve(filename);
if (mainFilename && mainFilename === currentFilename) {
  main().catch((error) => {
    const handledError = errorHandler.handleError(error, {
      operation: "main-catch",
    });
    logger.error("Fatal error during startup", { error: handledError.message });
    process.exit(1);
  });
}

// Export for compatibility
export { main };
