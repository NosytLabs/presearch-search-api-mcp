import logger from "../core/logger.js";
import apiClient from "../core/apiClient.js";
import contentFetcher from "../services/contentFetcher.js";
import { withErrorHandling } from "../utils/errors.js";

// JSON Schema for MCP compatibility
const ScrapeInputSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL of the web page to scrape.",
      minLength: 1
    },
    format: {
      type: "string",
      enum: ["text", "markdown", "html"],
      description: "Preferred output format: text, markdown, or html. Defaults to markdown."
    },
    onlyMainContent: {
      type: "boolean",
      description: "If true, attempts to extract only the main content (article body), excluding navigation/ads. Defaults to true."
    }
  },
  required: ["url"]
};

/**
 * Web Scraping Tool
 * 
 * Fetches and extracts content from URLs with support for
 * text, markdown, and HTML output formats.
 */
export const scrapeTool = {
  name: "scrape_url",
  description: "Scrape content from a specific URL with options for format (text, markdown, html) and main content extraction.",
  inputSchema: ScrapeInputSchema,
  tags: ["scrape", "web"],
  execute: withErrorHandling("scrape_url", async (args) => {
    // Map new schema keys to internal logic
    const internalArgs = {
        urls: [args.url], // Map singular url to array
        include_text: true, // Default behavior implies text
        include_meta: args.include_metadata !== false, // Default true unless explicitly false
        timeout_ms: args.timeout || 15000,
        include_html: args.format === "html" || args.format === "markdown", // Implies HTML fetching needed for markdown conversion or raw HTML
        format: args.format || "markdown",
        onlyMainContent: args.onlyMainContent !== false
    };

    if (internalArgs.urls.length === 0) {
        throw new Error("URL cannot be empty");
    }

    for (const u of internalArgs.urls) {
        try {
            new URL(u);
        } catch {
            throw new Error(`Invalid URL: ${u}`);
        }
    }
    
    const a = internalArgs;
    logger.info("Scraping URL", { url: a.urls[0] });
    
    const url = a.urls[0];
    try {
        const res = await contentFetcher.fetch(url, {
          timeout: a.timeout_ms,
          includeText: true,
          includeHtml: true // Always fetch HTML to allow processing
        });

        let content = "";
        if (a.format === "html") {
            content = res.html;
        } else if (a.format === "text") {
            content = res.text;
        } else {
            // Default to markdown (using simple text or conversion if available)
            // For now, we'll just use text as markdown proxy or if contentFetcher provides markdown
            content = res.markdown || res.text; // Assuming contentFetcher might have markdown support or we fall back
        }

        return {
          success: true,
          url: url,
          format: a.format,
          content: content,
          metadata: res.meta,
          status: res.status
        };
    } catch (e) {
        throw new Error(`Failed to scrape ${url}: ${e.message}`);
    }
  }),
};

export default scrapeTool;
export { ScrapeInputSchema };
