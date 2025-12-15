import { z } from "zod";
import { withErrorHandling } from "../utils/errors.js";
import { logToolUsage } from "../utils/logging.js";
import { getConfig } from "../core/config.js";

const SearchInputSchema = z.object({
  query: z
    .string()
    .min(1, "Search query cannot be empty")
    .describe(
      "The search query to execute. Supports advanced operators like 'site:', 'quotes', and minus sign exclusion.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return (1-100)"),
  include_analysis: z
    .boolean()
    .default(false)
    .describe("Include AI-powered analysis of search results"),
  safe_search: z
    .enum(["off", "moderate", "strict"])
    .default("moderate")
    .describe("Safe search filtering level"),
  language: z
    .string()
    .default("en-US")
    .describe("Language for search results"),
  time_range: z
    .enum(["any", "day", "week", "month", "year"])
    .optional()
    .describe("Time range filter for results"),
  region: z
    .string()
    .optional()
    .describe("Geographic region for search results"),
});

export const searchTool = {
  name: "presearch_ai_search",
  description:
    "Perform AI-optimized web search using Presearch decentralized search engine. Returns comprehensive results with titles, URLs, snippets, and optional AI analysis. Supports advanced search operators and filtering.",
  inputSchema: SearchInputSchema,
  execute: withErrorHandling(
    async ({
      query,
      limit,
      include_analysis,
      safe_search,
      language,
      time_range,
      region,
    }) => {
      const config = getConfig();
      const startTime = Date.now();

      logToolUsage("presearch_ai_search", {
        query,
        limit,
        include_analysis,
        safe_search,
        language,
        time_range,
        region,
      });

      // Build search parameters
      const searchParams = {
        q: query,
        max_results: limit,
        safe_search: safe_search || config.presearch.safe_search,
        language: language || config.presearch.default_language,
        ...(time_range && { time_range }),
        ...(region && { region }),
      };

      try {
        const searchResults = await config.presearchClient.search(searchParams);

        // Add AI analysis if requested
        let analysis = null;
        if (include_analysis && searchResults.results?.length > 0) {
          analysis = await config.aiService.analyzeSearchResults(
            query,
            searchResults.results,
          );
        }

        const response = {
          query,
          total_results: searchResults.total_results || searchResults.results?.length || 0,
          results: searchResults.results || [],
          search_metadata: {
            engine: "presearch",
            language: searchParams.language,
            safe_search: searchParams.safe_search,
            timestamp: new Date().toISOString(),
            response_time_ms: Date.now() - startTime,
          },
          ...(analysis && { analysis }),
        };

        return response;
      } catch (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
    },
  ),
};

export default searchTool;