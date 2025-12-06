/**
 * Comprehensive Monitoring and Metrics System
 * Provides performance tracking, health monitoring, and operational insights
 */

import logger from "./logger.js";

/**
 * Performance metrics collector
 */
export class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byStatus: {},
        byEndpoint: {},
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
      },
      errors: {
        total: 0,
        byType: {},
        byTool: {},
        recent: [],
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
      },
      rateLimit: {
        hits: 0,
        resets: 0,
        currentUsage: 0,
      },
    };

    this.responseTimes = [];
    this.startTime = Date.now();
    this.maxRecentErrors = 100;
  }

  /**
   * Record a request with timing and status information
   * @param {Object} params - Request parameters
   * @param {string} params.method - HTTP method or tool name
   * @param {string} params.endpoint - API endpoint or tool identifier
   * @param {number} params.status - Response status code
   * @param {number} params.duration - Request duration in milliseconds
   * @param {string} params.errorType - Error type if failed
   * @param {Object} params.metadata - Additional metadata
   */
  recordRequest(params) {
    const {
      method,
      endpoint,
      status,
      duration,
      errorType,
      metadata = {},
    } = params;

    this.metrics.requests.total++;

    // Track by status
    if (!this.metrics.requests.byStatus[status]) {
      this.metrics.requests.byStatus[status] = 0;
    }
    this.metrics.requests.byStatus[status]++;

    // Track by endpoint/tool - Limit the size of byEndpoint to prevent memory leaks
    const key = `${method}:${endpoint}`;
    if (Object.keys(this.metrics.requests.byEndpoint).length > 500 && !this.metrics.requests.byEndpoint[key]) {
      // Reset endpoint stats if too many unique endpoints (simple protection)
      this.metrics.requests.byEndpoint = {};
    }

    if (!this.metrics.requests.byEndpoint[key]) {
      this.metrics.requests.byEndpoint[key] = {
        total: 0,
        successful: 0,
        failed: 0,
        averageDuration: 0,
      };
    }
    const endpointStats = this.metrics.requests.byEndpoint[key];
    endpointStats.total++;

    if (status >= 200 && status < 300) {
      this.metrics.requests.successful++;
      endpointStats.successful++;
    } else {
      this.metrics.requests.failed++;
      endpointStats.failed++;

      // Track errors
      this.metrics.errors.total++;
      if (errorType) {
        if (!this.metrics.errors.byType[errorType]) {
          this.metrics.errors.byType[errorType] = 0;
        }
        this.metrics.errors.byType[errorType]++;
      }

      if (metadata.toolName) {
        if (!this.metrics.errors.byTool[metadata.toolName]) {
          this.metrics.errors.byTool[metadata.toolName] = 0;
        }
        this.metrics.errors.byTool[metadata.toolName]++;
      }

      // Add to recent errors
      this.metrics.errors.recent.push({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        status,
        errorType,
        metadata,
      });

      // Trim recent errors
      if (this.metrics.errors.recent.length > this.maxRecentErrors) {
        this.metrics.errors.recent = this.metrics.errors.recent.slice(
          -this.maxRecentErrors,
        );
      }
    }

    // Update performance metrics
    this.responseTimes.push(duration);
    endpointStats.averageDuration =
      (endpointStats.averageDuration + duration) / 2;

    // Keep only last 1000 response times for percentile calculations
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    this.updatePerformanceMetrics();
  }

  /**
   * Update performance metrics including percentiles
   */
  updatePerformanceMetrics() {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.performance.averageResponseTime =
      sorted.reduce((a, b) => a + b, 0) / len;
    this.metrics.performance.p95ResponseTime = sorted[Math.floor(len * 0.95)];
    this.metrics.performance.p99ResponseTime = sorted[Math.floor(len * 0.99)];
    this.metrics.performance.maxResponseTime = sorted[len - 1];
    this.metrics.performance.minResponseTime = sorted[0];
  }

  /**
   * Record cache operation
   * @param {string} operation - Cache operation type
   * @param {boolean} hit - Whether it was a cache hit
   */
  recordCacheOperation(operation, hit) {
    if (operation === "get") {
      if (hit) {
        this.metrics.cache.hits++;
      } else {
        this.metrics.cache.misses++;
      }

      const total = this.metrics.cache.hits + this.metrics.cache.misses;
      this.metrics.cache.hitRate =
        total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
    } else if (operation === "evict") {
      this.metrics.cache.evictions++;
    }
  }

  /**
   * Record rate limiting event
   * @param {string} event - Rate limit event type
   */
  recordRateLimitEvent(event) {
    if (event === "hit") {
      this.metrics.rateLimit.hits++;
    } else if (event === "reset") {
      this.metrics.rateLimit.resets++;
    }
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;

    return {
      ...this.metrics,
      uptime,
      uptimeHuman: this.formatUptime(uptime),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format uptime in human-readable format
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get health status based on metrics
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];

    // Check error rate
    const errorRate =
      metrics.requests.total > 0
        ? (metrics.requests.failed / metrics.requests.total) * 100
        : 0;

    if (errorRate > 10) {
      issues.push({
        severity: "warning",
        message: `High error rate: ${errorRate.toFixed(2)}%`,
        metric: "error_rate",
        value: errorRate,
      });
    }

    if (errorRate > 25) {
      issues.push({
        severity: "critical",
        message: `Critical error rate: ${errorRate.toFixed(2)}%`,
        metric: "error_rate",
        value: errorRate,
      });
    }

    // Check response times
    if (metrics.performance.p95ResponseTime > 5000) {
      issues.push({
        severity: "warning",
        message: `High P95 response time: ${metrics.performance.p95ResponseTime}ms`,
        metric: "p95_response_time",
        value: metrics.performance.p95ResponseTime,
      });
    }

    // Check cache hit rate
    if (
      metrics.cache.hitRate < 50 &&
      metrics.cache.hits + metrics.cache.misses > 10
    ) {
      issues.push({
        severity: "info",
        message: `Low cache hit rate: ${metrics.cache.hitRate.toFixed(2)}%`,
        metric: "cache_hit_rate",
        value: metrics.cache.hitRate,
      });
    }

    // Determine overall status
    let status = "healthy";
    if (issues.some((issue) => issue.severity === "critical")) {
      status = "unhealthy";
    } else if (issues.some((issue) => issue.severity === "warning")) {
      status = "degraded";
    }

    return {
      status,
      issues,
      metrics: {
        uptime: metrics.uptime,
        totalRequests: metrics.requests.total,
        errorRate,
        p95ResponseTime: metrics.performance.p95ResponseTime,
        cacheHitRate: metrics.cache.hitRate,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byStatus: {},
        byEndpoint: {},
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
      },
      errors: {
        total: 0,
        byType: {},
        byTool: {},
        recent: [],
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
      },
      rateLimit: {
        hits: 0,
        resets: 0,
        currentUsage: 0,
      },
    };

    this.responseTimes = [];
    this.startTime = Date.now();
  }
}

/**
 * Enhanced health monitoring system
 */
export class HealthMonitor {
  constructor(metricsCollector) {
    this.metrics = metricsCollector;
    this.checks = new Map();
    this.alerts = [];
    this.alertThresholds = {
      errorRate: 10, // 10%
      responseTime: 5000, // 5 seconds
      memoryUsage: 85, // 85%
      diskUsage: 90, // 90%
    };
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Async function that returns health status
   * @param {Object} options - Check options
   */
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      interval: options.interval || 30000, // 30 seconds default
      timeout: options.timeout || 5000, // 5 seconds default
      severity: options.severity || "warning",
      lastRun: null,
      lastResult: null,
    });
  }

  /**
   * Run all health checks
   * @returns {Object} Health check results
   */
  async runHealthChecks() {
    const results = {
      status: "healthy",
      checks: {},
      timestamp: new Date().toISOString(),
    };

    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        const startTime = Date.now();

        try {
          const result = await Promise.race([
            check.fn(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Health check timeout")),
                check.timeout,
              ),
            ),
          ]);

          const duration = Date.now() - startTime;

          results.checks[name] = {
            status: result.status || "healthy",
            message: result.message || "Check completed successfully",
            duration,
            timestamp: new Date().toISOString(),
            ...result,
          };

          check.lastRun = new Date().toISOString();
          check.lastResult = results.checks[name];
        } catch (error) {
          const duration = Date.now() - startTime;

          results.checks[name] = {
            status: "unhealthy",
            message: error.message,
            duration,
            timestamp: new Date().toISOString(),
            error: error.message,
          };

          check.lastRun = new Date().toISOString();
          check.lastResult = results.checks[name];

          // Check if this should trigger an alert
          if (check.severity === "critical") {
            this.triggerAlert("critical", `Health check failed: ${name}`, {
              check: name,
              error: error.message,
            });
          }
        }
      },
    );

    await Promise.all(checkPromises);

    // Determine overall status
    const statuses = Object.values(results.checks).map((check) => check.status);
    if (statuses.some((status) => status === "unhealthy")) {
      results.status = "unhealthy";
    } else if (statuses.some((status) => status === "degraded")) {
      results.status = "degraded";
    }

    return results;
  }

  /**
   * Trigger an alert
   * @param {string} severity - Alert severity
   * @param {string} message - Alert message
   * @param {Object} data - Additional alert data
   */
  triggerAlert(severity, message, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    logger.error(`Health Alert: ${message}`, {
      alertId: alert.id,
      severity,
      data,
    });
  }

  /**
   * Get current alerts
   * @returns {Array} Current alerts
   */
  getAlerts() {
    return [...this.alerts];
  }

  /**
   * Clear alerts
   * @param {string} severity - Optional severity filter
   */
  clearAlerts(severity = null) {
    if (severity) {
      this.alerts = this.alerts.filter((alert) => alert.severity !== severity);
    } else {
      this.alerts = [];
    }
  }
}

// Create singleton instances
export const metricsCollector = new MetricsCollector();
export const healthMonitor = new HealthMonitor(metricsCollector);

/**
 * Middleware for Express to track request metrics
 * @returns {Function} Express middleware
 */
export function createMetricsMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function (data) {
      const duration = Date.now() - startTime;
      const status = res.statusCode;

      // Record the request
      metricsCollector.recordRequest({
        method: req.method,
        endpoint: req.path,
        status,
        duration,
        metadata: {
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          query: req.query,
        },
      });

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Enhanced error logging with metrics
 * @param {Error} error - Error to log
 * @param {Object} context - Error context
 */
export function logErrorWithMetrics(error, context = {}) {
  const errorType = error.name || "UnknownError";

  // Record in metrics
  metricsCollector.recordRequest({
    method: context.method || "unknown",
    endpoint: context.endpoint || "unknown",
    status: context.status || 500,
    duration: context.duration || 0,
    errorType,
    metadata: context,
  });

  // Log with full context
  logger.error(`Error: ${error.message}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    context,
    metrics: metricsCollector.getMetrics(),
  });
}

export default {
  MetricsCollector,
  HealthMonitor,
  metricsCollector,
  healthMonitor,
  createMetricsMiddleware,
  logErrorWithMetrics,
};
