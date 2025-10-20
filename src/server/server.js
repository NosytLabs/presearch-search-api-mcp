#!/usr/bin/env node

/**
 * Presearch MCP Server
 * Official Model Context Protocol server for Presearch API
 * Production-ready implementation with comprehensive error handling and monitoring
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import axios from 'axios';
import * as cheerio from 'cheerio';
import express from "express";
import cors from "cors";
import { createConfigFromEnv } from '../../config/config.js';
import { logger, performanceLogger, requestLogger, ErrorHandler } from '../logger.js';

// Constants for configuration and defaults
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_SCRAPE_TEXT_LENGTH = 2000;
const MAX_SCRAPE_LINKS = 20;
const MAX_SCRAPE_IMAGES = 10;
const PORT = process.env.PORT || 8081;

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
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept-Encoding': 'gzip'
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

function createServer() {
    const server = new McpServer({
        name: "presearch-mcp-server",
        version: "1.0.0"
    });

    // Enhanced search tool with comprehensive error handling and logging
    server.tool(
        "search",
        {
            query: z.string().describe("Search query"),
            ip: z.string().describe("IP address of the user"),
            count: z.number().optional().describe("Number of results (1-20, default 10)"),
            offset: z.number().optional().describe("Pagination offset (default 0)"),
            country: z.string().optional().describe("Country code (e.g., US, GB)"),
            search_lang: z.string().optional().describe("Search language (e.g., en, es)"),
            ui_lang: z.string().optional().describe("UI language (e.g., en-US)"),
            safesearch: z.string().optional().describe("Safe search level (off, moderate, strict)"),
            freshness: z.string().optional().describe("Time filter (pd, pw, pm, py)"),
            useCache: z.boolean().optional().describe("Whether to use cached results")
        },
        async ({ query, ip, count = 10, offset = 0, country, search_lang, ui_lang, safesearch, freshness, useCache = true }) => {
            const operationId = performanceLogger.start('search', { query, count, offset });

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

                const params = {
                    q: query,
                    count: Math.min(Math.max(count, 1), 20), // Ensure count is between 1-20
                    offset,
                    ip
                };

                if (country) params.country = country;
                if (search_lang) params.search_lang = search_lang;
                if (ui_lang) params.ui_lang = ui_lang;
                if (safesearch) params.safesearch = safesearch;
                if (freshness) params.freshness = freshness;

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
                const errorInfo = ErrorHandler.handleError(lastError, 'Presearch API', { query, attempts: config.errorHandling.maxRetries });
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
        "export_results",
        {
            query: z.string().describe("Search query to export"),
            ip: z.string().describe("IP address of the user"),
            format: z.enum(["json", "csv", "markdown"]).describe("Export format"),
            count: z.number().optional().describe("Number of results to export"),
            country: z.string().optional().describe("Country code for search")
        },
        async ({ query, ip, format, count = 10, country }) => {
            const operationId = performanceLogger.start('export_results', { query, format, count });

            try {
                const params = {
                    q: query,
                    count: Math.min(Math.max(count, 1), 20),
                    ip
                };
                if (country) params.country = country;

                const response = await presearchApi.get('/v1/search', { params });

                const data = response.data;
                let exportData = data.data?.standardResults?.slice(0, count) || [];

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
                            exportedContent += `**Link:** ${result.url}\n`;
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
        "scrape_content",
        {
            url: z.string().describe("URL to scrape content from"),
            extractText: z.boolean().optional().describe("Extract text content"),
            extractLinks: z.boolean().optional().describe("Extract links"),
            extractImages: z.boolean().optional().describe("Extract images"),
            includeMetadata: z.boolean().optional().describe("Include page metadata")
        },
        async ({ url, extractText = true, extractLinks = false, extractImages = false, includeMetadata = true }) => {
            const operationId = performanceLogger.start('scrape_content', { url });

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
                        'User-Agent': 'PresearchMCP/1.0.0'
                    },
                    timeout: config.timeout
                });

                const html = response.data;
                const $ = cheerio.load(html);
                const results = {};

                if (includeMetadata) {
                    results.metadata = {
                        title: $('title').text() || 'No title found',
                        description: $('meta[name="description"]').attr('content') || 'No description found',
                        url: url,
                        statusCode: response.status
                    };
                }

                if (extractText) {
                    $('script, style').remove();
                    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
                    results.textContent = textContent.substring(0, MAX_SCRAPE_TEXT_LENGTH) + (textContent.length > MAX_SCRAPE_TEXT_LENGTH ? '...' : '');
                }

                if (extractLinks) {
                    results.links = [];
                    $('a').slice(0, MAX_SCRAPE_LINKS).each((i, el) => {
                        results.links.push({
                            url: $(el).attr('href') || '',
                            text: $(el).text() || ''
                        });
                    });
                }

                if (extractImages) {
                    results.images = [];
                    $('img').slice(0, MAX_SCRAPE_IMAGES).each((i, el) => {
                        results.images.push({
                            src: $(el).attr('src') || '',
                            alt: $(el).attr('alt') || ''
                        });
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
        "cache_stats",
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
        "cache_clear",
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
        "health_check",
        {},
        async () => {
            const operationId = performanceLogger.start('health_check');

            try {
                const startTime = Date.now();
                const response = await presearchApi.get('/v1/search', {
                    params: { q: 'test', count: 1, ip: '127.0.0.1' }
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
    return server;
}

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

async function main() {
    const transport = process.env.TRANSPORT || 'http';
     
    logger.info('Starting Presearch MCP Server', {
        transport,
        port: process.env.PORT || PORT,
        nodeVersion: process.version,
        version: '1.0.0'
    });

    try {
        // Initialize configuration (will warn but not fail if API key is missing)
        config.validateConfiguration();
        logger.info('Configuration validated successfully');
    } catch (error) {
        logger.error('Configuration validation failed', { error: error.message });
        // Don't exit - allow server to start for deployment
    }

    if (transport === 'http') {
        const app = express();

        app.use(cors({
            origin: '*', // Configure appropriately for production
            methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
            exposedHeaders: ['mcp-session-id', 'mcp-protocol-version'],
            allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'mcp-session-id'],
            preflightContinue: false,
            optionsSuccessStatus: 204,
        }));
        // Explicitly handle preflight for all routes
        app.options('*', cors());

        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0',
                transport: 'http',
                port: PORT
            });
        });

        // Create a single server instance for all HTTP connections
        const server = createServer();
        
        app.all('/mcp', async (req, res) => {
            try {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                });

                res.on('close', () => {
                    transport.close();
                });

                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
            } catch (error) {
                logger.error('Error handling MCP request:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: { code: -32603, message: 'Internal server error' },
                        id: null,
                    });
                }
            }
        });

        const httpServer = app.listen(PORT, () => {
            logger.info(`MCP HTTP Server listening on port ${PORT}`, {
                transport: 'http',
                port: PORT,
                healthEndpoint: '/health',
                mcpEndpoint: '/mcp'
            });
            
            // Test health endpoint after startup
            setTimeout(async () => {
                try {
                    const response = await fetch(`http://localhost:${PORT}/health`);
                    if (response.ok) {
                        logger.info('Health check endpoint is responding');
                    } else {
                        logger.warn('Health check endpoint returned non-200 status', { status: response.status });
                    }
                } catch (error) {
                    logger.error('Health check endpoint test failed', { error: error.message });
                }
            }, 1000);
        });

        httpServer.on('error', (error) => {
            logger.error('HTTP Server error', {
                error: error.message,
                code: error.code,
                port: PORT
            });
            process.exit(1);
        });
    } else {
        const server = createServer();
        const transport = new StdioServerTransport();

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
    }
}

main().catch((error) => {
    logger.error("Server error:", error);
    process.exit(1);
});

// Export createServer function for Smithery TypeScript deployment compatibility
export { createServer };