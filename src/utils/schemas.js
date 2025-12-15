import { z } from "zod";

/**
 * Common Schemas for Tool Inputs
 */

// Basic search parameters
export const SearchParamsSchema = z.object({
  query: z.string().describe("The search query"),
  count: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || 20)
    .optional()
    .describe("Number of results to return (default: 20, max: 100)"),
  page: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || 1)
    .optional()
    .describe("Page number (default: 1)"),
  safesearch: z
    .enum(["strict", "moderate", "off"])
    .optional()
    .describe("Safe search setting"),
});

// Deep research parameters
export const DeepResearchSchema = z.object({
  query: z.string().describe("Research topic or question"),
  breadth: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || 4)
    .optional()
    .describe("Number of parallel search paths (2-10)"),
  depth: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || 2)
    .optional()
    .describe("Depth of recursive research (1-5)"),
  research_focus: z
    .enum(["general", "academic", "market", "technical", "news"])
    .optional()
    .describe("Focus area for research"),
  location: z.string().optional().describe("Geographic context (e.g., 'US')"),
});

// Scrape parameters
export const ScrapeSchema = z.object({
  urls: z
    .array(z.string())
    .describe("List of URLs to scrape")
    .or(z.string().transform((val) => [val])),
  include_text: z
    .boolean()
    .optional()
    .describe("Include full text content (default: true)"),
  timeout_ms: z.number().optional().describe("Timeout in milliseconds"),
});

// Analysis parameters
export const AnalysisSchema = z.object({
  content: z.string().describe("Text content to analyze"),
  include_quality_assessment: z
    .boolean()
    .optional()
    .describe("Include quality metrics"),
  custom_keywords: z.array(z.string()).optional().describe("Keywords to track"),
});
