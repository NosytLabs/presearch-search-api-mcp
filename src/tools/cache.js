import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";

const ClaudeCacheStatsSchema = {
  name: "cache_stats",
  description:
    "Returns cache statistics including hit rate, entry count, and performance metrics for monitoring cache effectiveness.",
  inputSchema: {
    type: "object",
    properties: {},
    description: "No parameters required.",
  },
};

const ClaudeCacheClearSchema = {
  name: "cache_clear",
  description:
    "Clears the cache to free memory and ensure fresh data retrieval. Use when cache becomes stale or needs reset.",
  inputSchema: {
    type: "object",
    properties: {},
    description: "No parameters required.",
  },
};

export const cacheStatsSchema = z.object({});

export const cacheStatsTool = {
  name: ClaudeCacheStatsSchema.name,
  description: ClaudeCacheStatsSchema.description,
  inputSchema: cacheStatsSchema,
  execute: async (args, context) => {
    try {
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
    } catch (error) {
      logger.error("Failed to retrieve cache statistics", {
        error: error.message,
      });
      throw new Error(`Failed to retrieve cache statistics: ${error.message}`);
    }
  },
};

export const cacheClearSchema = z.object({});

export const cacheClearTool = {
  name: ClaudeCacheClearSchema.name,
  description: ClaudeCacheClearSchema.description,
  inputSchema: cacheClearSchema,
  execute: async (args, context) => {
    try {
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
    } catch (error) {
      logger.error("Failed to clear cache", { error: error.message });
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  },
};
