import { z } from "zod";
import { presearchService } from "../services/presearchService.js";
import { SearchParamsSchema } from "../utils/schemas.js";

export const searchTool = {
  name: "presearch_ai_search",
  description:
    "Execute a privacy-preserving search using Presearch. Returns relevant web results without tracking.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search terms" },
      count: { type: "number", description: "Number of results", default: 10 },
      safesearch: {
        type: "string",
        enum: ["strict", "moderate", "off"],
        default: "moderate",
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    const results = await presearchService.search(args.query, {
      limit: args.count,
      safesearch: args.safesearch,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  },
};
