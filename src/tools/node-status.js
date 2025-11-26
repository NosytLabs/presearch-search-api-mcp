import { z } from "zod";
import axios from "axios";
import {
  withErrorHandling,
  NetworkError,
  ValidationError,
} from "../utils/errors.js";
import logger from "../core/logger.js";

const nodeStatusSchema = z.object({
  node_api_key: z
    .string()
    .min(1, "Node API key is required")
    .describe(
      "Your Node API key (found at https://nodes.presearch.com/dashboard)",
    ),
  public_keys: z
    .string()
    .optional()
    .describe("Comma-separated list of node public keys to filter by"),
  start_date: z
    .string()
    .optional()
    .describe("Start date for stats (Y-m-d H:i) - UTC"),
  end_date: z
    .string()
    .optional()
    .describe("End date for stats (Y-m-d H:i) - UTC"),
  stats: z
    .boolean()
    .default(false)
    .describe("Include aggregated historical stats"),
  connected: z
    .boolean()
    .default(true)
    .describe("Include currently connected nodes"),
  disconnected: z
    .boolean()
    .default(true)
    .describe("Include currently disconnected nodes"),
  include_inactive: z
    .boolean()
    .default(false)
    .describe("Include nodes that haven't been active during the timeframe"),
});

const inputSchema = {
  type: "object",
  properties: {
    node_api_key: {
      type: "string",
      description:
        "Your Node API key (found at https://nodes.presearch.com/dashboard)",
    },
    public_keys: {
      type: "string",
      description: "Comma-separated list of node public keys to filter by",
    },
    start_date: {
      type: "string",
      description: "Start date for stats (Y-m-d H:i) - UTC",
    },
    end_date: {
      type: "string",
      description: "End date for stats (Y-m-d H:i) - UTC",
    },
    stats: {
      type: "boolean",
      default: false,
      description: "Include aggregated historical stats",
    },
    connected: {
      type: "boolean",
      default: true,
      description: "Include currently connected nodes",
    },
    disconnected: {
      type: "boolean",
      default: true,
      description: "Include currently disconnected nodes",
    },
    include_inactive: {
      type: "boolean",
      default: false,
      description:
        "Include nodes that haven't been active during the timeframe",
    },
  },
  required: ["node_api_key"],
};

const tool = {
  name: "presearch_node_status",
  description:
    "Get status and statistics for Presearch nodes. Allows monitoring of node health, connectivity, and earnings.",
  inputSchema,
  execute: withErrorHandling("presearch_node_status", async (args, context) => {
    // Validate input
    const parsed = nodeStatusSchema.safeParse(args);
    if (!parsed.success) {
      throw new ValidationError("Invalid arguments", {
        errors: parsed.error.flatten(),
      });
    }
    const { node_api_key, ...params } = parsed.data;

    logger.info("Fetching node status", {
      stats: params.stats,
      connected: params.connected,
    });

    try {
      // Build query parameters
      const queryParams = {
        ...params,
        // API expects 'true'/'false' strings for booleans sometimes, but axios handles booleans usually.
        // The docs say: "true|false". Let's ensure they are passed correctly.
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
