import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../core/logger.js";

import http from "http";
import https from "https";

export class ContentFetcher {
  constructor(options = {}) {
    // Default concurrency settings
    this.maxConcurrency = options.maxConcurrency || 5;
    this.retryAttempts = options.retryAttempts || 2;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 15000;
    this.maxBytes = options.maxBytes || 2 * 1024 * 1024;

    // Connection pooling for better performance
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxContentLength: this.maxBytes,
      validateStatus: (status) => status < 500,
      // Keep connections alive for better performance
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });

    // Cache for robots.txt and domain-specific rate limits
    this.domainRateLimits = new Map();
    this.robotsCache = new Map();
    this.cookies = new Map();
    this.maxCacheSize = 1000; // Limit cache size to prevent memory leaks
  }

  /**
   * Fetch content with optimized parallel processing
   */
  async fetch(url, options = {}) {
    const headers = {
      "User-Agent":
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...options.headers,
    };

    // Check domain rate limiting
    const domain = new URL(url).hostname;
    await this._checkRateLimit(domain);

    try {
      const res = await this.axiosInstance.get(url, {
        responseType: "text",
        // Add cookies for this domain if available
        headers: {
          ...headers,
          Cookie: this._getCookiesForDomain(domain),
        },
      });

      // Store cookies for future requests
      this._storeCookies(domain, res.headers["set-cookie"]);

      return this._processContent(res.data, url, res.status, options);
    } catch (error) {
      logger.error("Fetch error", { url, error: error.message });

      // Retry logic with exponential backoff
      if (options.retry !== false && this.retryAttempts > 0) {
        return this._retryFetch(url, options, error);
      }

      throw error;
    }
  }

  /**
   * Fetch multiple URLs in parallel with concurrency control
   */
  async fetchBatch(urls, options = {}) {
    const startTime = Date.now();
    const concurrency = options.concurrency || this.maxConcurrency;
    const results = [];
    const errors = [];

    logger.info("Starting batch fetch", {
      urlCount: urls.length,
      concurrency,
      timeout: options.timeout || this.timeout,
    });

    // Process URLs in chunks based on concurrency limit
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const chunkStartTime = Date.now(); // Track chunk processing time
      const chunkPromises = chunk.map(async (url) => {
        try {
          const result = await this.fetch(url, {
            ...options,
            timeout: Math.floor((options.timeout || this.timeout) * 0.8), // Reserve time for processing
          });

          results.push({
            url,
            success: true,
            data: result,
          });

          return result;
        } catch (error) {
          errors.push({ url, error: error.message });

          results.push({
            url,
            success: false,
            error: error.message,
          });

          return null;
        }
      });

      // Wait for current chunk to complete before starting next
      try {
        await Promise.all(chunkPromises);
        
        // Log chunk completion for performance monitoring
        const chunkEndTime = Date.now();
        logger.debug(`Chunk ${Math.floor(i / concurrency) + 1} completed`, {
          chunkSize: chunkPromises.length,
          chunkTime: chunkEndTime - chunkStartTime,
          urlsProcessed: i + chunkPromises.length,
          totalUrls: urls.length
        });
      } catch (chunkError) {
        logger.error(`Chunk ${Math.floor(i / concurrency) + 1} failed`, {
          error: chunkError.message,
          chunkStart: i,
          chunkEnd: i + concurrency
        });
        // Continue with next chunk even if current one has failures
      }

      // Small delay between chunks to be respectful to servers
      if (i + concurrency < urls.length) {
        await this._delay(100);
      }
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    logger.info("Batch fetch completed", {
      totalUrls: urls.length,
      successCount,
      errorCount: errors.length,
      totalTime,
      avgTimePerUrl: totalTime / urls.length,
    });

    return {
      results,
      errors,
      totalTime,
      successRate: (successCount / urls.length) * 100,
      avgTimePerUrl: totalTime / urls.length,
    };
  }

  /**
   * Smart batch fetching with adaptive concurrency
   */
  async fetchBatchSmart(urls, options = {}) {
    const adaptiveConcurrency = options.adaptiveConcurrency !== false;
    let currentConcurrency = options.concurrency || this.maxConcurrency;
    const results = [];

    // Group URLs by domain for domain-aware processing
    const domainGroups = this._groupUrlsByDomain(urls);

    logger.info("Starting smart batch fetch", {
      urlCount: urls.length,
      domainCount: domainGroups.size,
      initialConcurrency: currentConcurrency,
    });

    // Process all domain groups in parallel with concurrency control
    const domainPromises = Array.from(domainGroups).map(async ([domain, domainUrls]) => {
      const domainConcurrency = Math.min(
        currentConcurrency,
        adaptiveConcurrency
          ? this._calculateDomainConcurrency(domain, domainUrls.length)
          : currentConcurrency,
      );

      const domainResults = await this.fetchBatch(domainUrls, {
        ...options,
        concurrency: domainConcurrency,
      });

      // Adapt concurrency based on domain performance
      if (adaptiveConcurrency) {
        const domainSuccessRate = domainResults.successRate;
        if (domainSuccessRate < 70) {
           // We can't update local variables inside the map effectively if we want to affect other domains,
           // but concurrency here is per-domain anyway.
           logger.warn(
            `Domain ${domain} had poor performance (${domainSuccessRate}%)`,
            { domain },
          );
        }
      }
      
      return domainResults;
    });

    const allDomainResults = await Promise.all(domainPromises);
    
    // Flatten results
    for (const res of allDomainResults) {
        results.push(...res.results);
    }

    const totalTime = results.reduce(
      (sum, r) => sum + (r.data?.fetchTime || 0),
      0,
    );
    const successCount = results.filter((r) => r.success).length;

    return {
      results,
      totalTime,
      successRate: (successCount / urls.length) * 100,
      avgTimePerUrl: totalTime / urls.length,
    };
  }

  /**
   * Process and clean content
   */
  _processContent(html, url, status, options = {}) {
    const startTime = Date.now();

    if (typeof html !== "string") {
      html = "";
    }

    const $ = cheerio.load(html);

    // Remove non-content elements
    $(
      "script, style, noscript, iframe, svg, header, footer, nav, aside, form, button",
    ).remove();

    // Extract metadata
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

    // Extract text content
    let text = "";
    if (options.includeText !== false) {
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

      // Add formatting
      contentRoot
        .find("p, h1, h2, h3, h4, h5, h6, li, div, br, tr")
        .each((i, el) => {
          $(el).append("\n");
        });

      contentRoot.find("h1, h2, h3, h4, h5, h6").each((i, el) => {
        $(el).prepend("\n\n");
      });

      // Clean text
      const rawText = contentRoot.text();
      text = rawText
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    const processingTime = Date.now() - startTime;
    const result = {
      url,
      status,
      meta: {
        title,
        description,
        og: { title: ogTitle, image: ogImage },
        twitter: { card: twCard, title: twTitle, image: twImage },
      },
      textLength: text.length,
      text,
      html: options.includeHtml ? html : undefined,
      fetchTime: processingTime,
    };

    logger.info("Processed content", {
      url,
      status,
      textLength: text.length,
      processingTime,
    });

    return result;
  }

  /**
   * Retry logic with exponential backoff
   */
  async _retryFetch(url, options, originalError) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      logger.warn(`Retry attempt ${attempt} for ${url} after ${delay}ms`);

      await this._delay(delay);

      try {
        return await this.fetch(url, { ...options, retry: false });
      } catch (error) {
        logger.error(`Retry ${attempt} failed for ${url}`, {
          error: error.message,
        });

        if (attempt === this.retryAttempts) {
          throw new Error(
            `All retry attempts failed. Original error: ${originalError.message}`,
          );
        }
      }
    }
  }

  /**
   * Rate limiting by domain
   */
  async _checkRateLimit(domain) {
    const now = Date.now();
    const domainLimit = this.domainRateLimits.get(domain);

    if (domainLimit && domainLimit.lastRequest) {
      const timeSinceLastRequest = now - domainLimit.lastRequest;
      const minInterval = domainLimit.minInterval || 1000; // Default 1 second between requests

      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest;
        logger.debug(`Rate limiting ${domain}, waiting ${waitTime}ms`);
        await this._delay(waitTime);
      }
    }

    // Update rate limit record
    if (this.domainRateLimits.size >= this.maxCacheSize) {
      // Evict oldest entry
      const firstKey = this.domainRateLimits.keys().next().value;
      this.domainRateLimits.delete(firstKey);
    }
    this.domainRateLimits.set(domain, {
      lastRequest: now,
      minInterval: this._calculateMinInterval(domain),
    });
  }

  /**
   * Calculate minimum interval between requests for a domain
   */
  _calculateMinInterval(domain) {
    // Different intervals for different types of sites
    if (domain.includes("wikipedia")) return 500; // 0.5s for Wikipedia
    if (domain.includes("github")) return 1000; // 1s for GitHub
    if (domain.includes("stackoverflow")) return 2000; // 2s for Stack Overflow
    if (domain.includes("reddit")) return 1500; // 1.5s for Reddit
    return 1000; // Default 1s
  }

  /**
   * Calculate domain-specific concurrency limits
   */
  _calculateDomainConcurrency(domain, urlCount) {
    const baseLimits = {
      "wikipedia.org": 3,
      "github.com": 2,
      "stackoverflow.com": 1,
      "reddit.com": 2,
      "medium.com": 2,
    };

    const domainKey = Object.keys(baseLimits).find((key) =>
      domain.includes(key),
    );
    return Math.min(baseLimits[domainKey] || this.maxConcurrency, urlCount);
  }

  /**
   * Group URLs by domain for domain-aware processing
   */
  _groupUrlsByDomain(urls) {
    const groups = new Map();

    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        if (!groups.has(domain)) {
          groups.set(domain, []);
        }
        groups.get(domain).push(url);
      } catch (error) {
        logger.warn(`Invalid URL: ${url}`, { error: error.message });
      }
    }

    return groups;
  }

  /**
   * Cookie management
   */
  _getCookiesForDomain(domain) {
    const domainCookies = this.cookies.get(domain);
    return domainCookies ? domainCookies.join("; ") : "";
  }

  _storeCookies(domain, setCookieHeaders) {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;

    if (!this.cookies.has(domain)) {
      if (this.cookies.size >= this.maxCacheSize) {
        // Evict oldest entry
        const firstKey = this.cookies.keys().next().value;
        this.cookies.delete(firstKey);
      }
      this.cookies.set(domain, []);
    }

    const domainCookies = this.cookies.get(domain);
    for (const cookie of setCookieHeaders) {
      const cookieName = cookie.split("=")[0];
      const existingIndex = domainCookies.findIndex((c) =>
        c.startsWith(cookieName + "="),
      );

      if (existingIndex >= 0) {
        domainCookies[existingIndex] = cookie;
      } else {
        domainCookies.push(cookie);
      }
    }
  }

  /**
   * Utility delay function
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      domainRateLimits: this.domainRateLimits.size,
      cookies: this.cookies.size,
      maxConcurrency: this.maxConcurrency,
      retryAttempts: this.retryAttempts,
    };
  }

  /**
   * Clear caches and reset state
   */
  clear() {
    this.domainRateLimits.clear();
    this.robotsCache.clear();
    this.cookies.clear();
    logger.info("Content fetcher caches cleared");
  }
}

export default new ContentFetcher();
