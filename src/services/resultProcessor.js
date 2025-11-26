/**
 * Result Processing Service
 * Provides advanced result processing capabilities including deduplication,
 * error categorization, and quality scoring
 */

import logger from "../core/logger.js";

/**
 * Error categories for detailed error tracking
 */
export const ErrorCategories = {
  API_ERROR: "API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  SOURCE_ERROR: "SOURCE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
};

/**
 * Circuit breaker states
 */
export const CircuitBreakerState = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
};

/**
 * Result processor configuration
 */
export class ResultProcessorConfig {
  constructor(options = {}) {
    this.deduplicationThreshold = options.deduplicationThreshold || 0.85;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.enableMetrics = options.enableMetrics !== false;
  }
}

/**
 * Result deduplication service
 */
export class ResultDeduplicator {
  constructor(threshold = 0.85) {
    this.threshold = threshold;
    this.similarityCache = new Map();
  }

  /**
   * Calculate Jaccard similarity between two strings
   */
  calculateJaccardSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity between two strings
   */
  calculateCosineSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const allWords = new Set([...words1, ...words2]);
    const vector1 = Array.from(allWords).map(
      (word) => words1.filter((w) => w === word).length,
    );
    const vector2 = Array.from(allWords).map(
      (word) => words2.filter((w) => w === word).length,
    );

    const dotProduct = vector1.reduce(
      (sum, val, i) => sum + val * vector2[i],
      0,
    );
    const magnitude1 = Math.sqrt(
      vector1.reduce((sum, val) => sum + val * val, 0),
    );
    const magnitude2 = Math.sqrt(
      vector2.reduce((sum, val) => sum + val * val, 0),
    );

    return magnitude1 === 0 || magnitude2 === 0
      ? 0
      : dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate similarity between two results
   */
  calculateSimilarity(result1, result2) {
    const titleSimilarity = this.calculateCosineSimilarity(
      result1.title || "",
      result2.title || "",
    );
    const descriptionSimilarity = this.calculateCosineSimilarity(
      result1.description || "",
      result2.description || "",
    );
    const urlSimilarity = result1.url === result2.url ? 1 : 0;

    // Weighted average: title 40%, description 40%, URL 20%
    return (
      titleSimilarity * 0.4 + descriptionSimilarity * 0.4 + urlSimilarity * 0.2
    );
  }

  /**
   * Remove duplicate results
   */
  deduplicate(results) {
    const uniqueResults = [];
    const duplicates = [];

    for (const result of results) {
      let isDuplicate = false;

      for (const uniqueResult of uniqueResults) {
        const similarity = this.calculateSimilarity(result, uniqueResult);

        if (similarity >= this.threshold) {
          isDuplicate = true;
          duplicates.push({
            original: uniqueResult,
            duplicate: result,
            similarity,
          });
          break;
        }
      }

      if (!isDuplicate) {
        uniqueResults.push(result);
      }
    }

    logger.info(
      `Deduplication complete: ${results.length} -> ${uniqueResults.length} results, ${duplicates.length} duplicates removed`,
    );

    return {
      results: uniqueResults,
      duplicates,
      metrics: {
        originalCount: results.length,
        uniqueCount: uniqueResults.length,
        duplicateCount: duplicates.length,
        deduplicationRatio: duplicates.length / results.length,
      },
    };
  }
}

/**
 * Error categorization service
 */
export class ErrorCategorizer {
  /**
   * Categorize an error
   */
  categorizeError(error) {
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || "";

    // Rate limit errors
    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429") ||
      errorMessage.includes("too many requests")
    ) {
      return {
        category: ErrorCategories.RATE_LIMIT_ERROR,
        severity: "high",
        retryable: true,
        message: "Rate limit exceeded",
        details: {
          errorMessage,
          retryAfter: error.response?.headers?.["retry-after"],
        },
      };
    }

    // Network errors
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET" ||
      error.code === "EHOSTUNREACH"
    ) {
      return {
        category: ErrorCategories.NETWORK_ERROR,
        severity: "medium",
        retryable: true,
        message: "Network connectivity issue",
        details: { errorCode: error.code, errorMessage },
      };
    }

    // Timeout errors
    if (
      error.code === "ECONNABORTED" ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("timed out")
    ) {
      return {
        category: ErrorCategories.TIMEOUT_ERROR,
        severity: "medium",
        retryable: true,
        message: "Request timeout",
        details: { timeout: error.config?.timeout, errorMessage },
      };
    }

    // Authentication errors
    if (
      error.response?.status === 401 ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("authentication")
    ) {
      return {
        category: ErrorCategories.AUTHENTICATION_ERROR,
        severity: "high",
        retryable: false,
        message: "Authentication failed",
        details: { status: error.response?.status, errorMessage },
      };
    }

    // API errors (4xx, 5xx)
    if (error.response?.status) {
      const status = error.response.status;
      if (status >= 400 && status < 500) {
        return {
          category: ErrorCategories.API_ERROR,
          severity: status >= 450 ? "high" : "medium",
          retryable: status === 429 || status === 408 || status >= 500,
          message: `API client error: ${status}`,
          details: {
            status,
            statusText: error.response.statusText,
            errorMessage,
          },
        };
      }
      if (status >= 500) {
        return {
          category: ErrorCategories.API_ERROR,
          severity: "high",
          retryable: true,
          message: `API server error: ${status}`,
          details: {
            status,
            statusText: error.response.statusText,
            errorMessage,
          },
        };
      }
    }

    // Configuration errors
    if (
      errorMessage.includes("configuration") ||
      errorMessage.includes("config")
    ) {
      return {
        category: ErrorCategories.CONFIGURATION_ERROR,
        severity: "high",
        retryable: false,
        message: "Configuration error",
        details: { errorMessage },
      };
    }

    // Default to source error
    return {
      category: ErrorCategories.SOURCE_ERROR,
      severity: "low",
      retryable: true,
      message: "Data source error",
      details: { errorMessage, errorStack },
    };
  }
}

/**
 * Circuit breaker for API calls
 */
export class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.state = CircuitBreakerState.CLOSED;
    this.lastFailureTime = null;
    this.nextAttempt = null;
  }

  /**
   * Record a failure
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  /**
   * Record a success
   */
  recordSuccess() {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.failureCount = 0;
      this.state = CircuitBreakerState.CLOSED;
      this.nextAttempt = null;
      logger.info("Circuit breaker closed after successful call");
    }
  }

  /**
   * Check if call can proceed
   */
  canProceed() {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info("Circuit breaker attempting half-open state");
        return true;
      }
      return false;
    }

    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      canProceed: this.canProceed(),
    };
  }
}

/**
 * Enhanced cache with metrics
 */
export class EnhancedCache {
  constructor(timeout = 300000) {
    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
    };
    this.timeout = timeout;
  }

  /**
   * Generate cache key
   */
  generateKey(query, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    return `${query}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached result
   */
  get(key) {
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.timeout) {
      this.cache.delete(key);
      this.metrics.evictions++;
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    return entry.data;
  }

  /**
   * Set cached result
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
    this.metrics.evictions += this.cache.size;
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      hitRate:
        this.metrics.totalRequests > 0
          ? this.metrics.hits / this.metrics.totalRequests
          : 0,
      size: this.cache.size,
      timeout: this.timeout,
    };
  }
}

/**
 * Main result processor
 */
export class ResultProcessor {
  constructor(config = new ResultProcessorConfig()) {
    this.config = config;
    this.deduplicator = new ResultDeduplicator(config.deduplicationThreshold);
    this.errorCategorizer = new ErrorCategorizer();
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreakerThreshold,
      config.circuitBreakerTimeout,
    );
    this.cache = new EnhancedCache(config.cacheTimeout);
    this.metrics = {
      processedQueries: 0,
      totalResults: 0,
      deduplicatedResults: 0,
      errors: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * Process search results
   */
  async processResults(results, query, params = {}) {
    const startTime = Date.now();

    try {
      this.metrics.processedQueries++;
      this.metrics.totalResults += results.length;

      // Check circuit breaker
      if (!this.circuitBreaker.canProceed()) {
        throw new Error("Circuit breaker is open");
      }

      // Deduplicate results
      const deduplicationResult = this.deduplicator.deduplicate(results);
      this.metrics.deduplicatedResults += deduplicationResult.results.length;

      // Calculate quality scores
      const resultsWithScores = deduplicationResult.results.map((result) => ({
        ...result,
        qualityScore: this.calculateQualityScore(result),
        processingTimestamp: new Date().toISOString(),
      }));

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      this.circuitBreaker.recordSuccess();

      return {
        results: resultsWithScores,
        metadata: {
          query,
          params,
          processingTime,
          deduplication: deduplicationResult.metrics,
          cacheHit: false,
          qualityMetrics: this.getQualityMetrics(resultsWithScores),
        },
      };
    } catch (error) {
      this.metrics.errors++;
      this.circuitBreaker.recordFailure();

      const categorizedError = this.errorCategorizer.categorizeError(error);

      return {
        results: [],
        error: categorizedError,
        metadata: {
          query,
          params,
          processingTime: Date.now() - startTime,
          cacheHit: false,
        },
      };
    }
  }

  /**
   * Calculate quality score for a result
   */
  calculateQualityScore(result) {
    let score = 0;

    // Title quality (0-30 points)
    if (result.title) {
      score += Math.min(30, result.title.length / 2);
      // Bonus for descriptive titles
      if (result.title.length > 50 && result.title.length < 120) score += 5;
      // Penalty for generic titles
      if (["home", "index", "untitled"].includes(result.title.toLowerCase()))
        score -= 10;
    }

    // Description quality (0-25 points)
    if (result.description) {
      score += Math.min(25, result.description.length / 4);
      // Bonus for comprehensive descriptions
      if (result.description.length > 150) score += 5;
      // Penalty for duplicate content indicators
      if (result.description.includes("...") || result.description.length < 30)
        score -= 5;
    }

    // URL authority and trust (0-25 points)
    if (result.url) {
      try {
        const domain = new URL(result.url).hostname;

        // High-authority domains
        const highAuthorityDomains = [
          "wikipedia.org",
          "github.com",
          "stackoverflow.com",
          "mozilla.org",
          "w3.org",
          "ietf.org",
          "apache.org",
          "gnu.org",
          "mit.edu",
          "stanford.edu",
          "harvard.edu",
          "cambridge.org",
          "ox.ac.uk",
        ];

        // Medium-authority domains
        const mediumAuthorityDomains = [
          "medium.com",
          "reddit.com",
          "quora.com",
          "linkedin.com",
          "forbes.com",
          "techcrunch.com",
          "wired.com",
          "arstechnica.com",
          "nationalgeographic.com",
          "scientificamerican.com",
          "nature.com",
        ];

        if (
          highAuthorityDomains.some((authDomain) => domain.includes(authDomain))
        ) {
          score += 25;
        } else if (
          mediumAuthorityDomains.some((authDomain) =>
            domain.includes(authDomain),
          )
        ) {
          score += 15;
        } else {
          // Generic scoring based on domain characteristics
          score += Math.min(15, domain.length / 2);

          // Bonus for HTTPS
          if (result.url.startsWith("https://")) score += 5;

          // Bonus for clean URLs (no excessive parameters)
          if (!result.url.includes("?") || result.url.split("?")[1].length < 50)
            score += 3;

          // Penalty for suspicious domains
          if (
            domain.includes(".tk") ||
            domain.includes(".ml") ||
            domain.includes(".cf")
          )
            score -= 10;
        }
      } catch (error) {
        // Invalid URL
        score += 0;
      }
    }

    // Content freshness (0-15 points)
    if (result.publishedDate || result.lastModified || result.timestamp) {
      const dateStr =
        result.publishedDate || result.lastModified || result.timestamp;
      try {
        const contentDate = new Date(dateStr);
        const now = new Date();
        const daysDiff = (now - contentDate) / (1000 * 60 * 60 * 24);

        if (daysDiff < 7)
          score += 15; // Very recent
        else if (daysDiff < 30)
          score += 10; // Recent
        else if (daysDiff < 90)
          score += 5; // Moderately recent
        else if (daysDiff < 365) score += 2; // Within a year
        // Older content gets no bonus but no penalty either
      } catch (error) {
        // Invalid date format
      }
    }

    // Engagement metrics (0-15 points)
    if (result.engagement) {
      if (result.engagement.likes && result.engagement.likes > 100) score += 5;
      if (result.engagement.shares && result.engagement.shares > 50) score += 5;
      if (result.engagement.comments && result.engagement.comments > 20)
        score += 5;
    }

    // Content type bonuses (0-10 points)
    if (result.contentType) {
      const contentType = result.contentType.toLowerCase();
      if (contentType.includes("article") || contentType.includes("blog"))
        score += 8;
      else if (
        contentType.includes("documentation") ||
        contentType.includes("guide")
      )
        score += 10;
      else if (
        contentType.includes("tutorial") ||
        contentType.includes("how-to")
      )
        score += 9;
      else if (
        contentType.includes("research") ||
        contentType.includes("paper")
      )
        score += 10;
      else if (
        contentType.includes("video") ||
        contentType.includes("presentation")
      )
        score += 6;
      else if (
        contentType.includes("image") ||
        contentType.includes("infographic")
      )
        score += 4;
    }

    // Language and accessibility (0-10 points)
    if (result.language) {
      // Prefer English content for broader accessibility
      if (result.language === "en") score += 5;
      // Still give some credit for other languages
      else score += 2;
    }

    // Structured data presence (0-10 points)
    if (result.schema || result.structuredData || result.jsonLd) {
      score += 10; // Rich structured data indicates quality content
    }

    // Mobile optimization (0-5 points)
    if (result.mobileFriendly === true) score += 5;
    else if (result.mobileFriendly === false) score -= 3;

    // Normalize score to 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get quality metrics for results
   */
  getQualityMetrics(results) {
    if (results.length === 0) return {};

    const scores = results.map((r) => r.qualityScore).filter(Boolean);
    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const highQualityCount = scores.filter((score) => score >= 70).length;

    return {
      averageQualityScore: averageScore,
      highQualityResults: highQualityCount,
      highQualityRatio: highQualityCount / results.length,
      totalScoredResults: scores.length,
    };
  }

  /**
   * Update average processing time
   */
  updateAverageProcessingTime(newTime) {
    const totalTime =
      this.metrics.averageProcessingTime * (this.metrics.processedQueries - 1) +
      newTime;
    this.metrics.averageProcessingTime =
      totalTime / this.metrics.processedQueries;
  }

  /**
   * Categorize content based on title and description
   */
  categorizeContent(title, description) {
    const text = `${title} ${description}`.toLowerCase();

    // Technology categories
    if (
      text.includes("ai") ||
      text.includes("artificial intelligence") ||
      text.includes("machine learning") ||
      text.includes("neural")
    ) {
      return "technology-ai";
    }
    if (
      text.includes("programming") ||
      text.includes("coding") ||
      text.includes("software") ||
      text.includes("development")
    ) {
      return "technology-programming";
    }
    if (
      text.includes("blockchain") ||
      text.includes("cryptocurrency") ||
      text.includes("bitcoin")
    ) {
      return "technology-blockchain";
    }

    // Science categories
    if (
      text.includes("physics") ||
      text.includes("quantum") ||
      text.includes("relativity")
    ) {
      return "science-physics";
    }
    if (
      text.includes("biology") ||
      text.includes("genetics") ||
      text.includes("evolution")
    ) {
      return "science-biology";
    }
    if (
      text.includes("chemistry") ||
      text.includes("molecular") ||
      text.includes("reaction")
    ) {
      return "science-chemistry";
    }

    // Business categories
    if (
      text.includes("business") ||
      text.includes("entrepreneur") ||
      text.includes("startup")
    ) {
      return "business-general";
    }
    if (
      text.includes("marketing") ||
      text.includes("advertising") ||
      text.includes("seo")
    ) {
      return "business-marketing";
    }
    if (
      text.includes("finance") ||
      text.includes("investment") ||
      text.includes("stock")
    ) {
      return "business-finance";
    }

    // Health categories
    if (
      text.includes("health") ||
      text.includes("medical") ||
      text.includes("disease")
    ) {
      return "health-general";
    }
    if (
      text.includes("fitness") ||
      text.includes("exercise") ||
      text.includes("nutrition")
    ) {
      return "health-fitness";
    }

    // Education categories
    if (
      text.includes("education") ||
      text.includes("learning") ||
      text.includes("tutorial")
    ) {
      return "education-general";
    }
    if (
      text.includes("university") ||
      text.includes("college") ||
      text.includes("academic")
    ) {
      return "education-academic";
    }

    // News categories
    if (
      text.includes("news") ||
      text.includes("breaking") ||
      text.includes("latest")
    ) {
      return "news-general";
    }
    if (
      text.includes("politics") ||
      text.includes("government") ||
      text.includes("election")
    ) {
      return "news-politics";
    }

    // Entertainment categories
    if (
      text.includes("movie") ||
      text.includes("film") ||
      text.includes("cinema")
    ) {
      return "entertainment-movies";
    }
    if (
      text.includes("music") ||
      text.includes("song") ||
      text.includes("album")
    ) {
      return "entertainment-music";
    }
    if (
      text.includes("game") ||
      text.includes("gaming") ||
      text.includes("console")
    ) {
      return "entertainment-gaming";
    }

    // Default category
    return "general";
  }

  /**
   * Check if content is recent
   */
  isRecentContent(publishedDate) {
    if (!publishedDate) return false;

    try {
      const contentDate = new Date(publishedDate);
      const now = new Date();
      const daysDiff = (now - contentDate) / (1000 * 60 * 60 * 24);

      return daysDiff < 30; // Consider content recent if published within 30 days
    } catch (error) {
      return false;
    }
  }

  /**
   * Get processor metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      circuitBreaker: this.circuitBreaker.getStatus(),
      cache: this.cache.getMetrics(),
      config: {
        deduplicationThreshold: this.config.deduplicationThreshold,
        maxRetries: this.config.maxRetries,
        cacheTimeout: this.config.cacheTimeout,
      },
    };
  }

  /**
   * Clear cache and reset metrics
   */
  reset() {
    this.cache.clear();
    this.metrics = {
      processedQueries: 0,
      totalResults: 0,
      deduplicatedResults: 0,
      errors: 0,
      averageProcessingTime: 0,
    };
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerTimeout,
    );
  }
}

// Export singleton instance
export const resultProcessor = new ResultProcessor();
