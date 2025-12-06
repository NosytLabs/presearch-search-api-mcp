import NodeCache from "node-cache";
import logger from "../core/logger.js";

export class ContentAnalysisService {
  constructor() {
    // Initialize cache for analysis results (TTL: 5 minutes)
    this.analysisCache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60,
      useClones: false, // Better performance for objects
    });

    // Pre-computed credible domains and descriptive words for faster lookups
    this.credibleDomains = new Set([
      ".edu",
      ".gov",
      ".org",
      "wikipedia",
      "medium",
      "github",
      ".ac.uk",
      ".gov.uk",
      ".edu.au",
      ".gov.au",
      ".edu.ca",
      ".gc.ca",
    ]);

    this.descriptiveWords = new Set([
      "guide",
      "how",
      "what",
      "why",
      "best",
      "review",
      "analysis",
      "complete",
      "tutorial",
      "examples",
      "tips",
    ]);

    // Cache for expensive regex operations
    this.regexCache = new Map();
  }

  /**
   * Generate cache key for content analysis
   */
  _generateCacheKey(content, options) {
    const contentHash = this._simpleHash(
      JSON.stringify({
        title: content.title,
        description: content.description,
        content: content.content?.substring(0, 500), // First 500 chars for hash
        domain: content.domain,
        url: content.url,
      }),
    );

    const optionsHash = this._simpleHash(
      JSON.stringify({
        min_quality_score: options.min_quality_score,
        country: options.country,
        research_focus: options.research_focus,
        custom_keywords: options.custom_keywords,
      }),
    );

    return `analysis:${contentHash}:${optionsHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  _simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached regex pattern
   */
  _getCachedRegex(pattern, flags = "i") {
    const key = `${pattern}:${flags}`;
    // Check regex cache size and evict if needed
    if (this.regexCache.size > 1000) {
        // Simple eviction of the first added entry (LRU-like for Map)
        const firstKey = this.regexCache.keys().next().value;
        this.regexCache.delete(firstKey);
    }
    if (!this.regexCache.has(key)) {
      this.regexCache.set(key, new RegExp(pattern, flags));
    }
    return this.regexCache.get(key);
  }

  /**
   * Analyze content quality with caching
   */
  analyzeContentQuality(content, options = {}) {
    const cacheKey = this._generateCacheKey(content, options);

    // Check cache first
    const cached = this.analysisCache.get(cacheKey);
    if (cached) {
      logger.debug("Content quality analysis cache hit", { url: content.url });
      return cached;
    }

    const analysis = {
      overall_quality_score: 0,
      quality_factors: {},
      quality_issues: [],
    };

    // Quality scoring factors
    let quality_score = 0;
    const factors = {};

    // Title quality (0-25 points) - optimized
    if (content.title) {
      const title_length = content.title.length;
      if (title_length >= 30 && title_length <= 120) factors.title_length = 25;
      else if (title_length >= 20 && title_length < 30)
        factors.title_length = 20;
      else if (title_length > 120) factors.title_length = 15;
      else factors.title_length = 10;

      // Title descriptiveness - optimized with Set lookup
      const titleLower = content.title.toLowerCase();
      const has_descriptive = Array.from(this.descriptiveWords).some((word) =>
        titleLower.includes(word),
      );
      factors.title_descriptive = has_descriptive ? 15 : 5;
    } else {
      factors.title_length = 0;
      factors.title_descriptive = 0;
      analysis.quality_issues.push("Missing title");
    }

    // Description quality (0-25 points)
    if (content.description) {
      const desc_length = content.description.length;
      if (desc_length >= 100 && desc_length <= 300)
        factors.description_length = 25;
      else if (desc_length >= 50 && desc_length < 100)
        factors.description_length = 20;
      else if (desc_length > 300) factors.description_length = 15;
      else factors.description_length = 10;

      // Description completeness - optimized
      const has_keywords = content.title
        ? content.description.includes(content.title.split(" ")[0]) ||
          desc_length > 80
        : desc_length > 80;
      factors.description_completeness = has_keywords ? 15 : 10;
    } else {
      factors.description_length = 0;
      factors.description_completeness = 0;
      analysis.quality_issues.push("Missing description");
    }

    // Content depth (0-20 points)
    if (content.content) {
      const content_length = content.content.length;
      if (content_length > 2000) factors.content_depth = 20;
      else if (content_length > 1000) factors.content_depth = 15;
      else if (content_length > 500) factors.content_depth = 10;
      else factors.content_depth = 5;
    } else {
      factors.content_depth = 0;
    }

    // Source credibility (0-15 points) - optimized with Set lookup
    if (content.domain) {
      const domainLower = content.domain.toLowerCase();
      const is_credible = Array.from(this.credibleDomains).some((domain) =>
        domainLower.includes(domain),
      );
      factors.source_credibility = is_credible ? 15 : 8;

      // Additional country-specific credibility check
      if (options.country) {
        const countryDomains = this._getCountrySpecificDomains(options.country);
        const hasCountryCredibility = countryDomains.some((domain) =>
          domainLower.includes(domain),
        );
        if (hasCountryCredibility) {
          factors.source_credibility = Math.min(
            20,
            factors.source_credibility + 5,
          );
        }
      }
    } else {
      factors.source_credibility = 0;
      analysis.quality_issues.push("Missing domain information");
    }

    // Content freshness (0-15 points)
    if (content.published_date) {
      const published = new Date(content.published_date);
      const now = new Date();
      const days_old = Math.floor((now - published) / (1000 * 60 * 60 * 24));

      if (days_old <= 7) factors.content_freshness = 15;
      else if (days_old <= 30) factors.content_freshness = 12;
      else if (days_old <= 180) factors.content_freshness = 8;
      else factors.content_freshness = 5;
    } else {
      factors.content_freshness = 5; // Neutral score if no date
    }

    // Calculate overall score
    quality_score = Object.values(factors).reduce(
      (sum, score) => sum + score,
      0,
    );
    analysis.overall_quality_score = Math.round(quality_score);
    analysis.quality_factors = factors;

    // Quality threshold check
    const min_score = options.min_quality_score || 0;
    analysis.meets_quality_threshold =
      analysis.overall_quality_score >= min_score;

    // Cache the result
    this.analysisCache.set(cacheKey, analysis);

    logger.debug("Content quality analysis completed", {
      url: content.url,
      score: analysis.overall_quality_score,
      cache_miss: true,
    });

    return analysis;
  }

  /**
   * Get country-specific credible domains
   */
  _getCountrySpecificDomains(country) {
    const countryLower = country.toLowerCase();
    const domainMap = {
      us: [".gov", ".edu", ".mil"],
      uk: [".gov.uk", ".ac.uk", ".nhs.uk"],
      au: [".gov.au", ".edu.au", ".com.au"],
      ca: [".gc.ca", ".gov.ca", ".edu.ca"],
      de: [".bund.de", ".gov.de", ".edu.de"],
      fr: [".gouv.fr", ".edu.fr", ".ac.fr"],
    };

    return domainMap[countryLower] || [".gov", ".edu"];
  }

  /**
   * Analyze content relevance with caching
   */
  analyzeRelevance(content, options = {}) {
    const cacheKey = `relevance:${this._simpleHash(
      JSON.stringify({
        content: content.content?.substring(0, 1000),
        title: content.title,
        description: content.description,
        research_focus: options.research_focus,
        custom_keywords: options.custom_keywords,
      }),
    )}`;

    const cached = this.analysisCache.get(cacheKey);
    if (cached) {
      logger.debug("Relevance analysis cache hit", { url: content.url });
      return cached;
    }

    const research_focus = options.research_focus || "";
    const custom_keywords = options.custom_keywords || [];
    const all_keywords = [research_focus, ...custom_keywords]
      .filter(Boolean)
      .map((k) => k.toLowerCase());

    if (all_keywords.length === 0) {
      const result = {
        relevance_score: 50,
        focus_alignment: "medium",
        keyword_matches: [],
        confidence: 0,
      };
      this.analysisCache.set(cacheKey, result);
      return result;
    }

    // Combine all text content for analysis
    const combined_text = [
      content.title || "",
      content.description || "",
      content.content || "",
    ]
      .join(" ")
      .toLowerCase();

    // Count keyword matches
    const keyword_matches = [];
    let total_matches = 0;

    all_keywords.forEach((keyword) => {
      const regex = this._getCachedRegex(
        `\\b${this._escapeRegex(keyword)}\\b`,
        "gi",
      );
      const matches = combined_text.match(regex);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        keyword_matches.push({ keyword, count });
        total_matches += count;
      }
    });

    // Calculate relevance score
    const text_length = combined_text.length;
    const keyword_density =
      text_length > 0 ? (total_matches / text_length) * 1000 : 0;

    let relevance_score = Math.min(100, keyword_density * 5);

    // Boost score for title/description matches
    const title_desc_text =
      `${content.title || ""} ${content.description || ""}`.toLowerCase();
    const title_desc_matches = all_keywords.filter((keyword) =>
      title_desc_text.includes(keyword),
    ).length;

    if (title_desc_matches > 0) {
      relevance_score = Math.min(
        100,
        relevance_score + title_desc_matches * 15,
      );
    }

    // Determine focus alignment
    let focus_alignment = "low";
    if (relevance_score >= 70) focus_alignment = "high";
    else if (relevance_score >= 40) focus_alignment = "medium";

    const result = {
      relevance_score: Math.round(relevance_score),
      focus_alignment,
      keyword_matches,
      confidence: Math.min(1, keyword_matches.length / all_keywords.length),
    };

    this.analysisCache.set(cacheKey, result);
    return result;
  }

  /**
   * Escape regex special characters
   */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Analyze patterns with performance optimizations
   */
  analyzePatterns(content_array, options = {}) {
    if (!content_array || content_array.length === 0) {
      return {
        total_sources: 0,
        source_distribution: {},
        temporal_distribution: {},
        content_type_distribution: {},
        keyword_frequency: {},
        trends: [],
      };
    }

    const patterns = {
      total_sources: content_array.length,
      source_distribution: {},
      temporal_distribution: {},
      content_type_distribution: {},
      keyword_frequency: {},
      trends: [],
    };

    // Use Map for faster lookups
    const sourceMap = new Map();
    const temporalMap = new Map();
    const typeMap = new Map();
    const keywordMap = new Map();

    // Process all content in single pass
    content_array.forEach((content) => {
      // Source distribution
      const domain = this._extractDomain(content.url);
      sourceMap.set(domain, (sourceMap.get(domain) || 0) + 1);

      // Temporal distribution
      if (content.published_date) {
        const date = new Date(content.published_date);
        const month_key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        temporalMap.set(month_key, (temporalMap.get(month_key) || 0) + 1);
      }

      // Content type distribution
      const content_type = this._detectContentType(content);
      typeMap.set(content_type, (typeMap.get(content_type) || 0) + 1);

      // Keyword frequency (top 20 most common words)
      const text = `${content.title} ${content.description}`.toLowerCase();
      const words = text.match(/\b[a-z]{3,}\b/g) || [];

      words.forEach((word) => {
        if (!this._isStopWord(word)) {
          keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
        }
      });
    });

    // Convert Maps to objects and sort
    patterns.source_distribution = Object.fromEntries(sourceMap);
    patterns.temporal_distribution = Object.fromEntries(temporalMap);
    patterns.content_type_distribution = Object.fromEntries(typeMap);

    // Get top 20 keywords
    patterns.keyword_frequency = Object.fromEntries(
      Array.from(keywordMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
    );

    // Temporal analysis if requested
    if (options.include_temporal_analysis && temporalMap.size > 1) {
      patterns.trends = this._analyzeTemporalTrends(temporalMap);
    }

    return patterns;
  }

  /**
   * Extract domain from URL
   */
  _extractDomain(url) {
    if (!url) return "unknown";
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "unknown";
    }
  }

  /**
   * Detect content type
   */
  _detectContentType(content) {
    const url = content.url || "";
    const title = content.title || "";

    if (url.includes("youtube") || url.includes("video")) return "video";
    if (url.includes("github") || title.includes("github")) return "repository";
    if (url.includes("wikipedia")) return "encyclopedia";
    if (url.includes("news") || title.includes("news")) return "news";
    if (url.includes("blog") || title.includes("blog")) return "blog";
    if (url.includes("forum") || title.includes("forum")) return "forum";

    return "article";
  }

  /**
   * Check if word is a stop word
   */
  _isStopWord(word) {
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "are",
      "but",
      "not",
      "you",
      "all",
      "can",
      "had",
      "her",
      "was",
      "one",
      "our",
      "out",
      "day",
      "get",
      "has",
      "him",
      "his",
      "how",
      "man",
      "new",
      "now",
      "old",
      "see",
      "two",
      "way",
      "who",
      "boy",
      "did",
      "its",
      "let",
      "put",
      "say",
      "she",
      "too",
      "use",
    ]);
    return stopWords.has(word);
  }

  /**
   * Analyze temporal trends
   */
  _analyzeTemporalTrends(temporalMap) {
    const entries = Array.from(temporalMap.entries()).sort();
    const trends = [];

    if (entries.length < 2) return trends;

    // Calculate trend direction
    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < entries.length; i++) {
      const current = entries[i][1];
      const previous = entries[i - 1][1];

      if (current > previous) increasing++;
      else if (current < previous) decreasing++;
    }

    if (increasing > decreasing) {
      trends.push({
        type: "increasing_activity",
        description: "Content publication activity is increasing over time",
        confidence: increasing / (entries.length - 1),
      });
    } else if (decreasing > increasing) {
      trends.push({
        type: "decreasing_activity",
        description: "Content publication activity is decreasing over time",
        confidence: decreasing / (entries.length - 1),
      });
    }

    return trends;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis_data) {
    const recommendations = [];

    if (!analysis_data) return recommendations;

    // Quality recommendations
    if (analysis_data.quality_analysis) {
      const avg_quality = analysis_data.quality_analysis.average_quality_score;

      if (avg_quality < 60) {
        recommendations.push({
          type: "quality",
          priority: "high",
          recommendation:
            "Focus on higher quality sources to improve overall content quality.",
        });
      }

      const low_quality_count = analysis_data.quality_analysis.details.filter(
        (item) => item.overall_quality_score < 50,
      ).length;

      if (
        low_quality_count >
        analysis_data.quality_analysis.details.length * 0.3
      ) {
        recommendations.push({
          type: "quality",
          priority: "medium",
          recommendation:
            "Consider filtering out low-quality sources to improve analysis reliability.",
        });
      }
    }

    // Relevance recommendations
    if (analysis_data.relevance_analysis) {
      const avg_relevance =
        analysis_data.relevance_analysis.average_relevance_score;

      if (avg_relevance < 40) {
        recommendations.push({
          type: "relevance",
          priority: "medium",
          recommendation:
            "Consider refining search terms to improve relevance to research focus.",
        });
      }
    }

    // Source diversity recommendations
    if (analysis_data.patterns_analysis) {
      const source_count = Object.keys(
        analysis_data.patterns_analysis.source_distribution,
      ).length;

      if (source_count < 3) {
        recommendations.push({
          type: "diversity",
          priority: "medium",
          recommendation:
            "Increase source diversity for more comprehensive analysis.",
        });
      }
    }

    return recommendations;
  }

  /**
   * Perform comprehensive analysis with caching
   */
  async analyze(content_to_analyze, args) {
    const startTime = Date.now();

    // Generate cache key for the entire analysis
    const analysisCacheKey = `comprehensive:${this._simpleHash(
      JSON.stringify({
        content_count: content_to_analyze.length,
        args: args,
      }),
    )}`;

    // Check if we have cached comprehensive analysis
    const cachedAnalysis = this.analysisCache.get(analysisCacheKey);
    if (cachedAnalysis && !args.skip_cache) {
      logger.debug("Comprehensive analysis cache hit", {
        content_count: content_to_analyze.length,
        execution_time: Date.now() - startTime,
      });
      return cachedAnalysis;
    }

    const analysis_results = {
      summary: {},
      detailed_analysis: {},
    };

    // 1. Analyze Quality
    if (args.include_quality_assessment) {
      const quality_results = content_to_analyze.map((content) => ({
        url: content.url,
        title: content.title,
        ...this.analyzeContentQuality(content, {
          min_quality_score: args.min_quality_score,
          country: args.country,
        }),
      }));

      const avg_score =
        quality_results.reduce(
          (sum, res) => sum + res.overall_quality_score,
          0,
        ) / quality_results.length;

      analysis_results.quality_analysis = {
        average_quality_score: avg_score,
        items_meeting_threshold: quality_results.filter(
          (r) => r.meets_quality_threshold,
        ).length,
        details: quality_results,
      };
    }

    // 2. Analyze Relevance
    if (args.include_relevance_scoring) {
      const relevance_results = content_to_analyze.map((content) => ({
        url: content.url,
        ...this.analyzeRelevance(content, {
          research_focus: args.research_focus,
          custom_keywords: args.custom_keywords,
          country: args.country,
        }),
      }));

      const avg_relevance =
        relevance_results.reduce((sum, res) => sum + res.relevance_score, 0) /
        relevance_results.length;

      analysis_results.relevance_analysis = {
        average_relevance_score: avg_relevance,
        focus_alignment_distribution: {
          high: relevance_results.filter((r) => r.focus_alignment === "high")
            .length,
          medium: relevance_results.filter(
            (r) => r.focus_alignment === "medium",
          ).length,
          low: relevance_results.filter((r) => r.focus_alignment === "low")
            .length,
        },
        details: relevance_results,
      };
    }

    // 3. Analyze Patterns
    if (args.include_pattern_analysis) {
      analysis_results.patterns_analysis = this.analyzePatterns(
        content_to_analyze,
        {
          include_temporal_analysis: args.include_temporal_analysis,
        },
      );
    }

    // Cache the comprehensive analysis
    this.analysisCache.set(analysisCacheKey, analysis_results);

    const executionTime = Date.now() - startTime;
    logger.info("Comprehensive analysis completed", {
      content_count: content_to_analyze.length,
      execution_time: executionTime,
      cache_miss: true,
    });

    return analysis_results;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      analysis_cache: this.analysisCache.getStats(),
      regex_cache_size: this.regexCache.size,
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.flushAll();
    this.regexCache.clear();
    logger.info("Content analysis cache cleared");
  }
}

export default new ContentAnalysisService();
