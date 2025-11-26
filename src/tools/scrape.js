import { z } from "zod";
import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";
import {
  robustBoolean,
  robustInt,
  robustArray,
} from "../utils/schemas.js";

const scrapeSchema = z.object({
  urls: robustArray(z.string().url(), { min: 1 }).describe(
    "List of URLs to scrape content from. Can be a single URL string or an array of URL strings. Must be valid absolute URLs (e.g., 'https://example.com'). Accepts JSON string or comma-separated list.",
  ),
  include_text: robustBoolean()
    .default(true)
    .describe(
      "Whether to extract and include the visible text content from the page. Set to false if you only need metadata. Accepts boolean or string 'true'/'false'.",
    ),
  include_meta: robustBoolean()
    .default(true)
    .describe(
      "Whether to extract and include metadata (title, description, keywords, author, etc.). Accepts boolean or string 'true'/'false'.",
    ),
  timeout_ms: robustInt()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe(
      "Timeout in milliseconds for the scrape request. Increase for slow-loading sites. Default: 15000ms. Accepts number or string.",
    ),
  max_bytes: robustInt()
    .min(10000)
    .max(5000000)
    .default(500000)
    .describe(
      "Maximum size in bytes to download per URL. Prevents memory issues with large files. Default: 500KB. Accepts number or string.",
    ),
});

const tool = {
  name: "scrape_url_content",
  description:
    "Fetches and parses site content for given URLs, extracting metadata (title, description) and clean text. Supports single or multiple URLs. Returns JSON with status, metadata, and text content for each URL. Useful for summarizing web pages or extracting specific information.",
  inputSchema: scrapeSchema,
  execute: withErrorHandling("scrape_url_content", async (args) => {
    const parsed = scrapeSchema.safeParse(args);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    const a = parsed.data;
    logger.info("Scraping URLs", { count: a.urls.length });
    const out = [];
    for (const url of a.urls) {
      try {
        const res = await contentFetcher.fetch(url, {
          timeout: a.timeout_ms,
          maxBytes: a.max_bytes,
          includeText: a.include_text,
        });
        out.push({
          url,
          status: res.status,
          meta: a.include_meta ? res.meta : undefined,
          text: a.include_text ? res.text : undefined,
          textLength: res.textLength,
        });
      } catch (e) {
        out.push({ url, error: e.message });
      }
    }
    return {
      success: true,
      count: out.length,
      items: out,
      rateLimit: apiClient.getRateLimitStats(),
    };
  }),
};

export default tool;
export { tool as scrapeTool };
