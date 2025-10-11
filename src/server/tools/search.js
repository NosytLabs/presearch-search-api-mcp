import { z } from "zod";

export const createSearchTool = (dependencies) => {
    const {
        presearchApi,
        config,
        logger,
        performanceLogger,
        ErrorHandler,
        isCircuitBreakerOpen,
        getCacheKey,
        getCachedResult,
        setCachedResult,
        circuitBreakerState,
    } = dependencies;

    return {
        name: "search",
        schema: {
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
        handler: async ({ query, ip, count = 10, offset = 0, country, search_lang, ui_lang, safesearch, freshness, useCache = true }) => {
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
    }
};
