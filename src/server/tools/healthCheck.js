export const createHealthCheckTool = (dependencies) => {
    const { presearchApi, performanceLogger, getCacheStats, circuitBreakerState, circuitBreakerFailureCount, config, ErrorHandler } = dependencies;

    return {
        name: "health_check",
        schema: {},
        handler: async () => {
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
    }
};
