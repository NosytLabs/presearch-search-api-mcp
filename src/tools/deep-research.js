import { z } from "zod";
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import presearchService from "../services/presearchService.js";
import contentFetcher from "../services/contentFetcher.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import { withErrorHandling } from "../utils/errors.js";

const DeepResearchSchema = {
  name: "presearch_deep_research",
  description:
    "Performs a deep research session: searches, scrapes multiple sources, and analyzes content quality and relevance to generate a comprehensive report.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The research topic or question.",
      },
      depth: {
        type: "number",
        description: "Number of source pages to scrape and analyze (1-10).",
        default: 3,
        minimum: 1,
        maximum: 10,
      },
      breadth: {
        type: "number",
        description:
          "Number of search results to consider for selection (5-20).",
        default: 10,
        minimum: 5,
        maximum: 20,
      },
      research_focus: {
        type: "string",
        description: "The context of the research to guide relevance scoring.",
        enum: ["general", "academic", "market", "technical", "news"],
        default: "general",
      },
      country: {
        type: "string",
        description:
          "Country filtering using ISO 3166-1 alpha-2 codes (e.g., US, CA, UK).",
        pattern: "^[A-Z]{2}$",
      },
      language: {
        type: "string",
        description: "Language filtering using BCP 47 codes (e.g., en-US).",
        pattern: "^[a-z]{2}(-[A-Z]{2})?$",
      },
      freshness: {
        type: "string",
        description: "Temporal filtering for recency.",
        enum: ["hour", "day", "week", "month", "year", "all"],
        default: "all",
      },
      safesearch: {
        type: "string",
        description: "Content safety filtering level.",
        enum: ["off", "moderate", "strict"],
        default: "moderate",
      },
      ip: {
        type: "string",
        description: "User IP for localization.",
      },
      location: {
        type: "object",
        description: "Geolocation override.",
        properties: {
          lat: { type: "number" },
          long: { type: "number" },
        },
      },
      timeout_ms: {
        type: "number",
        default: 60000,
      },
    },
    required: ["query"],
  },
};

const tool = {
  ...DeepResearchSchema,
  execute: withErrorHandling(
    "presearch_deep_research",
    async (args, context) => {
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
      } = args;

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
      const scrapedContent = [];
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
