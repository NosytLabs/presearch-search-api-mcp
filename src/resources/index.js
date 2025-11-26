import { apiClient } from "../core/apiClient.js";
import { loadConfig } from "../core/config.js";

export function registerResources(server) {
  // Config Resource
  server.resource(
    "config",
    "presearch://config",
    {
      description:
        "Current server configuration (secrets masked). Useful for debugging environment settings.",
    },
    async (uri) => {
      const config = loadConfig();
      // Mask secrets
      const safeConfig = { ...config, apiKey: "********" };
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(safeConfig, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  // Rate Limits Resource
  server.resource(
    "rate-limits",
    "presearch://rate-limits",
    {
      description:
        "Current API rate limit status (requests remaining, reset time). Check this if tools are failing with 429 errors.",
    },
    async (uri) => {
      const stats = apiClient.getRateLimitStats();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(stats, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );
}
