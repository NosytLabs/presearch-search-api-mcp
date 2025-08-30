#!/usr/bin/env node

/**
 * Enhanced Presearch MCP Server
 * Official Model Context Protocol server for Presearch Search API
 * Includes comprehensive logging, error handling, and performance monitoring
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import { createConfigFromEnv } from '../../config/config.js';
import { logger, performanceLogger, requestLogger, ErrorHandler } from '../logger.js';

// Constants for configuration and defaults
const DEFAULT_IP_ADDRESS = '8.8.8.8';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_SCRAPE_TEXT_LENGTH = 2000;
const MAX_SCRAPE_LINKS = 20;
const MAX_SCRAPE_IMAGES = 10;

// URL validation utility
function isValidUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
        return false;
    }
}

// Helper function for common API call patterns with error handling
async function makePresearchApiCall(params, operationId, context) {
    try {
        const response = await presearchApi.get('/v1/search', { params });
        return response;
    } catch (error) {
        const errorInfo = ErrorHandler.handleError(error, context, { params });
        performanceLogger.end(operationId, { status: 'error' });
        throw error;
    }
}

// Simple in-memory cache with TTL
const cache = new Map();

// Circuit breaker state
let circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
let circuitBreakerFailureCount = 0;
let circuitBreakerLastFailureTime = null;

// Cache management functions
function getCacheKey(params) {
    return JSON.stringify(params);
}

function getCachedResult(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        cache.delete(key); // Remove expired entry
    }
    return null;
}

function setCachedResult(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp < CACHE_TTL) {
            validEntries++;
        } else {
            expiredEntries++;
            cache.delete(key);
        }
    }

    return {
        totalEntries: cache.size,
        validEntries,
        expiredEntries,
        hitRate: 'N/A (no hit tracking yet)'
    };
}

function clearCache() {
    const size = cache.size;
    cache.clear();
    return { clearedEntries: size };
}

// Circuit breaker functions
function isCircuitBreakerOpen(config) {
    if (circuitBreakerState === 'OPEN') {
        const timeSinceLastFailure = Date.now() - circuitBreakerLastFailureTime;
        if (timeSinceLastFailure > config.errorHandling.circuitBreakerResetTimeout) {
            circuitBreakerState = 'HALF_OPEN';
            logger.info('Circuit breaker: Moving to HALF_OPEN state', {
                timeSinceLastFailure: `${timeSinceLastFailure}ms`
            });
            return false;
        }
        return true;
    }
    return false;
}

function recordCircuitBreakerSuccess() {
    if (circuitBreakerState === 'HALF_OPEN') {
        circuitBreakerState = 'CLOSED';
        circuitBreakerFailureCount = 0;
        logger.info('Circuit breaker: Reset to CLOSED state after successful request');
    }
}

function recordCircuitBreakerFailure(config) {
    circuitBreakerFailureCount++;
    circuitBreakerLastFailureTime = Date.now();

    if (circuitBreakerFailureCount >= config.errorHandling.circuitBreakerThreshold) {
        circuitBreakerState = 'OPEN';
        logger.warn('Circuit breaker: Opened due to consecutive failures', {
            failureCount: circuitBreakerFailureCount,
            threshold: config.errorHandling.circuitBreakerThreshold
        });
    }
}

// Load configuration
const config = createConfigFromEnv();

// Validate configuration
try {
    config.validateConfiguration();
    logger.info('Configuration loaded successfully', {
        config: config.toObject()
    });
} catch (error) {
    const errorInfo = ErrorHandler.handleError(error, 'Configuration Loading');
    logger.error('Configuration validation failed', errorInfo);
    process.exit(1);
}

// Create axios instance for Presearch API with enhanced configuration
const presearchApi = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json',
        'User-Agent': config.userAgent
    }
});

// Add axios interceptors for request/response logging
presearchApi.interceptors.request.use(
    (requestConfig) => {
        if (config.logging.enableRequestLogging) {
            requestLogger.logRequest('Presearch API Request', {
                url: requestConfig.url,
                method: requestConfig.method,
                params: requestConfig.params
            });
        }
        return requestConfig;
    },
    (error) => {
        if (config.logging.enableRequestLogging) {
            requestLogger.logError('Presearch API Request Setup', error);
        }
        return Promise.reject(error);
    }
);

presearchApi.interceptors.response.use(
    (response) => {
        if (config.logging.enableRequestLogging) {
            requestLogger.logResponse('Presearch API Response', response, 0, {
                status: response.status,
                url: response.config.url
            });
        }
        recordCircuitBreakerSuccess();
        return response;
    },
    (error) => {
        recordCircuitBreakerFailure(config);

        if (config.logging.enableRequestLogging) {
            const duration = error.config?.metadata?.startTime ?
                Date.now() - error.config.metadata.startTime : 0;
            requestLogger.logError('Presearch API Response', error, duration);
        }

        return Promise.reject(error);
    }
);

// Create MCP server
const server = new McpServer({
    name: "presearch-mcp-server",
    version: "1.0.0"
});

// Enhanced search tool with comprehensive error handling and logging
server.tool(
    "presearch_search",
    {
        query: z.string().describe("Search query"),
        page: z.string().optional().describe("Page number (1-based)"),
        lang: z.string().optional().describe("Language code (e.g., en-US)"),
        time: z.string().optional().describe("Time filter (week, month, year)"),
        safe: z.string().optional().describe("Safe search (0=off, 1=on)"),
        ip: z.string().optional().describe("Client IP address"),
        useCache: z.boolean().optional().describe("Whether to use cached results")
    },
    async ({ query, page = "1", lang, time, safe, ip = DEFAULT_IP_ADDRESS, useCache = true }) => {
        const operationId = performanceLogger.start('presearch_search', { query, page });

        try {
            // Check circuit breaker
            if (isCircuitBreakerOpen(config)) {
                throw ErrorHandler.createError(
                    ErrorHandler.ERROR_CODES.API_REQUEST_FAILED,
                    'Circuit breaker is OPEN - service temporarily unavailable',
                    null,
                    { query, circuitBreakerState }
                );
            }

            const params = { q: query, page, ip };
            if (lang) params.lang = lang;
            if (time) params.time = time;
            if (safe) params.safe = safe;

            const cacheKey = getCacheKey(params);

            // Check cache first
            if (useCache && config.performance.enableMetrics) {
                const cachedResult = getCachedResult(cacheKey);
                if (cachedResult) {
                    performanceLogger.end(operationId, { source: 'cache' });
                    logger.info('Search result served from cache', { query, cacheKey });

                    return {
                        content: [
                            {
                                type: "text",
                                text: `📋 Cached Result\n${JSON.stringify(cachedResult, null, 2)}`
                            }
                        ]
                    };
                }
            }

            // Make API request with retry logic
            let lastError;
            for (let attempt = 1; attempt <= config.errorHandling.maxRetries; attempt++) {
                try {
                    const response = await presearchApi.get('/v1/search', { params });

                    // Cache the result
                    if (useCache && config.performance.enableMetrics) {
                        setCachedResult(cacheKey, response.data);
                    }

                    const duration = performanceLogger.end(operationId, {
                        attempt,
                        status: 'success',
                        resultCount: response.data?.data?.standardResults?.length || 0
                    });

                    // Log slow queries
                    if (config.performance.enableMetrics && duration > config.performance.slowQueryThreshold) {
                        logger.warn('Slow query detected', {
                            query,
                            duration: `${duration}ms`,
                            threshold: `${config.performance.slowQueryThreshold}ms`
                        });
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(response.data, null, 2)
                            }
                        ]
                    };
                } catch (error) {
                    lastError = error;

                    if (attempt < config.errorHandling.maxRetries && ErrorHandler.isRetryableError(error)) {
                        logger.warn(`Search attempt ${attempt} failed, retrying in ${config.errorHandling.retryDelay}ms`, {
                            query,
                            attempt,
                            error: error.message
                        });
                        await new Promise(resolve => setTimeout(resolve, config.errorHandling.retryDelay));
                    } else {
                        break;
                    }
                }
            }

            // All retries exhausted
            const errorInfo = ErrorHandler.handleError(lastError, 'Presearch Search API', { query, attempts: config.errorHandling.maxRetries });
            performanceLogger.end(operationId, { status: 'error', attempts: config.errorHandling.maxRetries });

            throw new Error(`Search failed: ${errorInfo.message}`);

        } catch (error) {
            const errorInfo = ErrorHandler.handleError(error, 'Search Tool Execution', { query });
            performanceLogger.end(operationId, { status: 'error' });

            throw new Error(`Search tool error: ${errorInfo.message}`);
        }
    }
);

// Export results tool with enhanced error handling
server.tool(
    "presearch_export_results",
    {
        query: z.string().describe("Search query to export"),
        format: z.enum(["json", "csv", "markdown"]).describe("Export format"),
        maxResults: z.number().optional().describe("Maximum number of results to export")
    },
    async ({ query, format, maxResults = 10 }) => {
        const operationId = performanceLogger.start('presearch_export_results', { query, format, maxResults });

        try {
            const response = await presearchApi.get('/v1/search', {
                params: { q: query, ip: DEFAULT_IP_ADDRESS }
            });

            const data = response.data;
            let exportData = data.data?.standardResults?.slice(0, maxResults) || [];

            let exportedContent = "";

            switch (format) {
                case "json":
                    exportedContent = JSON.stringify({
                        query,
                        timestamp: new Date().toISOString(),
                        results: exportData
                    }, null, 2);
                    break;

                case "csv":
                    if (exportData.length > 0) {
                        const headers = Object.keys(exportData[0]).join(",");
                        const rows = exportData.map(row =>
                            Object.values(row).map(val =>
                                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
                            ).join(",")
                        ).join("\n");
                        exportedContent = `${headers}\n${rows}`;
                    }
                    break;

                case "markdown":
                    exportedContent = `# Search Results for "${query}"\n\n`;
                    exportedContent += `Generated: ${new Date().toISOString()}\n\n`;
                    exportData.forEach((result, index) => {
                        exportedContent += `## ${index + 1}. ${result.title}\n`;
                        exportedContent += `**Link:** ${result.link}\n`;
                        exportedContent += `**Description:** ${result.description}\n\n`;
                    });
                    break;
            }

            performanceLogger.end(operationId, {
                status: 'success',
                format,
                resultCount: exportData.length
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `📤 Exported ${exportData.length} results in ${format.toUpperCase()} format:\n\n${exportedContent}`
                    }
                ]
            };
        } catch (error) {
            const errorInfo = ErrorHandler.handleError(error, 'Export Results', { query, format });
            performanceLogger.end(operationId, { status: 'error' });

            throw new Error(`Export failed: ${errorInfo.message}`);
        }
    }
);

// Content scraping tool with enhanced error handling
server.tool(
    "presearch_scrape_content",
    {
        url: z.string().describe("URL to scrape content from"),
        extractText: z.boolean().optional().describe("Extract text content"),
        extractLinks: z.boolean().optional().describe("Extract links"),
        extractImages: z.boolean().optional().describe("Extract images"),
        includeMetadata: z.boolean().optional().describe("Include page metadata")
    },
    async ({ url, extractText = true, extractLinks = false, extractImages = false, includeMetadata = true }) => {
        const operationId = performanceLogger.start('presearch_scrape_content', { url });

        try {
            // Validate URL for security
            if (!isValidUrl(url)) {
                throw ErrorHandler.createError(
                    ErrorHandler.ERROR_CODES.VALIDATION_ERROR,
                    'Invalid URL provided for scraping',
                    null,
                    { url }
                );
            }

            // For now, we'll use a simple approach with axios
            // In a production system, you'd want a proper scraping library
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': config.userAgent
                },
                timeout: config.timeout
            });

            const html = response.data;
            const results = {};

            if (includeMetadata) {
                // Extract basic metadata
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

                results.metadata = {
                    title: titleMatch ? titleMatch[1] : 'No title found',
                    description: descriptionMatch ? descriptionMatch[1] : 'No description found',
                    url: url,
                    statusCode: response.status
                };
            }

            if (extractText) {
                // Simple text extraction (remove HTML tags)
                const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                results.textContent = textContent.substring(0, MAX_SCRAPE_TEXT_LENGTH) + (textContent.length > MAX_SCRAPE_TEXT_LENGTH ? '...' : '');
            }

            if (extractLinks) {
                // Extract links
                const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi) || [];
                results.links = linkMatches.slice(0, 20).map(match => {
                    const hrefMatch = match.match(/href=["']([^"']+)["']/);
                    const textMatch = match.match(/>([^<]*)</);
                    return {
                        url: hrefMatch ? hrefMatch[1] : '',
                        text: textMatch ? textMatch[1] : ''
                    };
                });
            }

            if (extractImages) {
                // Extract images
                const imageMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
                results.images = imageMatches.slice(0, 10).map(match => {
                    const srcMatch = match.match(/src=["']([^"']+)["']/);
                    const altMatch = match.match(/alt=["']([^"']+)["']/);
                    return {
                        src: srcMatch ? srcMatch[1] : '',
                        alt: altMatch ? altMatch[1] : ''
                    };
                });
            }

            performanceLogger.end(operationId, {
                status: 'success',
                extractedText: extractText,
                extractedLinks: extractLinks,
                extractedImages: extractImages
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `🔍 Scraped content from ${url}:\n\n${JSON.stringify(results, null, 2)}`
                    }
                ]
            };
        } catch (error) {
            const errorInfo = ErrorHandler.handleError(error, 'Content Scraping', { url });
            performanceLogger.end(operationId, { status: 'error' });

            throw new Error(`Scraping failed for ${url}: ${errorInfo.message}`);
        }
    }
);

// Cache management tools
server.tool(
    "presearch_cache_stats",
    {},
    async () => {
        const stats = getCacheStats();
        logger.info('Cache stats requested', stats);

        return {
            content: [
                {
                    type: "text",
                    text: `📊 Cache Statistics:\n${JSON.stringify(stats, null, 2)}`
                }
            ]
        };
    }
);

server.tool(
    "presearch_cache_clear",
    {},
    async () => {
        const result = clearCache();
        logger.info('Cache cleared', result);

        return {
            content: [
                {
                    type: "text",
                    text: `🗑️ Cache cleared: ${result.clearedEntries} entries removed`
                }
            ]
        };
    }
);

// Enhanced health check tool with comprehensive monitoring
server.tool(
    "presearch_health_check",
    {},
    async () => {
        const operationId = performanceLogger.start('health_check');

        try {
            const startTime = Date.now();
            const response = await presearchApi.get('/v1/search', {
                params: { q: 'test', ip: '8.8.8.8' }
            });
            const responseTime = Date.now() - startTime;

            const cacheStats = getCacheStats();

            const healthData = {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                apiKeyValid: true,
                cacheEntries: cacheStats.totalEntries,
                serverVersion: '1.0.0',
                circuitBreakerState,
                circuitBreakerFailureCount,
                timestamp: new Date().toISOString(),
                memoryUsage: config.performance.enableMemoryMonitoring ? process.memoryUsage() : null
            };

            performanceLogger.end(operationId, { status: 'healthy', responseTime });

            logger.info('Health check completed successfully', {
                responseTime: `${responseTime}ms`,
                cacheEntries: cacheStats.totalEntries
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Health Check Passed:\n${JSON.stringify(healthData, null, 2)}`
                    }
                ]
            };
        } catch (error) {
            const errorInfo = ErrorHandler.handleError(error, 'Health Check');
            performanceLogger.end(operationId, { status: 'unhealthy' });

            throw new Error(`Health Check Failed: ${errorInfo.message}`);
        }
    }
);

// Performance monitoring - log metrics periodically if enabled
if (config.performance.enableMetrics) {
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const cacheStats = getCacheStats();

        performanceLogger.logMetric('memory_usage_rss', memUsage.rss, 'bytes');
        performanceLogger.logMetric('memory_usage_heap_used', memUsage.heapUsed, 'bytes');
        performanceLogger.logMetric('memory_usage_heap_total', memUsage.heapTotal, 'bytes');
        performanceLogger.logMetric('cache_entries', cacheStats.totalEntries, 'count');
        performanceLogger.logMetric('circuit_breaker_failures', circuitBreakerFailureCount, 'count');

        logger.debug('Performance metrics logged', {
            memory: memUsage,
            cache: cacheStats,
            circuitBreaker: { state: circuitBreakerState, failures: circuitBreakerFailureCount }
        });
    }, config.performance.metricsInterval);
}

// Start the server
const transport = new StdioServerTransport();

// Log server startup
logger.info('Presearch MCP server starting', {
    version: '1.0.0',
    nodeVersion: process.version,
    platform: process.platform,
    config: config.toObject()
});

await server.connect(transport);
logger.info('Presearch MCP server running on stdio', {
    transport: 'stdio',
    pid: process.pid
});