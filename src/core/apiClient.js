import axios from "axios";
import { loadConfig } from "./config.js";
import logger from "./logger.js";

/**
 * Enhanced API Client with monitoring, retries, and circuit breaking
 */
class ApiClient {
  constructor() {
    this.config = loadConfig();
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "X-Source": "presearch-mcp-server",
        Accept: "application/json",
      },
    });

    this.rateLimit = {
      remaining: 60,
      reset: Date.now() + 60000,
      total: 60,
    };

    // Request interceptor for auth and logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Dynamic config loading to pick up runtime changes
        const currentConfig = loadConfig();
        if (currentConfig.apiKey) {
          config.headers["Authorization"] = `Bearer ${currentConfig.apiKey}`;
        }

        logger.debug(
          `API Request: ${config.method?.toUpperCase()} ${config.url}`,
          {
            params: config.params,
          },
        );

        return config;
      },
      (error) => {
        logger.error("API Request Error", { error: error.message });
        return Promise.reject(error);
      },
    );

    // Response interceptor for rate limiting and logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.updateRateLimit(response.headers);
        logger.debug(`API Response: ${response.status}`, {
          url: response.config.url,
          dataLength: JSON.stringify(response.data).length,
        });
        return response;
      },
      async (error) => {
        this.updateRateLimit(error.response?.headers);

        if (error.response) {
          logger.error(
            `API Error: ${error.response.status} ${error.response.statusText}`,
            {
              data: error.response.data,
              url: error.config?.url,
            },
          );

          // Enhanced handling for 402 Payment Required
          if (error.response.status === 402) {
            const paymentError = new Error(
              "PRESEARCH API PAYMENT REQUIRED: Your account has insufficient credits. " +
                "Please visit https://presearch.com/account/tokens to top up your account or check your plan.",
            );
            paymentError.name = "PaymentRequiredError";
            paymentError.status = 402;
            return Promise.reject(paymentError);
          }
        } else {
          logger.error("Network Error", { error: error.message });
        }

        // Implement simple exponential backoff for 429 and 5xx
        const config = error.config;
        if (
          config &&
          !config.__isRetryRequest &&
          (error.response?.status === 429 || error.response?.status >= 500)
        ) {
          config.__isRetryRequest = true;
          config.__retryCount = config.__retryCount || 0;

          if (config.__retryCount < this.config.retries) {
            config.__retryCount++;
            const delay = Math.pow(2, config.__retryCount) * 1000;
            logger.info(
              `Retrying request (${config.__retryCount}/${this.config.retries}) in ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.axiosInstance(config);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Update rate limit tracking from response headers
   */
  updateRateLimit(headers) {
    if (!headers) return;

    if (headers["x-ratelimit-remaining"]) {
      this.rateLimit.remaining = parseInt(headers["x-ratelimit-remaining"], 10);
    }
    if (headers["x-ratelimit-reset"]) {
      this.rateLimit.reset = parseInt(headers["x-ratelimit-reset"], 10) * 1000;
    }
    if (headers["x-ratelimit-limit"]) {
      this.rateLimit.total = parseInt(headers["x-ratelimit-limit"], 10);
    }
  }

  /**
   * Check if we are rate limited locally before making a request
   */
  checkRateLimit() {
    if (this.rateLimit.remaining <= 0 && Date.now() < this.rateLimit.reset) {
      const waitTime = Math.ceil((this.rateLimit.reset - Date.now()) / 1000);
      throw new Error(
        `Rate limit exceeded. Please try again in ${waitTime} seconds.`,
      );
    }
  }

  /**
   * Make a GET request
   */
  async get(url, config = {}) {
    this.checkRateLimit();
    return this.axiosInstance.get(url, config);
  }

  /**
   * Make a POST request
   */
  async post(url, data, config = {}) {
    this.checkRateLimit();
    return this.axiosInstance.post(url, data, config);
  }

  /**
   * Get current rate limit stats
   */
  getRateLimitStats() {
    return {
      ...this.rateLimit,
      resetDate: new Date(this.rateLimit.reset).toISOString(),
    };
  }
}

export const apiClient = new ApiClient();
