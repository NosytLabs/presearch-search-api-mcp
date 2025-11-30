import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import { resultProcessor } from "../services/resultProcessor.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import { withErrorHandling } from "../utils/errors.js";

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

// JSON Schema for MCP compatibility
const SearchInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
    },
    limit: {
      type: "number",
      description: "Number of results to return",
    },
    language: {
      type: "string",
      description: "Language code (e.g., 'en')",
    },
    safe_search: {
      type: "boolean",
      description: "Enable safe search",
    },
  },
  required: ["query"],
};

const search = {
  name: "presearch_ai_search",
  description:
    "Privacy-focused search engine returning ranked results with relevance scores. Supports quotes, minus sign exclusion, and site: operators.",
  inputSchema: SearchInputSchema,
  execute: withErrorHandling(
    "presearch_ai_search",
    async (args, context) => {
      const {
        query,
        limit,
        language,
        safe_search,
      } = args;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        throw new Error("Invalid query: expected non-empty string");
      }
      
      // Map boolean safe_search to API string values
      const safe = safe_search ? "strict" : "off";

      const searchParams = {
        q: query,
        // map limit to count (max 100)
        count: limit ? Math.min(limit, 100) : 10,
        lang: language,
        safe: safe,
      };

      const response = await presearchService.search(
        searchParams,
        context?.apiKey,
      );

      const results = response.results || [];
      const { results: parsedResults, metadata } = await _parseResults(
        results,
        { ...args, count: limit } // Pass limit as count for _parseResults logic
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
  ),
};

export const searchTool = search;
export default search;
