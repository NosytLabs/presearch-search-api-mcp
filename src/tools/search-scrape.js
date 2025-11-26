import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";
import {
  robustBoolean,
  robustNumber,
  robustInt,
} from "../utils/schemas.js";

const schema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The search query to execute. Can be a simple keyword or a complex question.",
    ),
  count: robustInt()
    .min(1)
    .max(50)
    .default(10)
    .describe(
      "Number of search results to retrieve (1-50). Default is 10. Accepts number or string.",
    ),
  scrape_count: robustInt()
    .min(1)
    .max(20)
    .default(5)
    .describe(
      "Number of top search results to scrape full content from (1-20). Default is 5. Accepts number or string.",
    ),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .describe(
      "Language filtering using BCP 47 codes (e.g., 'en', 'en-US'). Optional.",
    ),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe(
      "Country filtering using ISO 3166-1 alpha-2 codes (e.g., 'US', 'CA'). Optional.",
    ),
  safesearch: z
    .enum(["off", "moderate", "strict"])
    .default("moderate")
    .describe(
      "Safe search setting: 'off', 'moderate', or 'strict'. Default is 'moderate'.",
    ),
  freshness: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("all")
    .describe(
      "Time filter for search results: 'hour', 'day', 'week', 'month', 'year', 'all'. Default is 'all'.",
    ),
  ip: z
    .string()
    .optional()
    .describe(
      "IP address to simulate the search from (for localization). Optional.",
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
      "Geolocation coordinates (latitude, longitude) for location-based search. Can be an object {lat, long} or a JSON string.",
    ),
  include_text: robustBoolean()
    .default(true)
    .describe(
      "Whether to include the full text content of scraped pages. Default is true. Accepts boolean or string 'true'/'false'.",
    ),
  timeout_ms: robustInt()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe(
      "Timeout in milliseconds for the search and scrape operation. Default is 15000ms. Accepts number or string.",
    ),
});

const tool = {
  name: "presearch_search_and_scrape",
  description:
    "Performs a search using the Presearch API and immediately scrapes the content of the top result URLs. Returns combined search results and scraped content (metadata + text) in a single response. Efficient for 'search and summarize' workflows.",
  inputSchema: schema,
  execute: withErrorHandling(
    "presearch_search_and_scrape",
    async (args, context) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success)
        return { success: false, error: parsed.error.message };
      const a = parsed.data;
      const mappedTime =
        a.freshness === "all"
          ? "any"
          : a.freshness === "hour"
            ? "day"
            : a.freshness;
      const searchParams = {
        q: a.query,
        page: 1,
        lang: a.language,
        country: a.country,
        safe: a.safesearch,
        time: mappedTime,
        ...(a.ip ? { ip: a.ip } : {}),
        ...(a.location ? { location: JSON.stringify(a.location) } : {}),
      };
      logger.info("Search & scrape starting", {
        query: a.query,
        count: a.count,
        scrape_count: a.scrape_count,
      });
      const data = await presearchService.search(searchParams, context?.apiKey);
      const arr = data.results || [];
      const results = arr.slice(0, a.count).map((r, i) => {
        const url = r.url || r.link || "";
        const title = r.title || "";
        const description = r.description || r.snippet || "";
        return { url, title, description, position: r.position || i + 1 };
      });

      const urlsToScrape = results
        .filter((r) => r.url)
        .slice(0, a.scrape_count);
      const scraped = [];
      for (const item of urlsToScrape) {
        try {
          const res = await contentFetcher.fetch(item.url, {
            timeout: a.timeout_ms,
            includeText: a.include_text,
          });
          scraped.push({
            url: item.url,
            status: res.status,
            meta: res.meta,
            text: a.include_text ? res.text : undefined,
            textLength: res.textLength,
          });
        } catch (e) {
          scraped.push({ url: item.url, error: e.message });
        }
      }

      return {
        success: true,
        query: a.query,
        result_count: results.length,
        results,
        scraped,
        metadata: {
          infoSection: data?.infoSection || {},
          specialSections: data?.specialSections || {},
          links: data?.links || {},
          meta: data?.meta || {},
          rateLimit: apiClient.getRateLimitStats(),
        },
      };
    },
  ),
};

export default tool;
export { tool as searchAndScrapeTool };
