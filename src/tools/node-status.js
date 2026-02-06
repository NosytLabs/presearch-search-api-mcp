import logger from "../core/logger.js";
import { presearchService } from "../services/presearchService.js";

export const nodeStatusTool = {
  name: "presearch_node_status",
  description: "Check the status of a Presearch node",
  inputSchema: {
    type: "object",
    properties: {
      node_key: { type: "string", description: "Public key of the node" },
    },
    required: ["node_key"],
  },
  execute: async (args, context) => {
    const status = await presearchService.getNodeStatus(args.node_key, { apiKey: context?.apiKey });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  },
};
