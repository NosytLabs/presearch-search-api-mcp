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

// JSON Schema for MCP compatibility
const SearchInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "The search query to execute. Supports advanced operators like 'site:', 'quotes', and minus sign exclusion.",
    },
    limit: {
      type: "number",
      description:
        "The maximum number of search results to return. Defaults to 10, max 100.",
    },
    language: {
      type: "string",
      description:
        "The language code for the search results (e.g., 'en-US', 'es'). Defaults to 'en-US'.",
    },
    safe_search: {
      type: "boolean",
      description: "Enable or disable safe search filtering. Defaults to true.",
    },
    include_analysis: {
      type: "boolean",
      description: "Include AI analysis of the results.",
    },
  },
  required: ["query"],
};

const search = {
  name: "presearch_ai_search",
  description:
    "Privacy-focused search engine returning ranked results with relevance scores. Supports quotes, minus sign exclusion, and site: operators.",
  inputSchema: SearchInputSchema,
  tags: ["search", "web"],
  execute: withErrorHandling("presearch_ai_search", async (args, context) => {
    const { query, limit, language, safe_search } = args;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Invalid query: expected non-empty string");
    }

    // Map boolean safe_search to API string values
    const safe = safe_search ? "strict" : "off";

    const searchParams = {
      q: query,
      count: limit ? Math.min(limit, 100) : 10,
      lang: language,
      safe: safe,
    };

    const response = await presearchService.search(
      searchParams,
      context?.apiKey,
    );

    const results = response.results || [];

    // Use ResultProcessor for normalization, filtering, deduplication and scoring
    const processingResult = await resultProcessor.processResults(
      results,
      query,
      {
        count: limit,
      },
    );

    const parsedResults = processingResult.results;
    const processorMetadata = processingResult.metadata;

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
        const patternAnalysis = contentAnalysisService.analyzePatterns(
          parsedResults,
          {
            include_temporal_analysis: true,
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
      success: true,
      results: parsedResults,
      metadata: {
        ...processorMetadata,
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
  }),
};

export const searchTool = search;
export default search;
