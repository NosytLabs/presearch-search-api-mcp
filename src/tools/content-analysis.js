/**
 * Content Analysis Tool - Separated Analysis Functionality
 *
 * This tool provides comprehensive content analysis for search results and scraped content.
 * It works independently of search and export tools, providing AI-optimized analysis.
 *
 * Key features:
 * - Analyzes search results for quality, relevance, and patterns
 * - Provides research-focused insights for AI/LLM consumption
 * - Configurable analysis types and focus areas
 * - Optimized for Claude AI and other LLM clients
 */

import { z } from "zod";
import logger from "../core/logger.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import { ValidationError, withErrorHandling } from "../utils/errors.js";
import {
  robustBoolean,
  robustNumber,
  robustInt,
  robustArray,
} from "../utils/schemas.js";

// Enhanced schema with AI/LLM optimization
const contentAnalysisSchema = z.object({
  content: robustArray(
    z.object({
      title: z.string().describe("Title of the content item"),
      url: z.string().describe("URL of the content item"),
      description: z
        .string()
        .optional()
        .describe("Description or snippet of the content"),
      content: z.string().optional().describe("Full text content to analyze"),
      source: z.string().optional().describe("Source name or publisher"),
      publishedDate: z
        .string()
        .optional()
        .describe("Publication date (ISO format preferred)"),
      domain: z.string().optional().describe("Domain name of the source"),
      qualityScore: z.number().optional().describe("Initial quality score"),
    }),
    { min: 1 },
  ).describe(
    "Content to analyze - search results, scraped content, or text data. Accepts JSON string.",
  ),

  analysis_type: z
    .enum(["quality", "relevance", "patterns", "research", "comprehensive"])
    .default("comprehensive")
    .describe("Type of analysis to perform"),

  research_focus: z
    .enum(["general", "academic", "market", "technical", "competitive", "news"])
    .default("general")
    .describe("Research focus area for targeted analysis"),

  include_quality_assessment: robustBoolean()
    .default(true)
    .describe(
      "Include detailed quality assessment of content. Accepts boolean or string 'true'/'false'.",
    ),

  include_relevance_scoring: robustBoolean()
    .default(true)
    .describe(
      "Score content relevance to research focus. Accepts boolean or string 'true'/'false'.",
    ),

  include_pattern_analysis: robustBoolean()
    .default(true)
    .describe(
      "Analyze patterns in content (topics, themes, sources). Accepts boolean or string 'true'/'false'.",
    ),

  include_source_analysis: robustBoolean()
    .default(true)
    .describe(
      "Analyze source diversity and credibility. Accepts boolean or string 'true'/'false'.",
    ),

  include_temporal_analysis: robustBoolean()
    .default(true)
    .describe(
      "Analyze temporal patterns and recency. Accepts boolean or string 'true'/'false'.",
    ),

  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe(
      "Country context for analysis (ISO 3166-1 alpha-2 code). Affects quality scoring and relevance.",
    ),

  min_quality_score: robustNumber()
    .min(0)
    .max(100)
    .default(0)
    .describe(
      "Minimum quality score (0-100) for analysis inclusion. Accepts number or string.",
    ),

  max_items: robustInt()
    .min(1)
    .max(200)
    .default(50)
    .describe(
      "Maximum number of items to analyze (1-200). Accepts number or string.",
    ),

  custom_keywords: robustArray(z.string())
    .default([])
    .describe(
      "Custom keywords for relevance scoring. Accepts JSON string or comma-separated list.",
    ),

  exclude_domains: robustArray(z.string())
    .default([])
    .describe(
      "Domains to exclude from analysis. Accepts JSON string or comma-separated list.",
    ),
});

/**
 * Content Analysis Tool - Independent Analysis Functionality
 *
 * Provides comprehensive analysis of search results and content
 * for AI/LLM consumption. Works independently of search and export tools.
 */
export const contentAnalysisTool = {
  name: "analyze_content",
  description:
    "Analyze search results or scraped content for quality, relevance, patterns, and research insights. Provides AI-optimized analysis for Claude AI and other LLM clients.",
  inputSchema: contentAnalysisSchema,
  execute: withErrorHandling(
    "contentAnalysisTool",
    async (rawArgs) => {
      const start_time = Date.now();

      try {
        // Validate and parse input with Zod to apply defaults
        const parsed = contentAnalysisSchema.safeParse(rawArgs);
        if (!parsed.success) {
          throw new ValidationError("Invalid arguments", {
            errors: parsed.error.flatten(),
          });
        }
        const args = parsed.data;

        // Validate input content
        if (!Array.isArray(args.content) || args.content.length === 0) {
          throw new ValidationError("Content must be a non-empty array");
        }

        logger.info("Starting content analysis", {
          analysis_type: args.analysis_type,
          research_focus: args.research_focus,
          content_count: args.content.length,
          max_items: args.max_items,
        });

        // Filter and prepare content
        let content_to_analyze = args.content.slice(0, args.max_items);

        // Filter by quality threshold
        if (args.min_quality_score > 0) {
          content_to_analyze = content_to_analyze.filter(
            (content) => (content.qualityScore || 0) >= args.min_quality_score,
          );
        }

        // Exclude domains
        if (args.exclude_domains && args.exclude_domains.length > 0) {
          content_to_analyze = content_to_analyze.filter((content) => {
            const domain = content.domain || content.url;
            return !args.exclude_domains.some((exclude) =>
              domain.includes(exclude),
            );
          });
        }

        // Perform analysis using the service
        const analysis_results = await contentAnalysisService.analyze(
          content_to_analyze,
          args,
        );

        // Generate recommendations
        const recommendations =
          contentAnalysisService.generateRecommendations(analysis_results);

        // Construct summary
        const summary = {
          total_items: args.content.length,
          analyzed_items: content_to_analyze.length,
          analysis_type: args.analysis_type,
          research_focus: args.research_focus,
          key_insights: [],
        };

        // Add key insights based on analysis
        if (analysis_results.quality_analysis) {
          summary.key_insights.push(
            `Average content quality score: ${Math.round(analysis_results.quality_analysis.average_quality_score)}/100`,
          );
        }

        if (analysis_results.relevance_analysis) {
          summary.key_insights.push(
            `Content relevance alignment: ${Math.round(analysis_results.relevance_analysis.average_relevance_score)}/100`,
          );
          const top_keywords = analysis_results.relevance_analysis.details
            .flatMap((d) => d.key_matches)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((k) => k.keyword);
          if (top_keywords.length > 0) {
            summary.key_insights.push(
              `Top matching keywords: ${[...new Set(top_keywords)].join(", ")}`,
            );
          }
        }

        if (analysis_results.patterns_analysis) {
          const top_themes = analysis_results.patterns_analysis.common_themes
            .slice(0, 5)
            .map((t) => t.word);
          if (top_themes.length > 0) {
            summary.key_insights.push(
              `Common themes: ${top_themes.join(", ")}`,
            );
          }
        }

        return {
          success: true,
          analysis_type: args.analysis_type,
          research_focus: args.research_focus,
          items_analyzed: content_to_analyze.length,
          analysis_summary: summary,
          detailed_analysis: analysis_results,
          recommendations: recommendations,
          metadata: {
            processing_time_ms: Date.now() - start_time,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof ValidationError) throw error;

        logger.error("Content analysis failed", { error: error.message });
        throw new Error(`Analysis failed: ${error.message}`);
      }
    },
  ),
};

export default contentAnalysisTool;
