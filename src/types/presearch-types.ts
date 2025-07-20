import { z } from "zod";

/**
 * @fileoverview Type definitions and validation schemas for Presearch MCP Server
 *
 * This file contains all TypeScript types, interfaces, and Zod validation schemas
 * used throughout the Presearch MCP Server application. It provides type safety
 * and runtime validation for API requests and responses.
 *
 * @version 2.0.0
 * @since 1.0.0
 */

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

/**
 * Interface for Presearch search request parameters.
 * This defines the structure of inputs for the presearch_search tool.
 *
 * @property {string} query - The search query string (required).
 * @property {number} [page] - Page number for pagination (optional, default: 1).
 * @property {number} [count] - Number of results per page (optional).
 * @property {string} [lang] - Language code (optional, e.g., 'en').
 * @property {'any' | 'day' | 'week' | 'month' | 'year'} [time] - Time filter (optional).
 * @property {string} [location] - Stringified JSON object with lat and long (optional).
 * @property {string} [ip] - IP address for geo-targeting (optional).
 * @property {'0' | '1'} [safe] - Safe search mode (optional, '1' for on, '0' for off).
 */
export interface PresearchSearchRequest {
  q: string;
  page?: number;
  resultsPerPage?: number;
  lang?: string;
  time?: "any" | "day" | "week" | "month" | "year";
  location?: string;
  ip?: string;
  safe?: "0" | "1";
}

/**
 * Official Presearch API search parameters schema
 * Based on https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @example
 * ```typescript
 * const params = SearchParamsSchema.parse({
 *   q: "artificial intelligence",
 *   ip: "8.8.8.8",
 *   lang: "en-US",
 *   time: "week"
 * });
 * ```
 */
export const SearchParamsSchema = z.object({
  q: z.string().min(1, "Query cannot be empty").describe("The search query"),
  ip: z.string().optional().describe("The IP address of the user"),
  lang: z
    .string()
    .optional()
    .describe("The language for search results (BCP 47 language code format)"),
  time: z
    .enum(["any", "day", "week", "month", "year"])
    .optional()
    .describe("The desired timeframe for the search results"),
  location: z
    .string()
    .optional()
    .describe(
      "The location where search results should be localized or filtered (JSON object with lat and long keys)",
    ),
  page: z
    .string()
    .optional()
    .describe("The page number for paginating search results"),
  safe: z
    .enum(["0", "1"])
    .optional()
    .describe("The safe search mode (1: enabled, 0: disabled)"),
});

/**
 * Validation schema for cache clearing parameters
 *
 * Validates parameters for cache management operations including
 * confirmation flags and pattern-based clearing.
 *
 * @example
 * ```typescript
 * const params = CacheClearParamsSchema.parse({
 *   confirm: true,
 *   pattern: "search:*"
 * });
 * ```
 */
export const CacheClearParamsSchema = z.object({
  confirm: z.boolean().default(false),
  pattern: z.string().optional(),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Basic search parameters type derived from validation schema */
export type SearchParams = z.infer<typeof SearchParamsSchema>;

/** Cache clearing parameters type derived from validation schema */
export type CacheClearParams = z.infer<typeof CacheClearParamsSchema>;

// ============================================================================
// SEARCH RESULT INTERFACES
// ============================================================================

/**
 * Individual search result from Presearch API
 *
 * Represents a single search result with all possible fields that may be
 * returned by the Presearch API. Fields are optional to accommodate
 * different response formats.
 *
 * @interface SearchResult
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   title: "Example Article",
 *   link: "https://example.com/article",
 *   description: "This is an example article about...",
 *   rank: 1,
 *   publishedDate: "2024-01-15",
 *   score: 0.95
 * };
 * ```
 */
export interface SearchResult {
  title: string;
  link?: string;
  url?: string;
  description: string;
  displayLink?: string;
  snippet?: string;
  rank?: number;
  publishedDate?: string;
  date?: string;
  author?: string;
  imageUrl?: string;
  image?: string;
  score?: number;
  relevance?: number;
  source?: string;
  language?: string;
  lastCrawled?: string;
}

/**
 * Normalized search result with standardized structure
 *
 * Provides a consistent structure for search results across different
 * API responses, with additional metadata for enhanced functionality.
 *
 * @interface NormalizedSearchResult
 * @example
 * ```typescript
 * const normalized: NormalizedSearchResult = {
 *   title: "Research Paper",
 *   url: "https://journal.com/paper",
 *   description: "Academic paper on AI",
 *   rank: 1,
 *   domain: "journal.com",
 *   metadata: {
 *     source: "presearch",
 *     contentType: "academic",
 *     language: "en",
 *     wordCount: 5000,
 *     hasImage: true,
 *     isSecure: true
 *   }
 * };
 * ```
 */
export interface NormalizedSearchResult {
  title: string;
  url: string;
  link: string;
  description: string;
  rank: number;
  domain: string;
  publishedDate?: string;
  author?: string;
  imageUrl?: string;
  score?: number;
  metadata: {
    source: string;
    contentType: string;
    language: string;
    wordCount: number;
    hasImage: boolean;
    isSecure: boolean;
    lastCrawled?: string;
  };
}

// Enhanced AI-friendly response types
export interface AISearchResponse {
  query: string;
  summary: string;
  results: StandardizedSearchResult[];
  insights: SearchInsights;
  metadata: {
    totalResults: number;
    searchTime: number;
    currentPage: number;
    resultsPerPage: number;
    timestamp: string;
    searchEngine: string;
    qualityScore: number;
  };
  pagination: {
    hasNext: boolean;
    hasPrevious: boolean;
    currentPage: number;
    totalPages: number;
  };
}

export interface StandardizedSearchResult {
  title: string;
  url: string;
  link: string; // Added for compatibility with SearchResult
  snippet: string;
  description: string; // Added for compatibility with SearchResult
  source: string;
  rank: number;
  relevanceScore: number;
  publishedDate?: string;
  author: string | null;
  imageUrl: string | null;
  contentType: string;
  metadata: {
    domain: string;
    isSecure: boolean;
    wordCount: number;
    hasImage: boolean;
    language: string;
    lastCrawled: string | null;
  };
  aiTags: string[];
}

export interface SearchInsights {
  topDomains: string[];
  contentTypeDistribution: Record<string, number>;
  extractedKeywords: string[];
  timeframeAnalysis: TimeframeAnalysis;
  averageRelevance: number;
  resultDiversity: number;
}

export interface TimeframeAnalysis {
  hasDateInfo: boolean;
  newest?: string;
  oldest?: string;
  dateRange?: string;
  datedResultsCount?: number;
}

/**
 * Information section from search results (Official Presearch API Structure)
 *
 * Contains additional contextual information that may accompany
 * search results, such as definitions, quick facts, or summaries.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface InfoSection
 * @example
 * ```typescript
 * const info: InfoSection = {
 *   title: "Artificial Intelligence",
 *   subtitle: "Technology Overview",
 *   description: "AI refers to computer systems...",
 *   image: "https://example.com/ai-image.jpg",
 *   about: ["Machine Learning", "Neural Networks"]
 * };
 * ```
 */
export interface InfoSection {
  /** Title of the information section */
  title?: string;
  /** Subtitle of the information section */
  subtitle?: string;
  /** Description or main content */
  description?: string;
  /** Image URL associated with the info */
  image?: string;
  /** Array of related topics or keywords */
  about?: string[];
}

/**
 * Top Stories item from special sections (Official Presearch API Structure)
 *
 * Represents a news article or story in the topStories array.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface TopStory
 * @example
 * ```typescript
 * const story: TopStory = {
 *   title: "Breaking News: AI Breakthrough",
 *   link: "https://news.example.com/ai-breakthrough",
 *   image: "https://news.example.com/image.jpg",
 *   source: "Tech News Daily"
 * };
 * ```
 */
export interface TopStory {
  /** Title of the news story */
  title: string;
  /** URL link to the full story */
  link: string;
  /** Image URL for the story */
  image?: string;
  /** Source publication name */
  source?: string;
}

/**
 * Video item from special sections (Official Presearch API Structure)
 *
 * Represents a video result in the videos array.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface VideoResult
 * @example
 * ```typescript
 * const video: VideoResult = {
 *   title: "How AI Works - Explained",
 *   link: "https://video.example.com/ai-explained",
 *   source: "Educational Channel"
 * };
 * ```
 */
export interface VideoResult {
  /** Title of the video */
  title: string;
  /** URL link to the video */
  link: string;
  /** Source or channel name */
  source?: string;
}

/**
 * Special sections from search results (Official Presearch API Structure)
 *
 * Contains specialized content like news stories and videos.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface SpecialSections
 * @example
 * ```typescript
 * const sections: SpecialSections = {
 *   topStories: [
 *     {
 *       title: "AI News",
 *       link: "https://news.com/ai",
 *       image: "https://news.com/image.jpg",
 *       source: "Tech News"
 *     }
 *   ],
 *   videos: [
 *     {
 *       title: "AI Tutorial",
 *       link: "https://video.com/tutorial",
 *       source: "Education Channel"
 *     }
 *   ]
 * };
 * ```
 */
export interface SpecialSections {
  /** Array of top news stories */
  topStories?: TopStory[];
  /** Array of video results */
  videos?: VideoResult[];
}

/**
 * Pagination links from API response (Official Presearch API Structure)
 *
 * Contains navigation links for paginated results.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface PaginationLinks
 * @example
 * ```typescript
 * const links: PaginationLinks = {
 *   first: "https://api.presearch.io/v1/search?q=test&page=1",
 *   last: "https://api.presearch.io/v1/search?q=test&page=10",
 *   prev: "https://api.presearch.io/v1/search?q=test&page=1",
 *   next: "https://api.presearch.io/v1/search?q=test&page=3"
 * };
 * ```
 */
export interface PaginationLinks {
  /** Link to first page */
  first?: string;
  /** Link to last page */
  last?: string;
  /** Link to previous page */
  prev?: string;
  /** Link to next page */
  next?: string;
}

/**
 * Pagination metadata from API response (Official Presearch API Structure)
 *
 * Contains pagination information and statistics.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface PaginationMeta
 * @example
 * ```typescript
 * const meta: PaginationMeta = {
 *   current_page: 2,
 *   from: 11,
 *   last_page: 10,
 *   path: "https://api.presearch.io/v1/search",
 *   pages: 10
 * };
 * ```
 */
export interface PaginationMeta {
  /** Current page number */
  current_page?: number;
  /** Starting result number on current page */
  from?: number;
  /** Last available page number */
  last_page?: number;
  /** Base API path */
  path?: string;
  /** Total number of pages */
  pages?: number;
}

/**
 * Complete response structure from Presearch API (Official API Structure)
 *
 * Represents the full response returned by the Presearch search API,
 * including search results, metadata, and pagination information.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface PresearchResponse
 * @example
 * ```typescript
 * const response: PresearchResponse = {
 *   data: {
 *     standardResults: [
 *       {
 *         title: "Example Result",
 *         link: "https://example.com",
 *         description: "This is an example search result"
 *       }
 *     ],
 *     infoSection: {
 *       title: "Quick Info",
 *       description: "Additional information about the search"
 *     },
 *     specialSections: {
 *       topStories: [
 *         {
 *           title: "Breaking News",
 *           link: "https://news.com/story",
 *           source: "News Source"
 *         }
 *       ]
 *     }
 *   },
 *   links: {
 *     first: "https://api.presearch.io/v1/search?q=test&page=1",
 *     next: "https://api.presearch.io/v1/search?q=test&page=3"
 *   },
 *   meta: {
 *     current_page: 2,
 *     from: 11,
 *     last_page: 10,
 *     pages: 10
 *   }
 * };
 * ```
 */
export interface PresearchResponse {
  /** Main data container */
  data?: {
    /** Array of standard search results */
    standardResults?: SearchResult[];
    /** Additional information section */
    infoSection?: InfoSection;
    /** Special content sections */
    specialSections?: SpecialSections;
  };
  /** Pagination navigation links */
  links?: PaginationLinks;
  /** Pagination metadata */
  meta?: PaginationMeta;
  /** Search query that was executed (legacy field) */
  query?: string;
  /** Time taken to execute the search (legacy field) */
  searchTime?: number;
  /** Legacy results field for backward compatibility */
  results?: SearchResult[];
  /** Legacy total results field */
  totalResults?: number;
  /** Legacy current page field */
  currentPage?: number;
  /** Legacy results per page field */
  resultsPerPage?: number;
}

/**
 * Raw API response from Presearch (Official API Structure)
 *
 * This represents the direct response structure from the Presearch API
 * before any processing or normalization is applied.
 * Based on official API documentation: https://presearch-search-api.readme.io/reference/get_v1-search
 *
 * @interface PresearchAPIResponse
 * @example
 * ```typescript
 * const apiResponse: PresearchAPIResponse = {
 *   data: {
 *     standardResults: [
 *       {
 *         title: "Example",
 *         link: "https://example.com",
 *         description: "Example description"
 *       }
 *     ],
 *     infoSection: {
 *       title: "Info Title",
 *       subtitle: "Info Subtitle",
 *       description: "Info description",
 *       image: "https://example.com/image.jpg",
 *       about: ["topic1", "topic2"]
 *     },
 *     specialSections: {
 *       topStories: [
 *         {
 *           title: "News Title",
 *           link: "https://news.com/story",
 *           image: "https://news.com/image.jpg",
 *           source: "News Source"
 *         }
 *       ],
 *       videos: [
 *         {
 *           title: "Video Title",
 *           link: "https://video.com/watch",
 *           source: "Video Source"
 *         }
 *       ]
 *     }
 *   },
 *   links: {
 *     first: "https://api.presearch.io/v1/search?q=test&page=1",
 *     last: "https://api.presearch.io/v1/search?q=test&page=10",
 *     prev: "https://api.presearch.io/v1/search?q=test&page=1",
 *     next: "https://api.presearch.io/v1/search?q=test&page=3"
 *   },
 *   meta: {
 *     current_page: 2,
 *     from: 11,
 *     last_page: 10,
 *     path: "https://api.presearch.io/v1/search",
 *     pages: 10
 *   }
 * };
 * ```
 */
export interface PresearchAPIResponse {
  /** Main data container with search results */
  data?: {
    /** Array of standard search results */
    standardResults?: SearchResult[];
    /** Additional information section */
    infoSection?: InfoSection;
    /** Special content sections (news, videos, etc.) */
    specialSections?: SpecialSections;
  };
  /** Pagination navigation links */
  links?: PaginationLinks;
  /** Pagination metadata and statistics */
  meta?: PaginationMeta;
  // Legacy fields for backward compatibility
  results?: SearchResult[];
  standardResults?: SearchResult[];
  infoSection?: InfoSection;
  specialSections?: SpecialSections;
  query?: string;
  totalResults?: number;
  page?: number;
  limit?: number;
  searchTime?: number;
  apiVersion?: string;
  analytics?: Record<string, unknown>;
  searchVolume?: number;
  trendData?: Record<string, unknown>[];
  relatedQueries?: string[];
  suggestions?: string[];
  error?: {
    message?: string;
    code?: string;
  };
}

// Multi-search response
export interface MultiSearchResponse {
  results: Record<string, PresearchResponse>;
  totalQueries: number;
  timestamp: string;
}

// Rate limiting interface
export interface RateLimiter {
  requests: number;
  windowStart: number;
  windowSize: number;
  maxRequests: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// MCP Tool response interface
export interface MCPToolResponse {
  content?: Array<{
    type: "text";
    text: string;
  }>;
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  totalResults?: number;
  hasMore?: boolean;
  suggestions?: string[];
  summary?: string;
}

// Cache statistics
export interface CacheStats {
  cacheSize: number;
  hitRate: number;
  hits?: number;
  misses?: number;
  oldestEntry?: string;
  newestEntry?: string;
}

// Tool registration interface
export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Request context for logging
export interface RequestContext {
  requestId?: string;
  query?: string;
  page?: number;
  timestamp?: string;
  userAgent?: string;
  ip?: string;
}
