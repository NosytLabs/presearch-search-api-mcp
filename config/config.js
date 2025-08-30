#!/usr/bin/env node

/**
 * Configuration module for Brave Search MCP Server
 * Handles environment variables and API configuration
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

// Default configuration values
const DEFAULT_BASE_URL = 'https://api.search.brave.com';

/**
 * Logging configuration class
 */
export class LoggingConfig {
    /**
     * Creates a new logging configuration instance
     */
    constructor() {
        this.level = process.env.LOG_LEVEL || 'info';
        this.enableConsole = process.env.LOG_ENABLE_CONSOLE !== 'false';
        this.enableFile = process.env.LOG_ENABLE_FILE !== 'false';
        this.logDirectory = process.env.LOG_DIRECTORY || './logs';
        this.maxFileSize = parseInt(process.env.LOG_MAX_FILE_SIZE) || 10485760; // 10MB
        this.maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;
        this.enablePerformanceLogging = process.env.LOG_ENABLE_PERFORMANCE === 'true';
        this.enableRequestLogging = process.env.LOG_ENABLE_REQUEST === 'true';
    }

    /**
     * Validates logging configuration
     * @returns {boolean} True if configuration is valid
     */
    validate() {
        const validLevels = ['error', 'warn', 'info', 'http', 'debug'];
        if (!validLevels.includes(this.level)) {
            throw new Error(`Invalid LOG_LEVEL: ${this.level}. Must be one of: ${validLevels.join(', ')}`);
        }
        return true;
    }
}

/**
 * Error handling configuration class
 */
export class ErrorHandlingConfig {
    /**
     * Creates a new error handling configuration instance
     */
    constructor() {
        this.enableDetailedErrors = process.env.ERROR_ENABLE_DETAILED === 'true';
        this.maxRetries = parseInt(process.env.ERROR_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.ERROR_RETRY_DELAY) || 1000;
        this.circuitBreakerEnabled = process.env.ERROR_CIRCUIT_BREAKER_ENABLED !== 'false';
        this.circuitBreakerThreshold = parseInt(process.env.ERROR_CIRCUIT_BREAKER_THRESHOLD) || 5;
        this.circuitBreakerResetTimeout = parseInt(process.env.ERROR_CIRCUIT_BREAKER_RESET_TIMEOUT) || 30000;
    }
}

/**
 * Performance monitoring configuration class
 */
export class PerformanceConfig {
    /**
     * Creates a new performance configuration instance
     */
    constructor() {
        this.enableMetrics = process.env.PERF_ENABLE_METRICS !== 'false';
        this.slowQueryThreshold = parseInt(process.env.PERF_SLOW_QUERY_THRESHOLD) || 5000; // 5 seconds
        this.enableMemoryMonitoring = process.env.PERF_ENABLE_MEMORY_MONITORING === 'true';
        this.metricsInterval = parseInt(process.env.PERF_METRICS_INTERVAL) || 60000; // 1 minute
    }
}

/**
 * Configuration class for Brave Search API settings
 */
export class BraveConfig {
    /**
      * Creates a new configuration instance
      */
    constructor() {
        this.apiKey = process.env.BRAVE_API_KEY;
        this.baseURL = process.env.BRAVE_BASE_URL || DEFAULT_BASE_URL;
        this.timeout = parseInt(process.env.BRAVE_TIMEOUT) || 30000;
        this.maxRetries = parseInt(process.env.BRAVE_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.BRAVE_RETRY_DELAY) || 1000;
        this.userAgent = process.env.BRAVE_USER_AGENT || 'BraveSearchMCP/1.0.0';

        // Initialize sub-configurations
        this.logging = new LoggingConfig();
        this.errorHandling = new ErrorHandlingConfig();
        this.performance = new PerformanceConfig();
    }

    /**
     * Checks if a valid API key is configured
     * @returns {boolean} True if API key exists and is not empty
     */
    hasValidApiKey() {
        return Boolean(this.apiKey?.trim());
    }

    /**
     * Gets the API key
     * @returns {string|null} The API key or null if not set
     */
    getApiKey() {
        return this.apiKey;
    }

    /**
     * Gets the base URL for API requests
     * @returns {string} The base URL
     */
    getBaseURL() {
        return this.baseURL;
    }

    /**
     * Validates the configuration
     * @throws {Error} If API key is missing or invalid
     * @returns {boolean} True if configuration is valid
     */
    validateConfiguration() {
        if (!this.hasValidApiKey()) {
            throw new Error('BRAVE_API_KEY environment variable is required and cannot be empty');
        }

        // Validate sub-configurations
        this.logging.validate();

        return true;
    }

    /**
     * Gets all configuration as a plain object
     * @returns {object} Configuration object
     */
    toObject() {
        return {
            apiKey: this.apiKey ? '[REDACTED]' : null,
            baseURL: this.baseURL,
            timeout: this.timeout,
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay,
            userAgent: this.userAgent,
            logging: {
                level: this.logging.level,
                enableConsole: this.logging.enableConsole,
                enableFile: this.logging.enableFile,
                logDirectory: this.logging.logDirectory,
                maxFileSize: this.logging.maxFileSize,
                maxFiles: this.logging.maxFiles,
                enablePerformanceLogging: this.logging.enablePerformanceLogging,
                enableRequestLogging: this.logging.enableRequestLogging
            },
            errorHandling: {
                enableDetailedErrors: this.errorHandling.enableDetailedErrors,
                maxRetries: this.errorHandling.maxRetries,
                retryDelay: this.errorHandling.retryDelay,
                circuitBreakerEnabled: this.errorHandling.circuitBreakerEnabled,
                circuitBreakerThreshold: this.errorHandling.circuitBreakerThreshold,
                circuitBreakerResetTimeout: this.errorHandling.circuitBreakerResetTimeout
            },
            performance: {
                enableMetrics: this.performance.enableMetrics,
                slowQueryThreshold: this.performance.slowQueryThreshold,
                enableMemoryMonitoring: this.performance.enableMemoryMonitoring,
                metricsInterval: this.performance.metricsInterval
            }
        };
    }
}

/**
 * Creates a configuration instance from environment variables
 * @returns {BraveConfig} New configuration instance
 */
export function createConfigFromEnv() {
    return new BraveConfig();
}