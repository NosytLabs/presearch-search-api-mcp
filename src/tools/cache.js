import logger from "../core/logger.js";
import { cache } from "../services/presearchService.js";

const CacheStatsSchema = {
  type: "object",
  properties: {},
};

export const cacheStatsTool = {
  name: "cache_stats",
  description: "Get statistics about the internal result cache",
  inputSchema: CacheStatsSchema,
  execute: async () => {
    const stats = cache.getMetrics();
    logger.debug("Cache stats requested", stats);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  },
};

export const cacheClearTool = {
  name: "cache_clear",
  description: "Clear the internal result cache",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    resultProcessor.cache.clear();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "success", message: "Cache cleared" }),
        },
      ],
    };
  },
};
