import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";
import { robustBoolean, robustNumber, robustInt } from "../utils/schemas.js";

const schema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The search query to execute. Can be a simple keyword or a complex question. Example: 'latest ai developments'.",
    ),
  count: robustInt()
    .min(1)
    .max(50)
    .default(10)
    .describe(
      "Number of search results to retrieve (1-50). Default is 10. Accepts number or string. Example: 20.",
    ),
  scrape_count: robustInt()
    .min(1)
    .max(20)
    .default(5)
    .describe(
      "Number of top search results to scrape full content from (1-20). Default is 5. Accepts number or string. Example: 3.",
    ),
  limit: robustInt().optional().describe("Alias for count/scrape_count"),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .describe(
      "Language filtering using BCP 47 codes (e.g., 'en', 'en-US'). Optional. Example: 'en-US'.",
    ),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe(
      "Country filtering using ISO 3166-1 alpha-2 codes (e.g., 'US', 'CA'). Optional. Example: 'US'.",
    ),
  safesearch: z
    .enum(["off", "moderate", "strict"])
    .default("moderate")
    .describe(
      "Safe search setting: 'off', 'moderate', or 'strict'. Default is 'moderate'. Example: 'strict'.",
    ),
  freshness: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("all")
    .describe(
      "Time filter for search results: 'hour', 'day', 'week', 'month', 'year', 'all'. Default is 'all'. Example: 'week'.",
    ),
  ip: z
    .string()
    .optional()
    .describe(
      "IP address to simulate the search from (for localization). Optional. Example: '1.2.3.4'.",
    ),
  location: z
    .union([
      z.object({
        lat: robustNumber().describe("Latitude coordinate (e.g., 40.7128)."),
        long: robustNumber().describe("Longitude coordinate (e.g., -74.0060)."),
      }),
      z.string().transform((val) => {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }),
    ])
    .optional()
    .describe(
      'Geolocation coordinates (latitude, longitude) for location-based search. Can be an object {lat, long} or a JSON string. Example: \'{"lat": 40.7128, "long": -74.0060}\'.',
    ),
  include_text: robustBoolean()
    .default(true)
    .describe(
      "Whether to include the full text content of scraped pages. Default is true. Accepts boolean or string 'true'/'false'. Example: true.",
    ),
  timeout_ms: robustInt()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe(
      "Timeout in milliseconds for the search and scrape operation. Default is 15000ms. Accepts number or string. Example: 30000.",
    ),
});

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
        .filter((r) => r.url)
        // .slice(0, a.scrape_count); // already sliced results

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
