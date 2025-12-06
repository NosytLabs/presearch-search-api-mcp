/**
 * Consolidated Configuration Module
 * Centralized configuration for Presearch MCP Server
 * Enhanced with Presearch API validation and optimization
 */

import dotenv from "dotenv";
import { z } from "zod";
import logger, { updateLoggerConfig } from "./logger.js";

dotenv.config();

const configSchema = z.object({
  apiKey: z
    .string()
    .optional()
    .default("")
    .describe("Presearch API Key - Get yours at https://presearch.com/"),
  baseUrl: z
    .string()
    .url()
    .default("https://na-us-1.presearch.com")
    .describe("Presearch API Base URL"),
  timeout: z
    .number()
    .min(1000)
    .max(30000)
    .default(10000)
    .describe("Request timeout in milliseconds (1000-30000)"),
  retries: z
    .number()
    .min(0)
    .max(5)
    .default(3)
    .describe("Number of retry attempts for failed requests (0-5)"),
  rateLimit: z
    .object({
      maxRequests: z.number().min(1).max(1000).default(100),
      windowMs: z.number().min(1000).max(3600000).default(60000),
    })
    .default({ maxRequests: 100, windowMs: 60000 })
    .describe("Rate limiting configuration"),
  cache: z
    .object({
      enabled: z.boolean().default(true),
      ttl: z.number().min(60).max(86400).default(300),
      maxKeys: z.number().min(100).max(10000).default(1000),
    })
    .default({ enabled: true, ttl: 300, maxKeys: 1000 })
    .describe("Caching configuration"),
  search: z
    .object({
      maxResults: z.number().min(10).max(100).default(50),
      defaultSafeSearch: z
        .enum(["off", "moderate", "strict"])
        .default("moderate"),
      defaultLanguage: z
        .string()
        .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
        .default("en-US"),
      supportedLanguages: z
        .array(z.string())
        .default(["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"]),
      supportedCountries: z
        .array(z.string())
        .default(["US", "CA", "GB", "AU", "DE", "FR", "ES", "IT", "BR", "JP"]),
    })
    .default({
      maxResults: 50,
      defaultSafeSearch: "moderate",
      defaultLanguage: "en-US",
      supportedLanguages: [
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
        "ru",
        "ja",
        "ko",
        "zh",
      ],
      supportedCountries: [
        "US",
        "CA",
        "GB",
        "AU",
        "DE",
        "FR",
        "ES",
        "IT",
        "BR",
        "JP",
      ],
    })
    .describe("Search behavior configuration"),
  logging: z
    .object({
      level: z.enum(["error", "warn", "info", "debug"]).default("info"),
      pretty: z.boolean().default(false),
    })
    .default({ level: "info", pretty: false })
    .describe("Logging configuration"),
  port: z.number().min(1000).max(65535).default(3000).describe("Server port"),
});

let config;

/**
 * Validates Presearch API key format
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} - True if valid format
 */
const validateApiKeyFormat = (apiKey) => {
  if (!apiKey || typeof apiKey !== "string") return false;

  // Presearch API keys can be either:
  // 1. JWT tokens (contain dots and special characters)
  // 2. Simple alphanumeric strings with hyphens/underscores
  // Both should be at least 16 characters
  if (apiKey.length < 16) return false;

  // JWT tokens contain dots and are longer
  if (apiKey.includes(".") && apiKey.length > 50) {
    return true; // Likely a JWT token
  }

  // Simple API key format
  return /^[a-zA-Z0-9_-]+$/.test(apiKey);
};

/**
 * Provides helpful configuration guidance
 * @param {string} apiKey - The API key being validated
 * @returns {string} - Helpful guidance message
 */
const getApiKeyGuidance = (apiKey) => {
  if (!apiKey) {
    return "No PRESEARCH_API_KEY found. Get your free API key at https://presearch.com/";
  }

  if (apiKey.length < 16) {
    return "PRESEARCH_API_KEY appears too short. API keys are typically 16+ characters.";
  }

  if (!apiKey.includes(".") && !/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
    return "PRESEARCH_API_KEY contains invalid characters. Simple keys should use only letters, numbers, hyphens, and underscores.";
  }

  return "PRESEARCH_API_KEY format appears valid. If authentication fails, verify your key at https://presearch.com/";
};

export const loadConfig = () => {
  if (config) return config;

  let configData; // Declare configData at the function scope

  try {
    // Build configuration object with proper defaults
    configData = {
      apiKey: process.env.PRESEARCH_API_KEY || "",
      baseUrl:
        process.env.PRESEARCH_BASE_URL || "https://na-us-1.presearch.com",
      timeout: process.env.PRESEARCH_TIMEOUT
        ? parseInt(process.env.PRESEARCH_TIMEOUT)
        : 10000,
      retries: process.env.PRESEARCH_RETRIES
        ? parseInt(process.env.PRESEARCH_RETRIES)
        : 3,
      rateLimit: {
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS
          ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
          : 100,
        windowMs: process.env.RATE_LIMIT_WINDOW_MS
          ? parseInt(process.env.RATE_LIMIT_WINDOW_MS)
          : 60000,
      },
      cache: {
        enabled: process.env.CACHE_ENABLED
          ? process.env.CACHE_ENABLED === "true"
          : true,
        ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 300,
        maxKeys: process.env.CACHE_MAX_KEYS
          ? parseInt(process.env.CACHE_MAX_KEYS)
          : 1000,
      },
      search: {
        maxResults: process.env.SEARCH_MAX_RESULTS
          ? parseInt(process.env.SEARCH_MAX_RESULTS)
          : 50,
        defaultSafeSearch: process.env.PRESEARCH_SAFE_SEARCH || "moderate",
        defaultLanguage: process.env.PRESEARCH_DEFAULT_LANGUAGE || "en-US",
        supportedLanguages: [
          "en",
          "es",
          "fr",
          "de",
          "it",
          "pt",
          "ru",
          "ja",
          "ko",
          "zh",
        ],
        supportedCountries: [
          "US",
          "CA",
          "GB",
          "AU",
          "DE",
          "FR",
          "ES",
          "IT",
          "BR",
          "JP",
        ],
      },
      logging: {
        level: process.env.LOG_LEVEL || "info",
        pretty: process.env.LOG_PRETTY
          ? process.env.LOG_PRETTY === "true"
          : false,
      },
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    };

    const parsedConfig = configSchema.parse(configData);

    // Validate API key format and provide guidance
    if (parsedConfig.apiKey) {
      if (!validateApiKeyFormat(parsedConfig.apiKey)) {
        logger.warn("PRESEARCH_API_KEY format validation warning", {
          apiKeyLength: parsedConfig.apiKey.length,
          guidance: getApiKeyGuidance(parsedConfig.apiKey),
        });
      } else {
        logger.info("PRESEARCH_API_KEY format validation passed");
      }
    } else {
      logger.warn("PRESEARCH_API_KEY not configured", {
        guidance: getApiKeyGuidance(""),
      });
    }

    config = parsedConfig;
    updateLoggerConfig(config);
    logger.info("Configuration loaded and validated successfully");

    // Log configuration summary (without exposing API key)
    logger.info("Presearch MCP Server Configuration Summary", {
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      rateLimit: config.rateLimit,
      cache: {
        enabled: config.cache.enabled,
        ttl: config.cache.ttl,
        maxKeys: config.cache.maxKeys,
      },
      search: config.search,
      logging: config.logging,
      port: config.port,
      apiKeyConfigured: !!config.apiKey,
    });

    return config;
  } catch (error) {
    // Use console.error instead of logger to avoid dependency on config
    console.error("Invalid configuration:", error.errors || error.message);
    console.error("Full error object:", error);
    console.error(
      "Configuration data that failed validation:",
      JSON.stringify(configData, null, 2),
    );
    console.error("Environment variables:", {
      apiKey: process.env.PRESEARCH_API_KEY ? "SET" : "NOT_SET",
      baseUrl: process.env.PRESEARCH_BASE_URL,
      timeout: process.env.PRESEARCH_TIMEOUT,
      retries: process.env.PRESEARCH_RETRIES,
      rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
      rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
      cacheEnabled: process.env.CACHE_ENABLED,
      cacheTtl: process.env.CACHE_TTL,
      cacheMaxKeys: process.env.CACHE_MAX_KEYS,
      searchMaxResults: process.env.SEARCH_MAX_RESULTS,
      searchDefaultSafeSearch: process.env.PRESEARCH_SAFE_SEARCH,
      searchDefaultLanguage: process.env.PRESEARCH_DEFAULT_LANGUAGE,
      logLevel: process.env.LOG_LEVEL,
      logPretty: process.env.LOG_PRETTY,
    });
    throw new Error(
      "Configuration validation failed: " +
        (error.errors ? JSON.stringify(error.errors) : error.message),
    );
  }
};

const isValidIP = (ip) => {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

const isValidCountryCode = (code) => {
  return /^[A-Z]{2}$/.test(code);
};

const isValidLanguageCode = (code) => {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code);
};

const normalizeLanguageCode = (code) => {
  if (!code || typeof code !== "string") return code;
  const parts = code.split("-");
  if (parts.length === 2) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }
  return parts[0].toLowerCase();
};

const isValidCoordinates = (loc) => {
  if (!loc || typeof loc !== "object") return false;
  const { lat, long } = loc;
  return (
    typeof lat === "number" &&
    typeof long === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    long >= -180 &&
    long <= 180
  );
};

const filterSearchParams = (params) => {
  const filtered = {};

  if (params.q || params.query) {
    filtered.q = String(params.q || params.query).trim();
  }

  if (params.safe !== undefined) {
    const val = String(params.safe).toLowerCase();
    if (["off", "0"].includes(val)) {
      filtered.safe = "0";
    } else if (["moderate", "strict", "1"].includes(val)) {
      filtered.safe = "1";
    }
  }

  if (
    params.time &&
    ["any", "day", "week", "month", "year"].includes(params.time)
  ) {
    filtered.time = params.time;
  }

  if (params.lang && isValidLanguageCode(params.lang)) {
    filtered.lang = normalizeLanguageCode(params.lang);
  }

  if (params.country) {
    const countryUpper = params.country.toUpperCase();
    if (isValidCountryCode(countryUpper)) {
      filtered.country = countryUpper;
    }
  }

  if (params.ip && isValidIP(params.ip)) {
    filtered.ip = params.ip;
  }

  if (params.location) {
    let locObj = null;
    if (typeof params.location === "string") {
      try {
        const parsed = JSON.parse(params.location);
        if (isValidCoordinates(parsed)) locObj = parsed;
      } catch {
        // ignore
      }
    } else if (isValidCoordinates(params.location)) {
      locObj = params.location;
    }
    if (locObj) {
      filtered.location = JSON.stringify({
        lat: locObj.lat,
        long: locObj.long,
      });
    }
  }

  if (params.page && Number.isInteger(params.page) && params.page > 0) {
    filtered.page = params.page;
  }

  // Map result count parameters (count, limit, per_page, max_results) to 'count'
  const countVal =
    params.count || params.limit || params.per_page || params.max_results;
  if (countVal !== undefined) {
    const parsedCount = parseInt(countVal, 10);
    if (!isNaN(parsedCount) && parsedCount > 0 && parsedCount <= 100) {
      filtered.count = parsedCount;
    }
  }

  // Default to using a dummy IP if neither IP nor location is provided
  // This is required by Presearch API as of recent updates
  if (!filtered.ip && !filtered.location) {
    // Use a generic US IP address if none provided
    filtered.ip = "8.8.8.8";
  }

  return filtered;
};

export {
  isValidIP,
  isValidCountryCode,
  isValidLanguageCode,
  isValidCoordinates,
  filterSearchParams,
  validateApiKeyFormat,
  getApiKeyGuidance,
};
