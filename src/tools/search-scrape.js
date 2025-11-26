import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";

const schema = z.object({
  query: z.string().min(1),
  count: z.number().int().min(1).max(50).default(10),
  scrape_count: z.number().int().min(1).max(20).default(5),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  safesearch: z.enum(["off", "moderate", "strict"]).default("moderate"),
  freshness: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("all"),
  ip: z.string().optional(),
  location: z.object({ lat: z.number(), long: z.number() }).optional(),
  include_text: z.boolean().default(true),
  timeout_ms: z.number().int().min(1000).max(60000).default(15000),
});

const inputSchema = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 1 },
    count: { type: "number", minimum: 1, maximum: 50, default: 10 },
    scrape_count: { type: "number", minimum: 1, maximum: 20, default: 5 },
    language: { type: "string", pattern: "^[a-z]{2}(-[A-Z]{2})?$" },
    safesearch: {
      type: "string",
      enum: ["off", "moderate", "strict"],
      default: "moderate",
    },
    freshness: {
      type: "string",
      enum: ["hour", "day", "week", "month", "year", "all"],
      default: "all",
    },
    ip: { type: "string" },
    location: {
      type: "object",
      properties: { lat: { type: "number" }, long: { type: "number" } },
    },
    include_text: { type: "boolean", default: true },
    timeout_ms: {
      type: "number",
      minimum: 1000,
      maximum: 60000,
      default: 15000,
    },
  },
  required: ["query"],
};

const tool = {
  name: "presearch_search_and_scrape",
  description:
    "Runs a Presearch query and scrapes the top result URLs for metadata and text.",
  inputSchema,
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
