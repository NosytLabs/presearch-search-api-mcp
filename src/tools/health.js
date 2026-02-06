import { apiClient } from "../core/apiClient.js";

export const healthTool = {
  name: "presearch_health_check",
  description: "Check connectivity to Presearch API",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (args, context) => {
    try {
      const requestConfig = { params: { q: "test", limit: 1 } };
      if (context?.apiKey) {
        requestConfig.headers = {
          "Authorization": `Bearer ${context.apiKey}`
        };
      }

      // Simple ping by doing a minimal search
      await apiClient.get("/v1/search", requestConfig);
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
