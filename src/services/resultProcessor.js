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
    this.maxCacheSize = 10000; // Prevent memory leaks
    this.urlIndex = new Map(); // Quick URL-based deduplication
    this.titleIndex = new Map(); // Quick title-based grouping
  }

  /**
   * Calculate Jaccard similarity between two strings - Optimized version
   */
  calculateJaccardSimilarity(str1, str2) {
    // Use cache for repeated calculations
    const cacheKey = `jaccard:${str1}|${str2}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }

    // Early exit for identical strings
    if (str1 === str2) {
      this.addToCache(cacheKey, 1.0);
      return 1.0;
    }

    // Early exit for very different lengths
    const len1 = str1.length;
    const len2 = str2.length;
    if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
      this.addToCache(cacheKey, 0.0);
      return 0.0;
    }

    // Use word frequency maps for better performance
    const words1 = this.getWordFrequency(str1);
    const words2 = this.getWordFrequency(str2);

    const intersection = new Set(
      [...words1.keys()].filter((x) => words2.has(x)),
    );
    const union = new Set([...words1.keys(), ...words2.keys()]);

    const similarity = intersection.size / union.size;
    this.addToCache(cacheKey, similarity);

    return similarity;
  }

  addToCache(key, value) {
    if (this.similarityCache.size >= this.maxCacheSize) {
      // Evict oldest entry (LRU-like for Map)
      const firstKey = this.similarityCache.keys().next().value;
      this.similarityCache.delete(firstKey);
    }
    this.similarityCache.set(key, value);
  }

  /**
   * Get word frequency map for a string
   */
  getWordFrequency(text) {
    const words = text.toLowerCase().split(/\s+/);
    const frequency = new Map();

    for (const word of words) {
      if (word.length > 2) {
        // Skip very short words for performance
        frequency.set(word, (frequency.get(word) || 0) + 1);
      }
    }

    return frequency;
  }

  /**
   * Calculate cosine similarity between two strings - Optimized version
   */
  calculateCosineSimilarity(str1, str2) {
    const cacheKey = `cosine:${str1}|${str2}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }

    if (str1 === str2) {
      this.addToCache(cacheKey, 1.0);
      return 1.0;
    }

    // Use sparse vector representation for better performance
    const vec1 = this.getSparseVector(str1);
    const vec2 = this.getSparseVector(str2);

    const dotProduct = this.calculateSparseDotProduct(vec1, vec2);
    const magnitude1 = this.calculateSparseMagnitude(vec1);
    const magnitude2 = this.calculateSparseMagnitude(vec2);

    const similarity =
      magnitude1 === 0 || magnitude2 === 0
        ? 0
        : dotProduct / (magnitude1 * magnitude2);

    this.addToCache(cacheKey, similarity);
    return similarity;
  }

  /**
   * Get sparse vector representation of text
   */
  getSparseVector(text) {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Map();

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length > 2) {
        // Skip very short words
        vector.set(word, (vector.get(word) || 0) + 1);
      }
    }

    return vector;
  }

  /**
   * Calculate dot product of two sparse vectors
   */
  calculateSparseDotProduct(vec1, vec2) {
    let dotProduct = 0;

    // Iterate over the smaller vector for efficiency
    if (vec1.size <= vec2.size) {
      for (const [word, count1] of vec1) {
        const count2 = vec2.get(word);
        if (count2 !== undefined) {
          dotProduct += count1 * count2;
        }
      }
    } else {
      for (const [word, count2] of vec2) {
        const count1 = vec1.get(word);
        if (count1 !== undefined) {
          dotProduct += count1 * count2;
        }
      }
    }

    return dotProduct;
  }

  /**
   * Calculate magnitude of sparse vector
   */
  calculateSparseMagnitude(vector) {
    let sum = 0;
    for (const count of vector.values()) {
      sum += count * count;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate similarity between two results - Optimized version
   */
  calculateSimilarity(result1, result2) {
    // Quick URL comparison first
    if (result1.url && result2.url && result1.url === result2.url) {
      return 1.0;
    }

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
   * Get normalized title key for grouping
   */
  getTitleKey(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .sort() // Sort words for consistent grouping
      .join(" ");
  }

  /**
   * Remove duplicate results - Highly optimized multi-stage approach
   */
  deduplicate(results) {
    const uniqueResults = [];
    const duplicates = [];

    // Clear indexes for this batch
    this.urlIndex.clear();
    this.titleIndex.clear();

    // Early return for empty results
    if (!results || results.length === 0) {
      return { unique: [], duplicates: [] };
    }

    // Stage 1: Quick URL-based deduplication (O(n))
    const urlDeduplicated = [];
    const startTime = Date.now();
    
    for (const result of results) {
      const urlKey = result.url || result.link || "";
      if (urlKey && this.urlIndex.has(urlKey)) {
        duplicates.push({
          original: this.urlIndex.get(urlKey),
          duplicate: result,
          similarity: 1.0,
          reason: "identical_url",
        });
      } else {
        if (urlKey) this.urlIndex.set(urlKey, result);
        urlDeduplicated.push(result);
      }
    }
    
    logger.debug("URL deduplication completed", {
      originalCount: results.length,
      afterUrlDedup: urlDeduplicated.length,
      duplicatesFound: duplicates.length,
      duration: Date.now() - startTime
    });

    // Stage 2: Title-based grouping (reduces comparisons)
    const titleGroups = new Map();
    for (const result of urlDeduplicated) {
      const titleKey = this.getTitleKey(result.title || "");
      if (!titleGroups.has(titleKey)) {
        titleGroups.set(titleKey, []);
      }
      titleGroups.get(titleKey).push(result);
    }

    // Stage 3: Detailed similarity comparison within groups
    for (const [, group] of titleGroups) {
      if (group.length === 1) {
        uniqueResults.push(group[0]);
      } else {
        // Compare within the group (much smaller than full dataset)
        for (let i = 0; i < group.length; i++) {
          const result = group[i];
          let isDuplicate = false;

          for (let j = 0; j < uniqueResults.length; j++) {
            const similarity = this.calculateSimilarity(
              result,
              uniqueResults[j],
            );

            if (similarity >= this.threshold) {
              isDuplicate = true;
              duplicates.push({
                original: uniqueResults[j],
                duplicate: result,
                similarity,
                reason: "content_similarity",
              });
              break;
            }
          }

          if (!isDuplicate) {
            uniqueResults.push(result);
          }
        }
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
        cacheHits: this.similarityCache.size,
        urlDuplicates: duplicates.filter((d) => d.reason === "identical_url")
          .length,
        contentDuplicates: duplicates.filter(
          (d) => d.reason === "content_similarity",
        ).length,
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
  constructor(timeout = 300000, maxSize = 1000) {
    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
    };
    this.timeout = timeout;
    this.maxSize = maxSize;
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
   * Set cached result with memory management
   */
  set(key, data) {
    // Eviction if full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.metrics.evictions++;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.metrics.evictions += this.cache.size;
    this.cache.clear();
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
   * Normalize a single result object
   */
  normalizeResult(result, index) {
    const url = result.url || result.link;
    const title = result.title || result.name || "Untitled";
    const description =
      result.description || result.snippet || result.summary || "";

    return {
      ...result,
      url,
      title,
      description,
      position: result.position || index + 1,
      domain: url ? new URL(url).hostname : "unknown",
      contentCategory: this.categorizeContent(title, description),
      isRecent: this.isRecentContent(result.publishedDate),
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

      // 1. Normalize results
      let processedResults = results.map((result, index) =>
        this.normalizeResult(result, index),
      );

      // 2. Filter by content categories if specified
      if (params.content_categories && params.content_categories.length > 0) {
        processedResults = processedResults.filter((result) =>
          params.content_categories.includes(result.contentCategory),
        );
      }

      // 3. Filter by excluded domains if specified
      if (params.exclude_domains && params.exclude_domains.length > 0) {
        processedResults = processedResults.filter(
          (result) =>
            !params.exclude_domains.some((d) => result.domain.includes(d)),
        );
      }

      // 4. Deduplicate results
      const deduplicationResult =
        this.deduplicator.deduplicate(processedResults);
      processedResults = deduplicationResult.results;
      this.metrics.deduplicatedResults += processedResults.length;

      // 5. Calculate quality scores
      processedResults = processedResults.map((result, index) => ({
        ...result,
        qualityScore: this.calculateQualityScore(result, index),
        processingTimestamp: new Date().toISOString(),
      }));

      // 6. Filter by quality score if specified
      if (
        typeof params.min_quality_score === "number" &&
        params.min_quality_score > 0
      ) {
        processedResults = processedResults.filter(
          (result) => result.qualityScore >= params.min_quality_score,
        );
      }

      // 7. Apply count limit
      if (params.count && processedResults.length > params.count) {
        processedResults = processedResults.slice(0, params.count);
      }

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      this.circuitBreaker.recordSuccess();

      return {
        results: processedResults,
        metadata: {
          query,
          params,
          processingTime,
          deduplication: deduplicationResult.metrics,
          cacheHit: false,
          qualityMetrics: this.getQualityMetrics(processedResults),
          total: results.length,
          processed: processedResults.length,
          filteredOut: results.length - processedResults.length,
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
   * Calculate quality score for a result based on available Presearch API data
   * Optimized for actual API response structure: title, link, description only
   */
  calculateQualityScore(result, index) {
    let score = 0;

    // Original Rank bonus (0-20 points)
    // Respect the search engine's original ranking - higher ranks get better scores
    if (index !== undefined) {
      score += Math.max(0, 20 - index * 2);
    }

    // Title quality (0-40 points) - most important factor for click-through
    if (result.title) {
      const titleLength = result.title.length;

      // Base score based on length (0-25 points)
      if (titleLength >= 30 && titleLength <= 80) {
        score += 25; // Optimal length range
      } else if (titleLength > 80) {
        score += Math.max(15, 25 - (titleLength - 80) / 10); // Gradual penalty for too long
      } else {
        score += Math.min(20, titleLength * 0.8); // Gradual bonus for reasonable length
      }

      // Bonus for descriptive titles (0-10 points)
      const descriptiveWords = [
        "guide",
        "tutorial",
        "overview",
        "introduction",
        "complete",
        "ultimate",
        "best",
        "review",
        "comparison",
        "analysis",
      ];
      const titleLower = result.title.toLowerCase();
      const hasDescriptiveWords = descriptiveWords.some((word) =>
        titleLower.includes(word),
      );
      if (hasDescriptiveWords) score += 10;

      // Penalty for generic titles (0-5 points)
      const genericTitles = [
        "home",
        "index",
        "untitled",
        "page",
        "document",
        "article",
      ];
      if (
        genericTitles.some(
          (generic) => titleLower === generic || titleLower.includes(generic),
        )
      ) {
        score -= 5;
      }

      // Bonus for question titles (indicates helpful content)
      if (result.title.includes("?")) score += 5;

      // Bonus for numbered lists (indicates structured content)
      if (/\d+/.test(result.title)) score += 3;
    }

    // Description quality (0-35 points) - secondary importance for context
    if (result.description) {
      const descLength = result.description.length;

      // Base score based on length (0-25 points)
      if (descLength >= 100 && descLength <= 300) {
        score += 25; // Optimal length range
      } else if (descLength > 300) {
        score += Math.max(15, 25 - (descLength - 300) / 50); // Gradual penalty for too long
      } else {
        score += Math.min(20, descLength / 5); // Gradual bonus for reasonable length
      }

      // Bonus for comprehensive descriptions (0-5 points)
      if (descLength > 200) score += 5;

      // Penalty for low-quality indicators (0-5 points)
      if (result.description.includes("...") || descLength < 50) score -= 5;

      // Bonus for specific content indicators
      const qualityIndicators = [
        "learn",
        "understand",
        "discover",
        "find out",
        "explore",
        "step-by-step",
        "comprehensive",
      ];
      if (
        qualityIndicators.some((indicator) =>
          result.description.toLowerCase().includes(indicator),
        )
      ) {
        score += 3;
      }
    }

    // URL authority and trust (0-25 points) - trust factor for credibility
    if (result.url || result.link) {
      try {
        const url = result.url || result.link;
        const domain = new URL(url).hostname;

        // High-authority domains (trusted sources)
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
          "nasa.gov",
          "nist.gov",
          "ibm.com",
          "google.com",
          "microsoft.com",
          "amazon.com",
          "apple.com",
          "cloud.google.com",
          "aws.amazon.com",
          "azure.microsoft.com",
        ];

        // Medium-authority domains (reputable sources)
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
          "britannica.com",
          "investopedia.com",
          "coursera.org",
          "sciencedirect.com",
          "sas.com",
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
          // Generic domain scoring (0-10 points)
          // Prefer shorter, cleaner domains

          // Bonus for professional TLDs
          if (domain.endsWith(".edu") || domain.endsWith(".gov")) score += 8;
          else if (domain.endsWith(".org")) score += 5;
          else if (domain.endsWith(".com")) score += 3;
          else if (domain.endsWith(".net")) score += 2;

          // Bonus for HTTPS (security indicator)
          if (url.startsWith("https://")) score += 5;

          // Bonus for clean URLs (no excessive parameters)
          if (!url.includes("?") || url.split("?")[1].length < 50) score += 3;

          // Penalty for suspicious or low-quality TLDs
          if (
            domain.includes(".tk") ||
            domain.includes(".ml") ||
            domain.includes(".cf") ||
            domain.includes(".ga") ||
            domain.includes(".click") ||
            domain.includes(".link") ||
            domain.includes(".top")
          )
            score -= 10;

          // Penalty for very long domains (often spammy)
          if (domain.length > 30) score -= 5;
        }
      } catch {
        // Invalid URL - no penalty, just no bonus
        score += 0;
      }
    }

    // Note: The following sections are commented out as they depend on data
    // not available in Presearch API responses. They are preserved for future
    // enhancement if additional data sources are integrated.

    /*
    // Content freshness (0-15 points) - requires publishedDate, lastModified, or timestamp
    if (result.publishedDate || result.lastModified || result.timestamp) {
      const dateStr = result.publishedDate || result.lastModified || result.timestamp;
      try {
        const contentDate = new Date(dateStr);
        const now = new Date();
        const daysDiff = (now - contentDate) / (1000 * 60 * 60 * 24);
        if (daysDiff < 7) score += 15;
        else if (daysDiff < 30) score += 10;
        else if (daysDiff < 90) score += 5;
        else if (daysDiff < 365) score += 2;
      } catch {
        // Invalid date format
      }
    }

    /*
    // The following scoring sections are disabled as they depend on data
    // not available in Presearch API responses:
    
    // Engagement metrics (0-15 points) - requires engagement data
    // Content type bonuses (0-10 points) - requires contentType field  
    // Language and accessibility (0-10 points) - requires language field
    // Structured data presence (0-10 points) - requires schema/structuredData/jsonLd
    // Mobile optimization (0-5 points) - requires mobileFriendly field
    // Content freshness (0-15 points) - requires publishedDate/lastModified/timestamp
    */

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
    } catch {
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
