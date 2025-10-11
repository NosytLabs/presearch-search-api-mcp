#!/usr/bin/env node

/**
 * Presearch MCP Server
 * Official Model Context Protocol server for Presearch API
 * Production-ready implementation with comprehensive error handling and monitoring
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { createConfigFromEnv } from '../../config/config.js';
import { logger, performanceLogger, requestLogger, ErrorHandler } from '../logger.js';
import { getCacheKey, getCachedResult, setCachedResult, getCacheStats, clearCache } from './cache.js';
import { getCircuitBreakerState, getCircuitBreakerFailureCount, isCircuitBreakerOpen, recordCircuitBreakerSuccess, recordCircuitBreakerFailure } from './circuitBreaker.js';
import { createSearchTool } from './tools/search.js';
import { createExportResultsTool } from './tools/exportResults.js';
import { createScrapeContentTool } from './tools/scrapeContent.js';
import { createCacheStatsTool } from './tools/cacheStats.js';
import { createCacheClearTool } from './tools/cacheClear.js';
import { createHealthCheckTool } from './tools/healthCheck.js';
import axios from 'axios';


const PORT = process.env.PORT || 8081;

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
        recordCircuitBreakerSuccess(logger);
        return response;
    },
    (error) => {
        recordCircuitBreakerFailure(config, logger);

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

    const dependencies = {
        presearchApi,
        config,
        logger,
        performanceLogger,
        ErrorHandler,
        getCacheKey,
        getCachedResult,
        setCachedResult,
        getCacheStats,
        clearCache,
        isCircuitBreakerOpen: (config) => isCircuitBreakerOpen(config, logger),
        circuitBreakerState: getCircuitBreakerState(),
        circuitBreakerFailureCount: getCircuitBreakerFailureCount(),
    };

    const tools = [
        createSearchTool(dependencies),
        createExportResultsTool(dependencies),
        createScrapeContentTool(dependencies),
        createCacheStatsTool(dependencies),
        createCacheClearTool(dependencies),
        createHealthCheckTool(dependencies),
    ];

    tools.forEach(tool => {
        server.tool(tool.name, tool.schema, tool.handler);
    });


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
        performanceLogger.logMetric('circuit_breaker_failures', getCircuitBreakerFailureCount(), 'count');

        logger.debug('Performance metrics logged', {
            memory: memUsage,
            cache: cacheStats,
            circuitBreaker: { state: getCircuitBreakerState(), failures: getCircuitBreakerFailureCount() }
        });
    }, config.performance.metricsInterval);
}

async function main() {
    const transport = process.env.TRANSPORT || 'stdio';

    if (transport === 'http') {
        const app = express();

        app.use(cors({
            origin: '*', // Configure appropriately for production
            exposedHeaders: ['Mcp-Session-Id', 'mcp-protocol-version'],
            allowedHeaders: ['Content-Type', 'mcp-session-id'],
        }));

        app.use(express.json());

        app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });

        app.all('/mcp', async (req, res) => {
            try {
                const server = createServer();
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                });

                res.on('close', () => {
                    transport.close();
                    server.close();
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

        app.listen(PORT, () => {
            logger.info(`MCP HTTP Server listening on port ${PORT}`);
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
