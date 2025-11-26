// Consolidated imports using unified core modules
import { apiClient } from "../core/apiClient.js";
import logger from "../core/logger.js";
import { loadConfig, filterSearchParams } from "../core/config.js";
import { normalizeError } from "../utils/errors.js";

const config = loadConfig();

export class PresearchService {
  constructor() {
    this.requestTimeout = config.timeout || 30000; // 30 seconds timeout for API requests
  }

  /**
   * Search for content using Presearch API
   * @param {Object} params - Search parameters
   * @param {string} params.q - Search query
   * @param {number} params.page - Page number
   * @param {number} params.per_page - Results per page
   * @param {string} params.lang - Language code (e.g., en-US)
   * @param {string} params.country - Country code (e.g., US)
   * @param {string} params.time - Timeframe (e.g., day, week, month)
   * @param {string} params.safe - Safe search setting ('1' or '0')
   * @param {string} [apiKey] - Optional API key override
   * @returns {Promise<Object>} Search results
   */
  async search(params, apiKey) {
    try {
      // Input validation
      if (!params || typeof params !== "object") {
        throw new Error("Invalid parameters: expected object");
      }
      if (
        !params.q ||
        typeof params.q !== "string" ||
        params.q.trim().length === 0
      ) {
        throw new Error("Invalid query: expected non-empty string");
      }
      if (params.q.length > 1000) {
        throw new Error("Query too long: maximum 1000 characters");
      }

      // Filter and validate parameters before making API call (using consolidated config)
      const reqParams = filterSearchParams(params);

      // IP defaulting handled in filterSearchParams

      logger.info("Performing Presearch search", {
        query: reqParams.q,
        page: reqParams.page,
        lang: reqParams.lang,
        safe: reqParams.safe,
      });

      const options = { timeout: this.requestTimeout };
      if (apiKey) {
        options.headers = { Authorization: `Bearer ${apiKey}` };
      }

      const data = await apiClient.get("/v1/search", reqParams, options);

      // Normalize results
      const results =
        data.results ||
        data.standardResults ||
        data.data?.results ||
        data.data?.standardResults ||
        [];
      const infoSection = data.infoSection || data.data?.infoSection;
      const specialSections =
        data.specialSections || data.data?.specialSections;

      // Enhance data object with normalized results
      const enhancedData = {
        ...data,
        results, // Ensure 'results' property always exists and contains the list
        ...(infoSection ? { infoSection } : {}),
        ...(specialSections ? { specialSections } : {}),
      };

      logger.info("Presearch API response received", {
        hasResults: results.length > 0,
        resultsLength: results.length,
      });

      return enhancedData;
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error("Presearch API search failed", {
        error: normalizedError.message,
        code: normalizedError.code,
        query: params.q,
      });
      throw normalizedError;
    }
  }
}

export default new PresearchService();
