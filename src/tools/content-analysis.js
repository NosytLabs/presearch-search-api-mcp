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

import logger from "../core/logger.js";
import contentAnalysisService from "../services/contentAnalysisService.js";
import { ValidationError, withErrorHandling } from "../utils/errors.js";

// JSON Schema for MCP compatibility
const ContentAnalysisInputSchema = {
  type: "object",
  properties: {
    content: {
      type: "string",
      description: "The text content or JSON string to analyze.",
      minLength: 1
    },
    analysis_type: {
      type: "string",
      enum: ["summary", "keywords", "sentiment", "topics"],
      description: "Type of analysis to perform: summary, keywords, sentiment, or topics."
    },
    language: {
      type: "string",
      description: "Language code for the analysis (e.g., 'en')."
    },
    max_summary_length: {
      type: "number",
      description: "Maximum character length for the generated summary."
    }
  },
  required: ["content"]
};

/**
 * Content Analysis Tool - Independent Analysis Functionality
 *
 * Provides comprehensive analysis of search results and content
 * for AI/LLM consumption. Works independently of search and export tools.
 */
export const contentAnalysisTool = {
  name: "analyze_content",
  description: "NLP-based content analysis supporting summary, keywords, sentiment, and topics extraction.",
  inputSchema: ContentAnalysisInputSchema,
  tags: ["analysis", "nlp"],
  execute: withErrorHandling("contentAnalysisTool", async (rawArgs) => {
    const start_time = Date.now();

    try {
      // Handle simple string content from MCP
      if (typeof rawArgs.content === 'string') {
         if (rawArgs.content.trim().length === 0) {
             throw new ValidationError("Content cannot be empty");
         }

         try {
             const parsed = JSON.parse(rawArgs.content);
             if (Array.isArray(parsed)) {
                 rawArgs.content = parsed;
             } else {
                 // Treat as raw text content item
                 rawArgs.content = [{
                     title: "User Content",
                     url: "user-input",
                     content: rawArgs.content,
                     description: rawArgs.content.substring(0, 200)
                 }];
             }
         } catch {
             // Not JSON, treat as raw text
             rawArgs.content = [{
                 title: "User Content",
                 url: "user-input",
                 content: rawArgs.content,
                 description: rawArgs.content.substring(0, 200)
             }];
         }
      }

      // Map user analysis_type to internal types
      let internalAnalysisType = "comprehensive";
      if (rawArgs.analysis_type === "keywords") internalAnalysisType = "patterns";
      if (rawArgs.analysis_type === "topics") internalAnalysisType = "patterns";
      // sentiment and summary default to comprehensive which includes everything

      const args = {
        ...rawArgs,
        analysis_type: internalAnalysisType,
        content: rawArgs.content
      };

      // Validate input content
      if (!Array.isArray(args.content) || args.content.length === 0) {
        throw new ValidationError("Content must be a non-empty array");
      }

      logger.info("Starting content analysis", {
        analysis_type: args.analysis_type,
        content_count: args.content.length,
      });

      // Filter and prepare content
      let content_to_analyze = args.content; // Analyze all for now

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
          summary.key_insights.push(`Common themes: ${top_themes.join(", ")}`);
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
  }),
};

export default contentAnalysisTool;
