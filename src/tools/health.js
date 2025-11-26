import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import { withErrorHandling } from "../utils/errors.js";

const inputSchema = z.object({});

const tool = {
  name: "presearch_health_check",
  description:
    "Checks reachability and authentication status of the Presearch API.",
  inputSchema: { type: "object", properties: {} },
  execute: withErrorHandling(
    "presearch_health_check",
    async (args, context) => {
      const status = await apiClient.healthCheck(context?.apiKey);
      return { success: true, status };
    },
  ),
};

export default tool;
export { tool as healthTool };
