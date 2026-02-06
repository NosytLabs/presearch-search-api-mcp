import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

/**
 * Configuration schema for validation
 */
const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().default("https://na-us-1.presearch.com"),
  timeout: z.coerce.number().default(10000),
  retries: z.coerce.number().default(3),
  port: z.coerce.number().default(3002),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  puppeteerArgs: z.array(z.string()).default([]),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(300000), // 5 minutes
    maxSize: z.number().default(1000),
  }).default({}),
  rateLimit: z.object({
    maxRequests: z.number().default(60),
    windowMs: z.number().default(60000), // 1 minute
  }).default({}),
  search: z.object({
    defaultSafeSearch: z.enum(["strict", "moderate", "off"]).default("moderate"),
    defaultLanguage: z.string().default("en-US"),
    supportedLanguages: z.array(z.string()).default([
      "en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "it-IT", "pt-BR", "ja-JP", "zh-CN", "ru-RU"
    ]),
    supportedCountries: z.array(z.string()).default([
      "US", "GB", "CA", "AU", "DE", "FR", "IT", "ES", "BR", "JP", "CN", "IN", "RU"
    ]),
  }).default({}),
});

/**
 * Load and validate configuration
 */
export function loadConfig() {
  const rawConfig = {
    apiKey: process.env.PRESEARCH_API_KEY,
    baseUrl: process.env.PRESEARCH_BASE_URL,
    timeout: process.env.PRESEARCH_TIMEOUT,
    logLevel: process.env.LOG_LEVEL,
    port: process.env.PORT,
    puppeteerArgs: process.env.PUPPETEER_ARGS
      ? process.env.PUPPETEER_ARGS.split(",")
          .map((arg) => arg.trim())
          .filter(Boolean)
      : undefined,
    // Nested configs could be loaded from JSON if needed, but defaults work for now
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    console.error("❌ Invalid configuration:", error.errors);
    // Return defaults with warning if validation fails
    return ConfigSchema.parse({});
  }
}

export const config = loadConfig();

export const getConfig = () => config;
