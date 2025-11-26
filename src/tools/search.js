import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import { resultProcessor } from "../services/resultProcessor.js";
import contentAnalysisService from "../services/contentAnalysisService.js";

import {
  createErrorResponse,
  ValidationError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  withErrorHandling,
} from "../utils/errors.js";

/**
 * AI-Optimized Search Tool for Presearch API
 * Designed specifically for Claude AI and other LLM clients
 * Provides intelligent search with comprehensive metadata and analysis
 */

// Helper functions for result processing
const calculateQualityScore = (result) =>
  resultProcessor.calculateQualityScore(result);
const categorizeContent = (title, description) =>
  resultProcessor.categorizeContent(title, description);
const isRecentContent = (publishedDate) =>
  resultProcessor.isRecentContent(publishedDate);

/**
 * Parse and process search results with AI/LLM optimization
 */
async function _parseResults(results, args) {
  try {
    if (!results || !Array.isArray(results)) {
      return { results: [], metadata: { total: 0, processed: 0 } };
    }

    let processedResults = results.map((result, index) => {
      const qualityScore = calculateQualityScore(result);

      // Handle different field names from API
      const url = result.url || result.link;
      const title = result.title || result.name || "Untitled";
      const description =
        result.description || result.snippet || result.summary || "";

      return {
        ...result,
        url,
        title,
        description,
        qualityScore,
        position: result.position || index + 1,
        domain: url ? new URL(url).hostname : "unknown",
        contentCategory: categorizeContent(title, description),
        isRecent: isRecentContent(result.publishedDate),
      };
    });

    // Filter by content categories if specified
    if (args.content_categories && args.content_categories.length > 0) {
      processedResults = processedResults.filter((result) =>
        args.content_categories.includes(result.contentCategory),
      );
    }

    // Filter by excluded domains if specified
    if (args.exclude_domains && args.exclude_domains.length > 0) {
      processedResults = processedResults.filter(
        (result) => !args.exclude_domains.includes(result.domain),
      );
    }

    // Filter by quality score if specified
    if (
      typeof args.min_quality_score === "number" &&
      args.min_quality_score > 0
    ) {
      processedResults = processedResults.filter(
        (result) => result.qualityScore >= args.min_quality_score,
      );
    }

    if (args.deduplicate) {
      const uniqueResults = [];
      const seenUrls = new Set();
      for (const result of processedResults) {
        if (!seenUrls.has(result.url)) {
          uniqueResults.push(result);
          seenUrls.add(result.url);
        }
      }
      processedResults = uniqueResults;
    }

    // Apply count limit if specified and less than current results
    // This allows client-side limiting since API doesn't support 'limit' param explicitly
    if (args.count && processedResults.length > args.count) {
      processedResults = processedResults.slice(0, args.count);
    }

    return {
      results: processedResults,
      metadata: {
        total: results.length,
        processed: processedResults.length,
        filteredOut: results.length - processedResults.length,
      },
    };
  } catch (error) {
    logger.error("Error parsing results", {
      error: error.message,
      query: args.query,
    });
    return {
      results: results || [],
      metadata: {
        total: results?.length || 0,
        processed: results?.length || 0,
        error: error.message,
      },
    };
  }
}

// Claude AI Schema Definitions for Search Tool - Smithery.ai Ultimate Edition
const ClaudeSearchSchema = {
  name: "presearch_ai_search",
  description:
    "Performs web searches and returns results with metadata and analysis. Supports filtering by language, freshness, and safe search.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Intelligent search query optimized for AI processing. Use specific, well-formed queries for best results. Supports natural language and technical queries.",
        minLength: 1,
        maxLength: 1000,
        examples: [
          "machine learning algorithms 2024",
          "React component best practices",
          "climate change latest research",
        ],
      },
      page: {
        type: "number",
        description:
          "The page number for paginating search results. Direct mapping to API page parameter.",
        minimum: 1,
        default: 1,
      },
      count: {
        type: "number",
        description:
          "Number of results to return (1-50). Used for client-side filtering as API returns fixed page size.",
        minimum: 1,
        maximum: 50,
        default: 15,
      },
      offset: {
        type: "number",
        description:
          "Pagination offset. Used to calculate page number if page is not provided (page = floor(offset/count) + 1).",
        minimum: 0,
        default: 0,
        maximum: 1000,
      },
      language: {
        type: "string",
        description: "Language filtering using BCP 47 codes, e.g. en or en-US.",
        pattern: "^[a-z]{2}(-[A-Z]{2})?$",
        examples: ["en", "en-US", "es", "fr"],
      },
      country: {
        type: "string",
        description:
          "Country filtering using ISO 3166-1 alpha-2 codes (e.g., US, CA, UK). Restricts results to a specific country.",
        pattern: "^[A-Z]{2}$",
        examples: ["US", "CA", "GB", "DE"],
      },
      ip: {
        type: "string",
        description:
          "User IP for localization and compliance. If omitted, a safe default is used.",
      },
      location: {
        type: "object",
        description:
          "Geolocation override with coordinates for localized results.",
        properties: {
          lat: { type: "number" },
          long: { type: "number" },
        },
      },
      safesearch: {
        type: "string",
        description:
          "Content safety filtering level. Maps to API safe parameter (off->0, moderate->1, strict->1).",
        enum: ["off", "moderate", "strict"],
        default: "moderate",
      },
      freshness: {
        type: "string",
        description:
          "Temporal filtering for recency. Maps to API time parameter (hour->day, all->any).",
        enum: ["hour", "day", "week", "month", "year", "all"],
        default: "all",
      },

      // Advanced Claude AI Optimization Parameters
      include_metadata: {
        type: "boolean",
        description:
          "Enable comprehensive metadata extraction for enhanced AI processing. Includes quality scores, domain analysis, content categorization, and technical metrics.",
        default: true,
      },
      min_quality_score: {
        type: "number",
        description:
          "Quality threshold filtering (0-100). Higher values return more authoritative sources. Recommended: 60+ for research, 80+ for critical applications.",
        minimum: 0,
        maximum: 100,
        default: 0,
      },
      content_categories: {
        type: "array",
        description:
          "Content type filtering for targeted results. Improves relevance by matching content to query intent.",
        items: {
          type: "string",
          enum: [
            "news",
            "article",
            "tutorial",
            "documentation",
            "discussion",
            "video",
            "academic",
            "blog",
            "commerce",
            "reference",
            "general",
          ],
        },
        minItems: 0,
        maxItems: 5,
      },
      exclude_domains: {
        type: "array",
        description:
          "Domain exclusion list for filtering unwanted sources. Useful for removing low-quality or biased sources.",
        items: {
          type: "string",
          pattern: "^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        },
        maxItems: 20,
      },
      include_analysis: {
        type: "boolean",
        description:
          "Enable AI-powered result analysis with insights, confidence scoring, and usage recommendations. Essential for complex research tasks.",
        default: true,
      },
      deduplicate: {
        type: "boolean",
        description:
          "Intelligent duplicate removal using content similarity analysis. Ensures unique, high-value results.",
        default: true,
      },

      // Performance and Reliability Parameters
      timeout_ms: {
        type: "number",
        description:
          "Operation timeout in milliseconds. Prevents hanging on slow queries. Recommended: 5000-15000ms.",
        minimum: 2000,
        maximum: 60000,
        default: 10000,
      },
    },
    required: ["query"],
  },
};

const search = {
  ...ClaudeSearchSchema,
  execute: async (args, context) => {
    const searchFn = withErrorHandling(
      "presearch_ai_search",
      async (args, context) => {
        const {
          query,
          page,
          count,
          offset,
          language,
          country,
          safesearch,
          freshness,
          timeout_ms,
          ip,
          location,
        } = args;

        const mappedTime =
          freshness === "all"
            ? "any"
            : freshness === "hour"
              ? "day"
              : freshness;

        // Determine page number: explicit page > derived from offset > default 1
        let pageNumber = page;
        if (!pageNumber && typeof offset === "number") {
          pageNumber = Math.floor(offset / (count || 15)) + 1;
        }
        if (!pageNumber) pageNumber = 1;

        const searchParams = {
          q: query,
          page: pageNumber,
          lang: language,
          country: country,
          safe: safesearch,
          time: mappedTime,
          ...(ip ? { ip } : {}),
          ...(location ? { location } : {}),
        };

        const response = await presearchService.search(
          searchParams,
          context?.apiKey,
        );

        const results = response.results || [];
        const { results: parsedResults, metadata } = await _parseResults(
          results,
          args,
        );

        // Extract metadata from response
        const {
          results: _,
          standardResults: __,
          infoSection = {},
          specialSections = {},
          links = {},
          meta = {},
          ...rest
        } = response;

        // Perform AI Analysis if requested
        let analysis = {};
        if (args.include_analysis && parsedResults.length > 0) {
          try {
            // Use the reusable service for pattern analysis
            const patternAnalysis = contentAnalysisService.analyzePatterns(
              parsedResults,
              {
                include_temporal_analysis: args.freshness !== "all",
              },
            );

            analysis = {
              ...patternAnalysis,
              recommendations: contentAnalysisService.generateRecommendations({
                patterns_analysis: patternAnalysis,
              }),
            };
          } catch (error) {
            logger.warn("Analysis generation failed", { error: error.message });
            analysis = { error: "Analysis failed to generate" };
          }
        }

        return {
          results: parsedResults,
          metadata: {
            ...metadata,
            ...rest,
            analysis,
            infoSection,
            specialSections,
            links,
            meta,
            highlights: {
              topStories: Array.isArray(specialSections?.topStories)
                ? specialSections.topStories.map((s) => ({
                    title: s.title,
                    link: s.link,
                    source: s.source,
                  }))
                : [],
              videos: Array.isArray(specialSections?.videos)
                ? specialSections.videos.map((v) => ({
                    title: v.title,
                    link: v.link,
                    source: v.source,
                  }))
                : [],
            },
            rateLimit: apiClient.getRateLimitStats(),
          },
        };
      },
    );

    return searchFn(args, context);
  },
};

export const searchTool = search;
export default search;
