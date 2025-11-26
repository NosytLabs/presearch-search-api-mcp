import { apiClient } from "../core/apiClient.js";
import { loadConfig } from "../core/config.js";

export function registerResources(server) {
  // Config Resource
  server.resource("config", "presearch://config", async (uri) => {
    const config = loadConfig();
    // Mask secrets
    const safeConfig = { ...config, apiKey: "***" };
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(safeConfig, null, 2),
        },
      ],
    };
  });

  // Rate Limit Resource
  server.resource("rate-limits", "presearch://limits", async (uri) => {
    const stats = apiClient.getRateLimitStats();
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  });
}
