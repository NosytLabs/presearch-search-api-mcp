import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp-server.js";
import { loadConfig } from "./core/config.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { apiClient } from "./core/apiClient.js";
import logger from "./core/logger.js";

// Export for library usage
export { registerPrompts, registerResources, apiClient, logger };

/**
 * Main entry point for standalone execution (stdio)
 */
async function main() {
  try {
    const config = loadConfig();
    const server = await createMcpServer(config);
    const transport = new StdioServerTransport();
    
    logger.info("Starting Presearch MCP Server via Stdio...");
    await server.connect(transport);
    logger.info("Server connected and ready.");
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
