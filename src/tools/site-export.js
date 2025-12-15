import { z } from "zod";
import { presearchService } from "../services/presearchService.js";
import { contentFetcher } from "../services/contentFetcher.js";

export const siteExportTool = {
  name: "presearch_site_export",
  description:
    "Advanced tool to search, scrape, and format content from a specific site or topic for export.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      format: {
        type: "string",
        enum: ["json", "markdown"],
        default: "markdown",
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    // 1. Search
    const searchResults = await presearchService.search(args.query, {
      limit: 5,
    });

    // 2. Scrape
    const urls = searchResults.results.map((r) => r.url);
    const contents = await Promise.all(
      urls.map((url) => contentFetcher.fetchContent(url)),
    );

    // 3. Format
    let output;
    if (args.format === "json") {
      output = JSON.stringify(contents, null, 2);
    } else {
      output = contents
        .map(
          (c) =>
            `# ${c.title}\nSource: ${c.url}\n\n${c.content?.substring(0, 1000)}...\n\n---\n`,
        )
        .join("\n");
    }

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  },
};
