import { apiClient } from "../core/apiClient.js";

export const healthTool = {
  name: "presearch_health_check",
  description: "Check connectivity to Presearch API",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    try {
      // Simple ping by doing a minimal search
      await apiClient.get("/v1/search", { params: { q: "test", limit: 1 } });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "healthy", api: "connected" }),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "unhealthy",
              error: error.message,
            }),
          },
        ],
      };
    }
  },
};
