import { z } from "zod";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import { withErrorHandling } from "../utils/errors.js";
import { robustInt, robustNumber } from "../utils/schemas.js";

const DeepResearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The research topic or question. Example: 'impact of ai on healthcare'.",
    ),
  depth: robustInt()
    .min(1)
    .max(10)
    .default(3)
    .describe(
      "Number of source pages to scrape and analyze (1-10). Accepts number or string. Example: 3.",
    ),
  breadth: robustInt()
    .min(5)
    .max(20)
    .default(10)
    .describe(
      "Number of search results to consider for selection (5-20). Accepts number or string. Example: 10.",
    ),
  research_focus: z
    .enum(["general", "academic", "market", "technical", "news"])
    .default("general")
    .describe(
      "The context of the research to guide relevance scoring. Example: 'technical'.",
    ),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe(
      "Country filtering using ISO 3166-1 alpha-2 codes (e.g., US, CA, UK). Example: 'US'.",
    ),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .optional()
    .describe(
      "Language filtering using BCP 47 codes (e.g., en-US, es). Example: 'en-US'.",
    ),
  freshness: z
    .enum(["hour", "day", "week", "month", "year", "all"])
    .default("all")
    .describe("Temporal filtering for recency. Example: 'week'."),
  safesearch: z
    .enum(["off", "moderate", "strict"])
    .default("moderate")
    .describe(
      "Content safety filtering level. Defaults to 'moderate'. Example: 'moderate'.",
    ),
  ip: z
    .string()
    .optional()
    .describe("User IP for localization. Example: '1.2.3.4'."),
  location: z
    .union([
      z.object({
        lat: robustNumber().describe(
          "Latitude coordinate. Accepts number or string. Example: 37.7749.",
        ),
        long: robustNumber().describe(
          "Longitude coordinate. Accepts number or string. Example: -122.4194.",
        ),
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
      'Geolocation override. Can be {lat, long} object or JSON string. Example: \'{"lat": 40.7128, "long": -74.0060}\'.',
    ),
  timeout_ms: robustInt()
    .default(60000)
    .describe(
      "Timeout in milliseconds for the research session. Default: 60000ms (1 min). Accepts number or string. Example: 60000.",
    ),
});

// JSON Schema for MCP compatibility
const DeepResearchInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The research topic or question. Example: 'impact of ai on healthcare'."
    },
    depth: {
      type: "number",
      description: "Number of source pages to scrape and analyze (1-10).",
      default: 3,
      minimum: 1,
      maximum: 10
    },
    breadth: {
      type: "number",
      description: "Number of search results to consider for selection (5-20).",
      default: 10,
      minimum: 5,
      maximum: 20
    },
    research_focus: {
      type: "string",
      enum: ["general", "academic", "market", "technical", "news"],
      default: "general",
      description: "The context of the research to guide relevance scoring."
    },
    country: {
      type: "string",
      description: "Country filtering using ISO 3166-1 alpha-2 codes (e.g., US, CA)."
    },
    language: {
      type: "string",
      description: "Language filtering using BCP 47 codes (e.g., en-US)."
    },
    freshness: {
      type: "string",
      enum: ["hour", "day", "week", "month", "year", "all"],
      default: "all",
      description: "Temporal filtering for recency."
    },
    safesearch: {
      type: "string",
      enum: ["off", "moderate", "strict"],
      default: "moderate",
      description: "Content safety filtering level."
    },
    timeout_ms: {
      type: "number",
      description: "Timeout in milliseconds for the research session.",
      default: 60000
    }
  },
  required: ["query"]
};

const tool = {
  name: "presearch_deep_research",
  description:
    "Performs a deep research session: searches multiple queries (if needed), scrapes authoritative sources, analyzes content quality/relevance, and synthesizes a comprehensive report with citations. Ideal for complex topics requiring fact-checking or broad overview.",
  inputSchema: DeepResearchInputSchema,
  tags: ["research", "search", "analysis"],
  execute: withErrorHandling(
    "presearch_deep_research",
    async (args, context) => {
      const parsed = DeepResearchSchema.safeParse(args);
      if (!parsed.success)
        return { success: false, error: parsed.error.message };

      const {
        query,
        depth,
        breadth,
        research_focus,
        timeout_ms,
        country,
        language,
        freshness,
        safesearch,
        ip,
        location,
      } = parsed.data;

      logger.info("Starting Deep Research", {
        query,
        depth,
        breadth,
        country,
        research_focus,
      });

      const mappedTime =
        freshness === "all" ? "any" : freshness === "hour" ? "day" : freshness;

      // Step 1: Search
      const searchParams = {
        q: query,
        page: 1,
        country: country,
        lang: language,
        safe: safesearch,
        time: mappedTime,
        ...(ip ? { ip } : {}),
        ...(location ? { location } : {}),
        // Fetch enough results to satisfy breadth
        // Presearch usually returns 10-20 results per page
      };

      const searchData = await presearchService.search(
        searchParams,
        context?.apiKey,
      );
      const searchResults = (searchData.results || []).slice(0, breadth);

      if (searchResults.length === 0) {
        return {
          success: false,
          message: "No search results found to analyze.",
        };
      }

      // Step 2: Select candidates for scraping
      // Simple selection: Top 'depth' results
      // Advanced selection could be added here (e.g., based on initial snippet relevance)
      const candidates = searchResults.slice(0, depth);

      // Step 3: Scrape Content
      const errors = [];

      // Run scrapes in parallel (with limit handled by contentFetcher or simple loop)
      // Using Promise.all for speed, but mindful of rate limits if contentFetcher doesn't handle it
      // contentFetcher usually uses axios which is fine for small batches
      const scrapePromises = candidates.map(async (result) => {
        const url = result.url || result.link;
        if (!url) return null;

        try {
          const fetchResult = await contentFetcher.fetch(url, {
            timeout: Math.floor(timeout_ms / 2), // Allocate half timeout for fetching
            includeText: true,
          });

          return {
            source_result: result,
            url: url,
            title: fetchResult.meta.title || result.title,
            description: fetchResult.meta.description || result.description,
            content: fetchResult.text,
            domain: new URL(url).hostname,
          };
        } catch (error) {
          errors.push({ url, error: error.message });
          return null;
        }
      });

      const results = await Promise.all(scrapePromises);
      const validContent = results.filter((r) => r !== null);

      if (validContent.length === 0) {
        return {
          success: false,
          message: "Failed to scrape any content from search results.",
          errors,
        };
      }

      // Step 4: Analyze Content
      const analysisArgs = {
        include_quality_assessment: true,
        include_relevance_scoring: true,
        include_pattern_analysis: true,
        include_temporal_analysis: true,
        research_focus: research_focus,
        min_quality_score: 40, // Default threshold
      };

      const analysisReport = await contentAnalysisService.analyze(
        validContent,
        analysisArgs,
      );
      const recommendations =
        contentAnalysisService.generateRecommendations(analysisReport);

      // Step 5: Synthesize Report
      return {
        success: true,
        query: query,
        research_summary: {
          sources_analyzed: validContent.length,
          total_search_results: searchResults.length,
          focus: research_focus,
        },
        analysis: analysisReport,
        recommendations: recommendations,
        sources: validContent.map((c) => ({
          title: c.title,
          url: c.url,
          domain: c.domain,
          snippet: c.description,
          content_preview: c.content ? c.content.substring(0, 500) + "..." : "",
        })),
        scrape_errors: errors,
      };
    },
  ),
};

export default tool;
export const deepResearchTool = tool;
