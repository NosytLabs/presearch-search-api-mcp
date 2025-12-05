import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../core/logger.js";

export class ContentFetcher {
  async fetch(url, options = {}) {
    const timeout = options.timeout || 15000;
    // Increased default max bytes to 2MB to handle larger pages
    const maxBytes = options.maxBytes || 2 * 1024 * 1024;
    const headers = {
      // Use a real browser User-Agent to avoid being blocked by anti-bot protections
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    try {
      const res = await axios.get(url, {
        headers,
        timeout,
        responseType: "text",
        maxContentLength: maxBytes,
        validateStatus: (status) => status < 500, // Accept 4xx errors to return content if any
      });

      const html = typeof res.data === "string" ? res.data : "";
      const $ = cheerio.load(html);

      // Remove script, style, and other non-content elements to clean up the text
      $(
        "script, style, noscript, iframe, svg, header, footer, nav, aside, form, button",
      ).remove();

      const title =
        $("title").text().trim() ||
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        "";
      const description =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";

      const ogTitle = $('meta[property="og:title"]').attr("content");
      const ogImage = $('meta[property="og:image"]').attr("content");

      const twCard = $('meta[name="twitter:card"]').attr("content");
      const twTitle = $('meta[name="twitter:title"]').attr("content");
      const twImage = $('meta[name="twitter:image"]').attr("content");

      // Extract meaningful text
      let text = "";
      if (options.includeText !== false) {
        // Prioritize main content areas
        const contentSelectors = [
          "article",
          "main",
          '[role="main"]',
          "#content",
          ".content",
          ".post",
          ".article",
        ];
        let contentRoot = null;

        for (const selector of contentSelectors) {
          if ($(selector).length > 0) {
            contentRoot = $(selector).first();
            break;
          }
        }

        if (!contentRoot) {
          contentRoot = $("body");
        }

        // Add newlines after block elements to preserve readability
        contentRoot
          .find("p, h1, h2, h3, h4, h5, h6, li, div, br, tr")
          .each((i, el) => {
            $(el).append("\n");
          });
          
        // Headers should have double newlines before them to separate sections
        contentRoot
          .find("h1, h2, h3, h4, h5, h6")
          .each((i, el) => {
            $(el).prepend("\n\n");
          });

        // Get text
        let rawText = contentRoot.text();
        
        // Clean up whitespace: collapse multiple spaces/tabs to single space, but preserve newlines
        text = rawText
            .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
            .replace(/\n\s+/g, "\n") // Remove leading space on new lines
            .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines to max 2
            .trim();
      }

      const meta = {
        title,
        description,
        og: { title: ogTitle, image: ogImage },
        twitter: { card: twCard, title: twTitle, image: twImage },
      };

      const out = {
        url,
        status: res.status,
        meta,
        textLength: text.length,
        text,
        html: options.includeHtml ? html : undefined,
      };

      logger.info("Scraped content", {
        url,
        status: res.status,
        textLength: text.length,
      });
      return out;
    } catch (error) {
      logger.error("Fetch error", { url, error: error.message });
      // Return a partial result with error info instead of throwing if possible,
      // but standard behavior is to throw so tools can handle it.
      // However, for "deep research", knowing it failed is important.
      throw error;
    }
  }
}

export default new ContentFetcher();
