import logger from "../core/logger.js";
import { contentFetcher } from "../services/contentFetcher.js";

export const scrapeTool = {
  name: "scrape_url_content",
  description: "Scrape text content from a specific URL",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to scrape" },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const result = await contentFetcher.fetchContent(args.url);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
