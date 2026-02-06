/**
 * Monitoring and Telemetry Service
 */
import logger from "./logger.js";

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        failed: 0,
        latency: [],
      },
      tools: {},
      errors: {},
    };
    this.startTime = Date.now();
  }

  /**
   * Record tool execution
   */
  recordToolExecution(toolName, success, durationMs, error = null) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update latency stats (keep last 100 samples)
    this.metrics.requests.latency.push(durationMs);
    if (this.metrics.requests.latency.length > 100) {
      this.metrics.requests.latency.shift();
    }

    // Tool specific stats
    if (!this.metrics.tools[toolName]) {
      this.metrics.tools[toolName] = { calls: 0, errors: 0, avgDuration: 0 };
    }
    const toolStats = this.metrics.tools[toolName];
    const newTotalDuration =
      toolStats.avgDuration * toolStats.calls + durationMs;
    toolStats.calls++;
    toolStats.avgDuration = newTotalDuration / toolStats.calls;
    if (!success) {
      toolStats.errors++;
    }

    // Error tracking
    if (error) {
      const errorType = error.name || "UnknownError";
      this.metrics.errors[errorType] =
        (this.metrics.errors[errorType] || 0) + 1;
    }

    // Log metrics periodically or on error
    if (!success || this.metrics.requests.total % 100 === 0) {
      logger.info("Metrics Update", this.getSummary());
    }
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const uptime = Date.now() - this.startTime;
    const avgLatency =
      this.metrics.requests.latency.reduce((a, b) => a + b, 0) /
      (this.metrics.requests.latency.length || 1);

    return {
      uptimeSeconds: uptime / 1000,
      totalRequests: this.metrics.requests.total,
      successRate:
        (this.metrics.requests.success / (this.metrics.requests.total || 1)) *
        100,
      averageLatencyMs: Math.round(avgLatency),
      activeTools: Object.keys(this.metrics.tools).length,
    };
  }
}

export const monitoring = new MonitoringService();
