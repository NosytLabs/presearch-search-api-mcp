import logger from "../core/logger.js";
import { contentAnalysisService } from "../services/contentAnalysisService.js";

export const contentAnalysisTool = {
  name: "analyze_content",
  description: "Analyze text content for keywords, sentiment, and readability",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "Text content to analyze" },
      query: { type: "string", description: "Context query for relevance" },
    },
    required: ["content"],
  },
  execute: async (args) => {
    const analysis = contentAnalyzer.analyze(args.content, args.query || "");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  },
};
