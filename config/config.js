/**
 * Configuration module for Presearch MCP Server
 * Handles environment variables and API configuration
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenvConfig();

const loggingConfigSchema = z.object({
    level: z.enum(['error', 'warn', 'info', 'http', 'debug']),
    enableConsole: z.boolean(),
    enableFile: z.boolean(),
    logDirectory: z.string(),
    maxFileSize: z.number().int().positive(),
    maxFiles: z.number().int().positive(),
    enablePerformanceLogging: z.boolean(),
    enableRequestLogging: z.boolean(),
});

const errorHandlingConfigSchema = z.object({
    enableDetailedErrors: z.boolean(),
    maxRetries: z.number().int().min(0),
    retryDelay: z.number().int().min(0),
    circuitBreakerEnabled: z.boolean(),
    circuitBreakerThreshold: z.number().int().positive(),
    circuitBreakerResetTimeout: z.number().int().positive(),
});

const performanceConfigSchema = z.object({
    enableMetrics: z.boolean(),
    slowQueryThreshold: z.number().int().positive(),
    enableMemoryMonitoring: z.boolean(),
    metricsInterval: z.number().int().positive(),
});

const presearchConfigSchema = z.object({
    apiKey: z.string().min(1),
    baseURL: z.string().url(),
    timeout: z.number().int().positive(),
    maxRetries: z.number().int().min(0),
    retryDelay: z.number().int().min(0),
    userAgent: z.string(),
    logging: loggingConfigSchema,
    errorHandling: errorHandlingConfigSchema,
    performance: performanceConfigSchema,
});

export class PresearchConfig {
    constructor() {
        this.apiKey = process.env.PRESEARCH_API_KEY;
        this.baseURL = process.env.PRESEARCH_BASE_URL || 'https://na-us-1.presearch.com';
        this.timeout = parseInt(process.env.PRESEARCH_TIMEOUT, 10) || 30000;
        this.maxRetries = parseInt(process.env.PRESEARCH_MAX_RETRIES, 10) || 3;
        this.retryDelay = parseInt(process.env.PRESEARCH_RETRY_DELAY, 10) || 1000;
        this.userAgent = process.env.PRESEARCH_USER_AGENT || 'PresearchMCP/1.0.0';

        this.logging = {
            level: process.env.LOG_LEVEL || 'info',
            enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
            enableFile: process.env.LOG_ENABLE_FILE !== 'false',
            logDirectory: process.env.LOG_DIRECTORY || './logs',
            maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE, 10) || 10485760,
            maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5,
            enablePerformanceLogging: process.env.LOG_ENABLE_PERFORMANCE === 'true',
            enableRequestLogging: process.env.LOG_ENABLE_REQUEST === 'true',
        };

        this.errorHandling = {
            enableDetailedErrors: process.env.ERROR_ENABLE_DETAILED === 'true',
            maxRetries: parseInt(process.env.ERROR_MAX_RETRIES, 10) || 3,
            retryDelay: parseInt(process.env.ERROR_RETRY_DELAY, 10) || 1000,
            circuitBreakerEnabled: process.env.ERROR_CIRCUIT_BREAKER_ENABLED !== 'false',
            circuitBreakerThreshold: parseInt(process.env.ERROR_CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
            circuitBreakerResetTimeout: parseInt(process.env.ERROR_CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 30000,
        };

        this.performance = {
            enableMetrics: process.env.PERF_ENABLE_METRICS !== 'false',
            slowQueryThreshold: parseInt(process.env.PERF_SLOW_QUERY_THRESHOLD, 10) || 5000,
            enableMemoryMonitoring: process.env.PERF_ENABLE_MEMORY_MONITORING === 'true',
            metricsInterval: parseInt(process.env.PERF_METRICS_INTERVAL, 10) || 60000,
        };
    }

    validateConfiguration() {
        const result = presearchConfigSchema.safeParse(this);
        if (!result.success) {
            throw new Error(`Configuration validation failed: ${result.error.message}`);
        }
        return true;
    }

    toObject() {
        const configObject = { ...this };
        configObject.apiKey = configObject.apiKey ? '[REDACTED]' : null;
        return configObject;
    }
}

export function createConfigFromEnv() {
    return new PresearchConfig();
}
