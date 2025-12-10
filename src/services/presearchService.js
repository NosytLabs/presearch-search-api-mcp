import { apiClient } from "../core/apiClient.js";
import { resultProcessor } from "./resultProcessor.js";
import logger from "../core/logger.js";

export class PresearchService {
  /**
   * Execute a search query against the Presearch API
   * @param {string} query - The search query
   * @param {object} options - Search options (page, limit, etc.)
   */
  async search(query, options = {}) {
    try {
      const params = {
        q: query,
        page: options.page || 1,
        limit: options.limit || 20, // Presearch default limit
      };

      // Add optional parameters if provided
      if (options.safesearch) params.safe = options.safesearch;
      if (options.lang) params.lang = options.lang;
      if (options.country) params.country = options.country;

      const response = await apiClient.get("/v1/search", { params });
      
      // Process results using the result processor (deduplication, scoring, etc.)
      const processed = await resultProcessor.processResults(
        response.data.results || [], 
        query, 
        options
      );

      return {
        results: processed.results,
        metadata: processed.metadata,
        originalMeta: response.data.metadata || {} // Keep original metadata if needed
      };
    } catch (error) {
      logger.error("Presearch Service Error", { error: error.message, query });
      throw error;
    }
  }

  /**
   * Get node status (if endpoint available or mocked)
   */
  async getNodeStatus(nodeKey) {
    // Note: The public search API doesn't always expose node stats.
    // This is a placeholder or requires a specific endpoint.
    // For now, we'll return a structure that assumes a hypothetical endpoint
    // or return a "Not Implemented" if strictly using the search API.
    
    // If you have a node status endpoint:
    // return apiClient.get(`/nodes/${nodeKey}/status`);
    
    return {
      status: "online", // Mock for now or implement real call
      node_key: nodeKey ? `${nodeKey.substring(0, 4)}...` : "unknown",
      message: "Node status monitoring requires specific API access."
    };
  }
}

export const presearchService = new PresearchService();
