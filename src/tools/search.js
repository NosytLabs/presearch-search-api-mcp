import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import { resultProcessor } from "../services/resultProcessor.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import {
  robustBoolean,
  robustNumber,
  robustInt,
  robustArray,
} from "../utils/schemas.js";

import {
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
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(1000)
      .describe(
        "Intelligent search query optimized for AI processing. Use specific, well-formed queries for best results. Supports natural language and technical queries.",
      ),
    page: robustInt()
      .min(1)
      .default(1)
      .describe(
        "The page number for paginating search results. Direct mapping to API page parameter. Accepts number or string.",
      ),
    count: robustInt()
      .min(1)
      .max(50)
      .default(15)
      .describe(
        "Number of results to return (1-50). Used for client-side filtering as API returns fixed page size. Accepts number or string.",
      ),
    offset: robustInt()
      .min(0)
      .max(1000)
      .default(0)
      .describe(
        "Pagination offset. Used to calculate page number if page is not provided (page = floor(offset/count) + 1). Accepts number or string.",
      ),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .optional()
      .describe("Language filtering using BCP 47 codes, e.g. en or en-US."),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .describe(
        "Country filtering using ISO 3166-1 alpha-2 codes (e.g., US, CA, UK). Restricts results to a specific country.",
      ),
    ip: z
      .string()
      .optional()
      .describe(
        "User IP for localization and compliance. If omitted, a safe default is used.",
      ),
    location: z
      .union([
        z.object({
          lat: z.number().describe("Latitude coordinate."),
          long: z.number().describe("Longitude coordinate."),
        }),
        z.string().transform((val) => {
          try {
            return JSON.parse(val);
          } catch {
            return undefined;
          }
        }),
      ])
      .optional()
      .describe(
        "Geolocation override with coordinates for localized results. Can be {lat, long} object or JSON string.",
      ),
    safesearch: z
      .enum(["off", "moderate", "strict"])
      .default("moderate")
      .describe(
        "Content safety filtering level. Maps to API safe parameter (off->0, moderate->1, strict->1).",
      ),
    freshness: z
      .enum(["hour", "day", "week", "month", "year", "all"])
      .default("all")
      .describe(
        "Temporal filtering for recency. Maps to API time parameter (hour->day, all->any).",
      ),
    include_metadata: robustBoolean()
      .default(true)
      .describe(
        "Enable comprehensive metadata extraction for enhanced AI processing. Includes quality scores, domain analysis, content categorization, and technical metrics. Accepts boolean or string 'true'/'false'.",
      ),
    min_quality_score: robustNumber()
      .min(0)
      .max(100)
      .default(0)
      .describe(
        "Quality threshold filtering (0-100). Higher values return more authoritative sources. Recommended: 60+ for research, 80+ for critical applications. Accepts number or string.",
      ),
    content_categories: robustArray(
      z.enum([
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
      ]),
      { max: 5 },
    )
      .optional()
      .describe(
        "Content type filtering for targeted results. Improves relevance by matching content to query intent. Accepts JSON string or comma-separated list.",
      ),
    exclude_domains: robustArray(
      z.string().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
      { max: 20 },
    )
      .optional()
      .describe(
        "Domain exclusion list for filtering unwanted sources. Useful for removing low-quality or biased sources. Accepts JSON string or comma-separated list.",
      ),
    include_analysis: robustBoolean()
      .default(true)
      .describe(
        "Enable AI-powered result analysis with insights, confidence scoring, and usage recommendations. Essential for complex research tasks. Accepts boolean or string 'true'/'false'.",
      ),
    deduplicate: robustBoolean()
      .default(true)
      .describe(
        "Intelligent duplicate removal using content similarity analysis. Ensures unique, high-value results. Accepts boolean or string 'true'/'false'.",
      ),
    timeout_ms: robustInt()
      .min(2000)
      .max(60000)
      .default(10000)
      .describe(
        "Operation timeout in milliseconds. Prevents hanging on slow queries. Recommended: 5000-15000ms. Accepts number or string.",
      ),
  }),
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
          // eslint-disable-next-line no-unused-vars
          results: _results,
          // eslint-disable-next-line no-unused-vars
          standardResults: _standardResults,
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
