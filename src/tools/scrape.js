import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";

const ScrapeInputSchema = {
  type: "object",
  properties: {
    urls: {
      oneOf: [
        {
          type: "string"
        },
        {
          type: "array",
          items: { type: "string" },
          minItems: 1
        }
      ],
      description: "List of URLs to scrape content from. Can be a single URL string or an array of URL strings."
    },
    include_html: {
      type: "boolean",
      description: "Include raw HTML content"
    },
    include_metadata: {
      type: "boolean",
      description: "Include metadata (title, description, etc.)"
    },
    timeout: {
      type: "number",
      description: "Request timeout in milliseconds"
    }
  },
  required: ["urls"]
};

const tool = {
  name: "scrape_url_content",
  description: "Extract and parse content from URLs. Returns text, metadata, headings, and links.",
  inputSchema: ScrapeInputSchema,
  execute: withErrorHandling("scrape_url_content", async (args) => {
    // Map new schema keys to internal logic
    const internalArgs = {
        urls: Array.isArray(args.urls) ? args.urls : [args.urls],
        include_text: true, // Default behavior implies text
        include_meta: args.include_metadata !== false, // Default true unless explicitly false
        timeout_ms: args.timeout || 15000,
        include_html: args.include_html
    };

    if (internalArgs.urls.length === 0) {
        throw new Error("URLs list cannot be empty");
    }

    for (const u of internalArgs.urls) {
        try {
            new URL(u);
        } catch {
            throw new Error(`Invalid URL: ${u}`);
        }
    }
    
    const a = internalArgs;
    logger.info("Scraping URLs", { count: a.urls.length });
    const out = [];
    for (const url of a.urls) {
      try {
        const res = await contentFetcher.fetch(url, {
          timeout: a.timeout_ms,
          maxBytes: 500000, // Default max bytes
          includeText: a.include_text,
          includeHtml: a.include_html // Assuming contentFetcher supports this or will ignore it
        });
        out.push({
          url,
          status: res.status,
          meta: a.include_meta ? res.meta : undefined,
          text: a.include_text ? res.text : undefined,
          html: a.include_html ? res.html : undefined, // Pass HTML if available
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
export { ScrapeInputSchema };
