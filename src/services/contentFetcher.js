import puppeteer from "puppeteer";
import logger from "../core/logger.js";
import { config } from "../core/config.js";
import { validateUrl } from "../core/security.js";

export class ContentFetcher {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: config.puppeteerArgs,
      });
    }
  }

  async fetchContent(url) {
    try {
      await validateUrl(url);
    } catch (error) {
      logger.error(`Security validation failed for ${url}: ${error.message}`);
      return {
        url,
        error: `Security Error: ${error.message}`,
        content: null,
      };
    }

    await this.initBrowser();
    const page = await this.browser.newPage();
    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      // Block resources to speed up loading
      await page.setRequestInterception(true);
      page.on("request", async (req) => {
        if (
          ["image", "stylesheet", "font", "media"].includes(req.resourceType())
        ) {
          await req.abort();
          return;
        }

        // Validate navigation requests to prevent redirects to internal/private IPs
        if (req.isNavigationRequest()) {
          try {
            await validateUrl(req.url());
            await req.continue();
          } catch (error) {
            logger.warn(`Blocked navigation to ${req.url()}: ${error.message}`);
            await req.abort("accessdenied");
          }
        } else {
          await req.continue();
        }
      });

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      // Extract main content
      const content = await page.evaluate(() => {
        // Remove clutter
        const selectorsToRemove = [
          "nav",
          "footer",
          "header",
          "aside",
          ".ads",
          ".advertisement",
          "script",
          "style",
        ];
        selectorsToRemove.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => el.remove());
        });

        // Get text
        return document.body.innerText;
      });

      const title = await page.title();

      return {
        url,
        title,
        content: content.replace(/\s+/g, " ").trim().substring(0, 10000), // Limit size
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Scraping failed for ${url}: ${error.message}`);
      return {
        url,
        error: error.message,
        content: null,
      };
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const contentFetcher = new ContentFetcher();
