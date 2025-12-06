import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import { withErrorHandling } from "../utils/errors.js";

const cacheStatsSchema = {
  type: "object",
  properties: {},
  description: "No parameters required",
};

export const cacheStatsTool = {
  name: "cache_stats",
  description:
    "Retrieve cache performance metrics: hits, misses, size, and entry count.",
  inputSchema: cacheStatsSchema,
  tags: ["system", "cache"],
  execute: withErrorHandling("cache_stats", async () => {
    logger.info("Retrieving cache statistics");
    const stats = apiClient.getCacheStats();
    return {
      success: true,
      stats: {
        enabled: stats.enabled,
        keys: stats.keys || 0,
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        ksize: stats.ksize || 0,
        vsize: stats.vsize || 0,
      },
      message: "Cache statistics retrieved successfully",
    };
  }),
};

const cacheClearSchema = {
  type: "object",
  properties: {},
  description: "No parameters required",
};

export const cacheClearTool = {
  name: "cache_clear",
  description:
    "Clear all cached data and reset statistics for fresh data collection.",
  inputSchema: cacheClearSchema,
  tags: ["system", "cache"],
  execute: withErrorHandling("cache_clear", async () => {
    logger.info("Clearing cache");
    const beforeStats = apiClient.getCacheStats();
    apiClient.clearCache();
    logger.info("Cache cleared successfully", {
      beforeKeys: beforeStats.keys,
    });
    return {
      success: true,
      message: `Cache cleared successfully. Removed ${beforeStats.keys || 0} entries.`,
      clearedEntries: beforeStats.keys || 0,
    };
  }),
};
