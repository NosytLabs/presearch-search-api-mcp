/**
 * Structured Logging System for Presearch MCP Server
 * Provides comprehensive logging with different levels, structured format, and performance metrics
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(logColors);

// Create custom format for structured logging
const structuredFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        };

        if (stack) {
            logEntry.stack = stack;
        }

        return JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0);
    })
);

// Create console format for development
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.colorize({ all: true }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMessage = `${timestamp} ${level}: ${message}`;

        if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta, null, 2)}`;
        }

        if (stack) {
            logMessage += `\n${stack}`;
        }

        return logMessage;
    })
);

// Create winston logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: structuredFormat,
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || 'info'
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            format: structuredFormat,
            level: 'debug'
        }),

        // Separate file for errors
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            format: structuredFormat,
            level: 'error'
        })
    ]
});

// Performance logging utility
class PerformanceLogger {
    constructor() {
        this.timers = new Map();
    }

    start(operation, metadata = {}) {
        const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.timers.set(id, {
            operation,
            startTime: Date.now(),
            metadata
        });
        logger.debug(`Performance: Started ${operation}`, { operationId: id, ...metadata });
        return id;
    }

    end(operationId, additionalMetadata = {}) {
        const timer = this.timers.get(operationId);
        if (!timer) {
            logger.warn(`Performance: Timer not found for operation ID: ${operationId}`);
            return;
        }

        const duration = Date.now() - timer.startTime;
        const metadata = { ...timer.metadata, ...additionalMetadata };

        logger.info(`Performance: Completed ${timer.operation}`, {
            operationId,
            duration: `${duration}ms`,
            ...metadata
        });

        this.timers.delete(operationId);
        return duration;
    }

    logMetric(metricName, value, unit = 'ms', metadata = {}) {
        logger.info(`Metric: ${metricName}`, {
            value,
            unit,
            ...metadata
        });
    }
}

// Request/Response logging utility
class RequestLogger {
    logRequest(operation, params = {}, metadata = {}) {
        logger.http(`Request: ${operation}`, {
            operation,
            params: this.sanitizeParams(params),
            ...metadata
        });
    }

    logResponse(operation, response, duration, metadata = {}) {
        logger.http(`Response: ${operation}`, {
            operation,
            status: 'success',
            duration: `${duration}ms`,
            responseSize: this.getResponseSize(response),
            ...metadata
        });
    }

    logError(operation, error, duration = null, metadata = {}) {
        logger.error(`Request Error: ${operation}`, {
            operation,
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            duration: duration ? `${duration}ms` : null,
            stack: error.stack,
            ...metadata
        });
    }

    sanitizeParams(params) {
        // Remove sensitive information from params
        const sanitized = { ...params };
        const sensitiveKeys = ['apiKey', 'password', 'token', 'secret'];

        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    getResponseSize(response) {
        if (typeof response === 'string') {
            return `${response.length} chars`;
        }
        if (response && typeof response === 'object') {
            return `${JSON.stringify(response).length} chars`;
        }
        return 'unknown';
    }
}

// Error handling utility
class ErrorHandler {
    static ERROR_CODES = {
        CONFIGURATION_ERROR: 'CONFIG_001',
        API_KEY_MISSING: 'AUTH_001',
        API_REQUEST_FAILED: 'API_001',
        API_TIMEOUT: 'API_002',
        CACHE_ERROR: 'CACHE_001',
        VALIDATION_ERROR: 'VALIDATION_001',
        NETWORK_ERROR: 'NETWORK_001',
        UNKNOWN_ERROR: 'UNKNOWN_001'
    };

    static createError(code, message, originalError = null, metadata = {}) {
        const error = new Error(message);
        error.code = code;
        error.metadata = metadata;

        if (originalError) {
            error.originalError = originalError;
            error.stack = originalError.stack;
        }

        return error;
    }

    static handleError(error, context = '', metadata = {}) {
        const errorCode = error.code || this.ERROR_CODES.UNKNOWN_ERROR;
        const errorMessage = error.message || 'An unknown error occurred';

        logger.error(`Error in ${context}: ${errorMessage}`, {
            errorCode,
            context,
            stack: error.stack,
            ...metadata,
            ...error.metadata
        });

        return {
            code: errorCode,
            message: errorMessage,
            context,
            timestamp: new Date().toISOString()
        };
    }

    static isRetryableError(error) {
        const retryableCodes = [
            this.ERROR_CODES.API_TIMEOUT,
            this.ERROR_CODES.NETWORK_ERROR,
            this.ERROR_CODES.API_REQUEST_FAILED
        ];

        return retryableCodes.includes(error.code);
    }
}

// Create singleton instances
const performanceLogger = new PerformanceLogger();
const requestLogger = new RequestLogger();

// Export logger and utilities
export {
    logger,
    performanceLogger,
    requestLogger,
    ErrorHandler,
    logLevels
};

// Convenience functions for direct use
export const log = {
    error: (message, meta = {}) => logger.error(message, meta),
    warn: (message, meta = {}) => logger.warn(message, meta),
    info: (message, meta = {}) => logger.info(message, meta),
    http: (message, meta = {}) => logger.http(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta)
};