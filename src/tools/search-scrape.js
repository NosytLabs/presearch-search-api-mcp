import { z } from "zod";
import { presearchService } from "../services/presearchService.js";
import { contentFetcher } from "../services/contentFetcher.js";

export const searchAndScrapeTool = {
  name: "presearch_search_and_scrape",
  description:
    "Search for a query and immediately scrape the content of the top results. Best for getting direct answers.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: {
        type: "number",
        description: "Number of pages to scrape (max 3)",
        default: 3,
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    // 1. Search
    const searchResults = await presearchService.search(args.query, {
      limit: Math.min(args.limit || 3, 5),
    });

    // 2. Scrape top N results in parallel
    const urlsToScrape = searchResults.results
      .slice(0, args.limit || 3)
      .map((r) => r.url);
    const scrapedContent = await Promise.all(
      urlsToScrape.map((url) => contentFetcher.fetchContent(url)),
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              search_summary: searchResults.metadata,
              scraped_data: scrapedContent,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
