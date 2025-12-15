import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";
import { prompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import logger from "./core/logger.js";
import { formatToolList, formatPromptList } from "./utils/mcp-helpers.js";

/**
 * Creates and configures the MCP server instance
 * @param {Object} globalConfig - The global configuration object
 * @param {Object} requestConfig - Optional per-request configuration
 * @returns {Promise<McpServer>} The configured MCP server instance
 */
export const createMcpServer = async (globalConfig, requestConfig = {}) => {
  // Merge global config with request-specific config (like API keys from query params)
  const effectiveConfig = { ...globalConfig, ...requestConfig };
  
  const server = new McpServer({
    name: "presearch-mcp-server",
    description:
      "Privacy-focused MCP server for web search and content export with intelligent caching, rate limiting, and comprehensive Presearch API integration.",
    version: "2.1.6",
  }, {
    capabilities: {
      prompts: { listChanged: true },
      tools: { listChanged: true },
      resources: {},
    }
  });

  // Register tools
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args) => {
         // Pass the effective configuration (including API key) to the tool execution
         return tool.execute(args, { apiKey: effectiveConfig.apiKey });
      }
    );
  }

  // Handle ListToolsRequest manually to support Smithery metadata
  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = formatToolList(tools);
    logger.debug("Listing tools for client", { count: toolList.length });
    return { tools: toolList };
  });
  
  // Handle ListPromptsRequest manually to support Smithery metadata
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const promptList = formatPromptList(prompts);
    logger.debug("Listing prompts for client", { count: promptList.length });
    return { prompts: promptList };
  });

  // Handle GetPromptRequest
  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const prompt = prompts.find((p) => p.name === promptName);

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    const args = request.params.arguments || {};
    
    // Validate arguments if prompt has requirements
    if (prompt.arguments && prompt.arguments.length > 0) {
        // Simple validation for required arguments
        for (const arg of prompt.arguments) {
            if (arg.required && !args[arg.name]) {
                throw new Error(`Missing required argument: ${arg.name}`);
            }
        }
    }

    const promptResult = prompt.handler(args);

    const title = prompt.title || (prompt.annotations && prompt.annotations.title) || prompt.name;

    return {
      name: prompt.name,
      title,
      description: prompt.description,
      arguments: prompt.arguments,
      annotations: prompt.annotations || { title },
      messages: promptResult.messages,
    };
  });

  registerResources(server);
  
  return server;
};
