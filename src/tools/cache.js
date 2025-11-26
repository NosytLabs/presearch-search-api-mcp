import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import { withErrorHandling } from "../utils/errors.js";

export const cacheStatsSchema = z.object({}).describe("No parameters required");

export const cacheStatsTool = {
  name: "cache_stats",
  description:
    "Returns cache statistics including hit rate, entry count, and performance metrics for monitoring cache effectiveness.",
  inputSchema: cacheStatsSchema,
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

export const cacheClearSchema = z.object({}).describe("No parameters required");

export const cacheClearTool = {
  name: "cache_clear",
  description:
    "Clears the cache to free memory and ensure fresh data retrieval. Use when cache becomes stale or needs reset.",
  inputSchema: cacheClearSchema,
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
