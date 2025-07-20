import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PresearchApiClient } from "../api/api-client.js";
import { PresearchServerConfig, ConfigType } from "../config/presearch-server-config.js";
import { logger } from "../utils/logger.js";

export class PresearchServer {
  private server: McpServer;
  private config: PresearchServerConfig;
  private apiClient: PresearchApiClient | null = null;
  
  private isInitialized = false;
  private listening = false;

  constructor(config?: PresearchServerConfig) {
    this.config = config || new PresearchServerConfig();
    this.server = new McpServer({
      port: 3000,
      name: "presearch-mcp-server",
      version: "3.0.0",
    });
  }

  public async stop(): Promise<void> {
    if (this.listening) {
      await this.server.close();
      this.listening = false;
      logger.info("Presearch MCP Server stopped.");
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info("Initializing Presearch MCP Server...");

    this.server.registerTool(
      "presearch_search",
      {
        title: "Presearch Search",
        description: "Performs a web search using the Presearch engine with comprehensive filtering options.",
        inputSchema: {
          query: z.string().min(1, "Query must be a non-empty string"),
          page: z.number().int().positive().optional(),
          resultsPerPage: z.number().int().min(1).max(50).optional(),
          lang: z.string().optional(),
          time: z.enum(["any", "day", "week", "month", "year"]).optional(),
          location: z.string().optional(),
          ip: z.string().optional(),
          safe: z.enum(["0", "1"]).optional(),
        },
      },
      this.handleSearchTool.bind(this)
    );

    this.isInitialized = true;
    logger.info("Presearch MCP Server initialized.");
  }

  public updateConfig(newConfig: Partial<PresearchServerConfig>): void {
    this.config.updateConfig(newConfig as Partial<ConfigType>);
    logger.info("Server configuration updated.");
    // Re-initialize components that depend on config
    this.apiClient = new PresearchApiClient(this.config);
  }

  private async lazyInitializeComponents(): Promise<void> {
    if (!this.apiClient) {
      this.apiClient = new PresearchApiClient(this.config);
    }
  }



  public async handleSearchTool(args: Record<string, unknown>) {
    try {


      // Validate arguments using Zod
      const schema = z.object({
        query: z.string().min(1, "Query must be a non-empty string"),
        page: z.number().int().positive().optional(),
        resultsPerPage: z.number().int().min(1).max(50).optional().default(10),
        lang: z.string().optional(),
        time: z.enum(["any", "day", "week", "month", "year"]).optional(),
        location: z.string().optional(),
        ip: z.string().optional(),
        safe: z.enum(["0", "1"]).optional(),
      });

      const validated = schema.parse(args);
      const { resultsPerPage } = validated;

      await this.lazyInitializeComponents();

      if (!this.config.getApiKey()) {
        throw new Error("API key is required for search execution. Please configure PRESEARCH_API_KEY environment variable.");
      }

      if (!this.apiClient) {
        throw new Error("API client not initialized");
      }

      const searchRequest = {
        q: validated.query,
        page: validated.page,
        ...(validated.lang && { lang: validated.lang }),
        ...(validated.time && { time: validated.time }),
        ...(validated.location && { location: validated.location }),
        ...(validated.ip && { ip: validated.ip }),
        ...(validated.safe && { safe: validated.safe }),
      };

      const searchResponse = await this.apiClient.search(searchRequest);

      if (searchResponse.results && searchResponse.results.length > resultsPerPage) {
        searchResponse.results = searchResponse.results.slice(0, resultsPerPage);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(searchResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Search tool execution failed", {
        query: args.query,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: error instanceof Error ? error.message : "An unknown error occurred",
          },
        ],
        isError: true,
      };
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    this.listening = true;
    logger.info("Presearch MCP Server started successfully");
  }

  getServer(): McpServer {
    return this.server;
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down Presearch MCP Server...");
    try {
      await this.server.close();
      logger.info("Presearch MCP Server shut down gracefully.");
    } catch (error) {
      logger.error("Error during server shutdown", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.listening = false;
    }
  }
}
