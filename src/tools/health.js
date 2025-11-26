import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import { withErrorHandling } from "../utils/errors.js";

const inputSchema = z.object({}).describe("No parameters required");

const tool = {
  name: "presearch_health_check",
  description:
    "Checks reachability and authentication status of the Presearch API.",
  inputSchema,
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
