import { z } from "zod";
import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";

const scrapeSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  include_text: z.boolean().default(true),
  include_meta: z.boolean().default(true),
  timeout_ms: z.number().int().min(1000).max(60000).default(15000),
  max_bytes: z.number().int().min(10000).max(2000000).default(500000),
});

const scrapeInputSchema = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string", format: "uri" },
      minItems: 1,
      description:
        "List of URLs to scrape content from. Must be valid absolute URLs.",
    },
    include_text: {
      type: "boolean",
      default: true,
      description:
        "Whether to extract and include the visible text content from the page.",
    },
    include_meta: {
      type: "boolean",
      default: true,
      description:
        "Whether to extract and include metadata (title, description, keywords, etc.).",
    },
    timeout_ms: {
      type: "number",
      minimum: 1000,
      maximum: 60000,
      default: 15000,
      description: "Timeout in milliseconds for the scrape request.",
    },
    max_bytes: {
      type: "number",
      minimum: 10000,
      maximum: 2000000,
      default: 500000,
      description: "Maximum size in bytes to download per URL.",
    },
  },
  required: ["urls"],
};

const tool = {
  name: "scrape_url_content",
  description:
    "Fetches and parses site content for given URLs, extracting meta and text.",
  inputSchema: scrapeInputSchema,
  execute: withErrorHandling("scrape_url_content", async (args, context) => {
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
