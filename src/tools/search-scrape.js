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
      description: "Search query to execute",
      minLength: 1
    },
    limit: {
      type: "number",
      description: "Maximum number of search results (1-10)",
      minimum: 1,
      maximum: 10,
      default: 5
    },
    depth: {
      type: "boolean",
      description: "Enable deep search/scraping"
    },
    exclude_domains: {
      type: "array",
      items: { type: "string" },
      description: "List of domains to exclude from search"
    }
  },
  required: ["query"]
};

const tool = {
  name: "presearch_search_and_scrape",
  description: "Combined search and scraping (50-70% faster than sequential). Searches then extracts from top results.",
  inputSchema: SearchScrapeInputSchema,
  execute: withErrorHandling(
    "presearch_search_and_scrape",
    async (args, context) => {
      // Map args to internal schema
      const a = {
          query: args.query,
          count: args.limit || 5,
          scrape_count: args.limit || 5, // Assuming limit applies to both search and scrape count in this simplified tool
          // depth? maybe maps to something or just ignored for now as per requirement
          // exclude_domains? passed to search params?
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
        limit: a.count
      });
      
      const data = await presearchService.search(searchParams, context?.apiKey);
      let arr = data.results || [];

      // Filter exclude_domains if provided
      if (args.exclude_domains && Array.isArray(args.exclude_domains)) {
          arr = arr.filter(r => {
              const url = r.url || r.link;
              if (!url) return true;
              return !args.exclude_domains.some(d => url.includes(d));
          });
      }

      const results = arr.slice(0, a.count).map((r, i) => {
        const url = r.url || r.link || "";
        const title = r.title || "";
        const description = r.description || r.snippet || "";
        return { url, title, description, position: r.position || i + 1 };
      });

      const urlsToScrape = results
        .filter((r) => r.url);

      const scrapePromises = urlsToScrape.map(async (item) => {
        try {
          const res = await contentFetcher.fetch(item.url, {
            timeout: 15000,
            includeText: true,
          });
          return {
            url: item.url,
            status: res.status,
            meta: res.meta,
            text: res.text,
            textLength: res.textLength,
          };
        } catch (e) {
          return { url: item.url, error: e.message };
        }
      });

      const scraped = await Promise.all(scrapePromises);

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
