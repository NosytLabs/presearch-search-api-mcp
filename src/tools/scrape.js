import { z } from "zod";
import { contentFetcher } from "../services/contentFetcher.js";
import { ScrapeSchema } from "../utils/schemas.js";

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
