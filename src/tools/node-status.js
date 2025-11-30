import { z } from "zod";
import axios from "axios";
import {
  withErrorHandling,
  NetworkError,
  ValidationError,
} from "../utils/errors.js";
import logger from "../core/logger.js";
import { robustBoolean } from "../utils/schemas.js";

const nodeStatusSchema = z.object({
  node_api_key: z
    .string()
    .min(1, "Node API key is required")
    .describe(
      "Your Node API key (found at https://nodes.presearch.com/dashboard). Required to access node statistics. Example: 'your_node_api_key_here'.",
    ),
  public_keys: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of node public keys to filter by (e.g., 'key1,key2'). Leave empty to fetch all nodes.",
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start date for stats (Y-m-d H:i) - UTC. Example: '2023-01-01 00:00'.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End date for stats (Y-m-d H:i) - UTC. Example: '2023-01-31 23:59'.",
    ),
  stats: robustBoolean()
    .default(false)
    .describe(
      "Include aggregated historical stats (earnings, uptime) in the response. Default is false. Accepts boolean or string 'true'/'false'. Example: true.",
    ),
  connected: robustBoolean()
    .default(true)
    .describe(
      "Include currently connected nodes in the list. Default is true. Accepts boolean or string 'true'/'false'. Example: true.",
    ),
  disconnected: robustBoolean()
    .default(true)
    .describe(
      "Include currently disconnected nodes in the list. Default is true. Accepts boolean or string 'true'/'false'. Example: true.",
    ),
  include_inactive: robustBoolean()
    .default(false)
    .describe(
      "Include nodes that haven't been active during the timeframe (useful for historical audits). Default is false. Accepts boolean or string 'true'/'false'. Example: false.",
    ),
});

// JSON Schema for MCP compatibility
const NodeStatusInputSchema = {
  type: "object",
  properties: {
    node_id: {
      type: "string",
      description: "Specific Node ID or public key to query. Optional."
    }
  }
};

const tool = {
  name: "presearch_node_status",
  description: "Monitor Presearch network node health and performance metrics.",
  inputSchema: NodeStatusInputSchema,
  execute: withErrorHandling("presearch_node_status", async (rawArgs) => {
    const internalArgs = { ...rawArgs };
    
    // Handle aliases
    if (internalArgs.node_id && !internalArgs.public_keys) {
        internalArgs.public_keys = internalArgs.node_id;
    }
    
    // If node_api_key is missing, try env
    if (!internalArgs.node_api_key) {
         internalArgs.node_api_key = process.env.PRESEARCH_NODE_API_KEY;
    }
    
    // Validate that we have an API key
    if (!internalArgs.node_api_key) {
        throw new ValidationError("Node API key is required. Provide node_api_key parameter or set PRESEARCH_NODE_API_KEY environment variable.");
    }
    
    const { node_api_key, ...params } = internalArgs;

    logger.info("Fetching node status", {
      stats: params.stats,
      connected: params.connected,
    });

    try {
      // Build query parameters
      const queryParams = {
        ...params,
      };

      const response = await axios.get(
        `https://nodes.presearch.com/api/nodes/status/${node_api_key}`,
        {
          params: queryParams,
          timeout: 10000,
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.data.success) {
        throw new NetworkError("Node API returned unsuccessful response", {
          data: response.data,
        });
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new ValidationError("Invalid Node API Key");
        }
        throw new NetworkError(`Node API request failed: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }),
};

export default tool;
export { tool as nodeStatusTool };
