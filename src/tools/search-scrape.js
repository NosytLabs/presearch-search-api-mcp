import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";

// JSON Schema for MCP compatibility
const SearchScrapeInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query to execute. Supports standard operators.",
      minLength: 1,
    },
    limit: {
      type: "number",
      description:
        "Maximum number of results to search and scrape (1-10). Defaults to 5.",
      minimum: 1,
      maximum: 10,
      default: 5,
    },
    exclude_domains: {
      type: "array",
      items: { type: "string" },
      description: "List of domain names to exclude from the search results.",
    },
  },
  required: ["query"],
};

const tool = {
  name: "presearch_search_and_scrape",
  description:
    "Combined search and scraping (50-70% faster than sequential). Searches then extracts from top results.",
  inputSchema: SearchScrapeInputSchema,
  tags: ["search", "scrape", "web"],
  execute: withErrorHandling(
    "presearch_search_and_scrape",
    async (args, context) => {
      // Map args to internal schema
      const a = {
        query: args.query,
        count: args.limit || 5,
        scrape_count: args.limit || 5,
      };

      // If exclude_domains is supported by presearchService.search, I should pass it.
      // Looking at search.js, it filtered results manually. I might need to do that here too.

      const searchParams = {
        q: a.query,
        page: 1,
        count: 20, // Fetch more to allow filtering
        // depth/exclude_domains might not be direct API params
      };

      logger.info("Search & scrape starting", {
        query: a.query,
        limit: a.count,
      });

      const data = await presearchService.search(searchParams, context?.apiKey);
      let arr = data.results || [];

      // Filter exclude_domains if provided
      if (args.exclude_domains && Array.isArray(args.exclude_domains)) {
        arr = arr.filter((r) => {
          const url = r.url || r.link;
          if (!url) return true;
          return !args.exclude_domains.some((d) => url.includes(d));
        });
      }

      const results = arr.slice(0, a.count).map((r, i) => {
        const url = r.url || r.link || "";
        const title = r.title || "";
        const description = r.description || r.snippet || "";
        return { url, title, description, position: r.position || i + 1 };
      });

      const urlsToScrape = results.filter((r) => r.url).map((r) => r.url);

      logger.info("Scraping urls", { count: urlsToScrape.length });

      const batchResults = await contentFetcher.fetchBatchSmart(urlsToScrape, {
        timeout: 15000,
        includeText: true,
        concurrency: 5,
      });

      const scraped = batchResults.results.map((res) => {
        if (res.success) {
          return {
            url: res.url,
            status: res.data.status,
            meta: res.data.meta,
            text: res.data.text,
            textLength: res.data.textLength,
          };
        } else {
          return { url: res.url, error: res.error };
        }
      });

      return {
        success: true,
        query: a.query,
        result_count: results.length,
        results,
        scraped,
        metadata: {
          rateLimit: apiClient.getRateLimitStats(),
        },
      };
    },
  ),
};

export default tool;
export { tool as searchAndScrapeTool };
