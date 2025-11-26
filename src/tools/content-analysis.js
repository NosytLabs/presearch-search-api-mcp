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

// Claude AI-optimized schema for content analysis
const ClaudeContentAnalysisSchema = {
  name: "analyze_content",
  description:
    "Analyze search results or scraped content for quality, relevance, patterns, and research insights. Provides AI-optimized analysis for Claude AI and other LLM clients.",
  inputSchema: {
    type: "object",
    properties: {
      // Input Content
      content: {
        type: "array",
        description:
          "Content to analyze - search results, scraped content, or text data",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            description: { type: "string" },
            content: { type: "string" },
            source: { type: "string" },
            publishedDate: { type: "string" },
            domain: { type: "string" },
            qualityScore: { type: "number" },
          },
          required: ["title", "url"],
        },
      },

      // Analysis Configuration
      analysis_type: {
        type: "string",
        description: "Type of analysis to perform",
        enum: ["quality", "relevance", "patterns", "research", "comprehensive"],
        default: "comprehensive",
      },

      research_focus: {
        type: "string",
        description: "Research focus area for targeted analysis",
        enum: [
          "general",
          "academic",
          "market",
          "technical",
          "competitive",
          "news",
        ],
        default: "general",
      },

      // Analysis Options
      include_quality_assessment: {
        type: "boolean",
        description: "Include detailed quality assessment of content",
        default: true,
      },

      include_relevance_scoring: {
        type: "boolean",
        description: "Score content relevance to research focus",
        default: true,
      },

      include_pattern_analysis: {
        type: "boolean",
        description: "Analyze patterns in content (topics, themes, sources)",
        default: true,
      },

      include_source_analysis: {
        type: "boolean",
        description: "Analyze source diversity and credibility",
        default: true,
      },

      include_temporal_analysis: {
        type: "boolean",
        description: "Analyze temporal patterns and recency",
        default: true,
      },

      // Filtering Options
      country: {
        type: "string",
        description:
          "Country context for analysis (ISO 3166-1 alpha-2 code). Affects quality scoring and relevance.",
        pattern: "^[A-Z]{2}$",
      },

      min_quality_score: {
        type: "number",
        description: "Minimum quality score (0-100) for analysis inclusion",
        minimum: 0,
        maximum: 100,
        default: 0,
      },

      max_items: {
        type: "number",
        description: "Maximum number of items to analyze (1-200)",
        minimum: 1,
        maximum: 200,
        default: 50,
      },

      // Custom Analysis
      custom_keywords: {
        type: "array",
        description: "Custom keywords for relevance scoring",
        items: { type: "string" },
        default: [],
      },

      exclude_domains: {
        type: "array",
        description: "Domains to exclude from analysis",
        items: { type: "string" },
        default: [],
      },
    },
    required: ["content"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      analysis_type: { type: "string" },
      research_focus: { type: "string" },
      items_analyzed: { type: "number" },
      analysis_summary: { type: "object" },
      detailed_analysis: { type: "object" },
      recommendations: { type: "array" },
      metadata: { type: "object" },
    },
    required: [
      "success",
      "analysis_type",
      "items_analyzed",
      "analysis_summary",
    ],
  },
};

// Enhanced schema with AI/LLM optimization
const contentAnalysisSchema = z.object({
  content: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        description: z.string().optional(),
        content: z.string().optional(),
        source: z.string().optional(),
        publishedDate: z.string().optional(),
        domain: z.string().optional(),
        qualityScore: z.number().optional(),
      }),
    )
    .min(1, "Content array cannot be empty"),

  analysis_type: z
    .enum(["quality", "relevance", "patterns", "research", "comprehensive"])
    .default("comprehensive")
    .describe("Type of analysis to perform"),

  research_focus: z
    .enum(["general", "academic", "market", "technical", "competitive", "news"])
    .default("general")
    .describe("Research focus area for targeted analysis"),

  include_quality_assessment: z
    .boolean()
    .default(true)
    .describe("Include detailed quality assessment of content"),

  include_relevance_scoring: z
    .boolean()
    .default(true)
    .describe("Score content relevance to research focus"),

  include_pattern_analysis: z
    .boolean()
    .default(true)
    .describe("Analyze patterns in content (topics, themes, sources)"),

  include_source_analysis: z
    .boolean()
    .default(true)
    .describe("Analyze source diversity and credibility"),

  include_temporal_analysis: z
    .boolean()
    .default(true)
    .describe("Analyze temporal patterns and recency"),

  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe("Country context for analysis"),

  min_quality_score: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .describe("Minimum quality score (0-100) for analysis inclusion"),

  max_items: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of items to analyze (1-200)"),

  custom_keywords: z
    .array(z.string())
    .optional()
    .describe("Custom keywords for relevance scoring"),

  exclude_domains: z
    .array(z.string())
    .optional()
    .describe("Domains to exclude from analysis"),
});

/**
 * Content Analysis Tool - Independent Analysis Functionality
 *
 * Provides comprehensive analysis of search results and content
 * for AI/LLM consumption. Works independently of search and export tools.
 */
export const contentAnalysisTool = {
  name: ClaudeContentAnalysisSchema.name,
  description: ClaudeContentAnalysisSchema.description,
  inputSchema: ClaudeContentAnalysisSchema.inputSchema,
  execute: withErrorHandling(
    "contentAnalysisTool",
    async (rawArgs, context) => {
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
