import { z } from "zod";
import { presearchService } from "../services/presearchService.js";
import { resultProcessor } from "../services/resultProcessor.js";

export const cacheStatsTool = {
  name: "cache_stats",
  description: "Get statistics about the internal result cache",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(resultProcessor.cache.getMetrics(), null, 2),
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
