import logger from "../core/logger.js";

export const logToolUsage = (toolName, params) => {
  logger.info(`Tool executed: ${toolName}`, { params });
};
