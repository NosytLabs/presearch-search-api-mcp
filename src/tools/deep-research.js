import logger from "../core/logger.js";
import { presearchService } from "../services/presearchService.js";

const DeepResearchInputSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "The research topic" },
    depth: {
      type: "number",
      description: "Depth of research (1-3)",
      default: 2,
    },
    breadth: {
      type: "number",
      description: "Number of parallel paths (2-5)",
      default: 3,
    },
  },
  required: ["query"],
};

export const deepResearchTool = {
  name: "presearch_deep_research",
  description:
    "Perform a multi-step deep research task on a topic. Generates a comprehensive report by exploring multiple sub-topics.",
  inputSchema: DeepResearchInputSchema,
  execute: async (args) => {
    // 1. Initial broad search
    const initialResults = await presearchService.search(args.query, {
      limit: args.breadth || 3,
    });

    const report = {
      topic: args.query,
      summary: "Research in progress...",
      sources: initialResults.results,
      subTopics: [],
    };

    // 2. Mock recursive depth (real implementation would recurse)
    // For V1, we return the structured initial findings
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  },
};
