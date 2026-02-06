import { getConfig } from "../core/config.js";
import logger from "../core/logger.js";

/**
 * Middleware to validate API key
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const validateApiKey = (req, res, next) => {
  const config = getConfig();

  // If no API key is configured, allow access
  if (!config.mcpApiKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.mcpApiKey) {
    logger.warn(`Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
  }

  next();
};
