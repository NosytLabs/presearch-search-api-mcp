import { apiClient } from "../core/apiClient.js";
import { withErrorHandling } from "../utils/errors.js";
import { validateApiKeyFormat, getApiKeyGuidance } from "../core/config.js";
import { loadConfig } from "../core/config.js";

const inputSchema = {
  type: "object",
  properties: {},
  description: "No parameters required",
};

const tool = {
  name: "presearch_health_check",
  description:
    "Verify API connectivity, authentication, and rate limit status.",
  inputSchema,
  tags: ["system", "health"],
  execute: withErrorHandling("presearch_health_check", async () => {
    const config = await loadConfig();
    const status = await apiClient.healthCheck(config.apiKey);

    // Enhanced health check with API key validation
    const apiKeyValidation = {
      configured: !!config.apiKey,
      formatValid: config.apiKey ? validateApiKeyFormat(config.apiKey) : false,
      guidance: config.apiKey
        ? getApiKeyGuidance(config.apiKey)
        : getApiKeyGuidance(""),
    };

    const enhancedStatus = {
      ...status,
      apiKeyValidation,
      serverInfo: {
        version: "2.1.0",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
      recommendations: [],
    };

    // Add recommendations based on health check results
    if (!apiKeyValidation.configured) {
      enhancedStatus.recommendations.push(
        "Configure PRESEARCH_API_KEY environment variable to enable search functionality",
      );
    } else if (!apiKeyValidation.formatValid) {
      enhancedStatus.recommendations.push(apiKeyValidation.guidance);
    }

    if (!status.authenticated && apiKeyValidation.configured) {
      enhancedStatus.recommendations.push(
        "Verify your API key at https://presearch.com/",
      );
    }

    if (status.latencyMs > 5000) {
      enhancedStatus.recommendations.push(
        "High latency detected - consider using a closer Presearch node",
      );
    }

    return {
      success: true,
      status: enhancedStatus,
      summary: {
        healthy: status.reachable && status.authenticated,
        message:
          status.reachable && status.authenticated
            ? "Presearch API connection is healthy"
            : "Presearch API connection issues detected - check recommendations",
      },
    };
  }),
};

export default tool;
export { tool as healthTool };
