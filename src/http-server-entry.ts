#!/usr/bin/env node

/**
 * Entry point for Smithery HTTP server deployment
 * This file starts the HTTP server for Smithery platform integration
 */

import { PresearchHttpServer } from './http-server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = new PresearchHttpServer();
    await server.start();
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start HTTP server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: String(reason), promise: String(promise) });
  process.exit(1);
});

main().catch((error) => {
  logger.error('Failed to start application', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});