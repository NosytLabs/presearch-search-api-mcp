import axios from "axios";
import {
  withErrorHandling,
  NetworkError,
  ValidationError,
} from "../utils/errors.js";
import logger from "../core/logger.js";

// JSON Schema for MCP compatibility
const NodeStatusInputSchema = {
  type: "object",
  properties: {
    node_id: {
      type: "string",
      description: "Specific Node ID or public key to query. Optional.",
    },
  },
};

const tool = {
  name: "presearch_node_status",
  description: "Monitor Presearch network node health and performance metrics.",
  inputSchema: NodeStatusInputSchema,
  tags: ["system", "node"],
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
      return {
        success: false,
        error:
          "Node API key is required. Provide node_api_key parameter or set PRESEARCH_NODE_API_KEY environment variable.",
        data: null,
      };
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
