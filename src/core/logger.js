/**
 * Consolidated Logger Module
 * Centralized logging with pino for high performance
 */

import pino from "pino";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, "../../logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Create pino logger with default configuration (will be updated when config is available)
let loggerConfig = {
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
};

let internalLogger = pino(loggerConfig);

// Function to update logger configuration when config is available
export const updateLoggerConfig = (config) => {
  loggerConfig.level = config.logging.level;

  // Detect if running with MCP Inspector or Stdio transport
  const isRunningWithInspector =
    process.argv.some(
      (arg) =>
        arg.includes("inspector") ||
        arg.includes("@modelcontextprotocol/inspector"),
    ) ||
    process.env.MCP_INSPECTOR === "true" ||
    process.env.NODE_ENV === "inspector";

  const isStdioMode =
    process.env.MCP_TRANSPORT === "stdio" || process.argv.includes("--stdio");

  if (isRunningWithInspector) {
    // When running with Inspector, suppress stdout logging completely
    loggerConfig = {
      ...loggerConfig,
      transport: {
        target: "pino/file",
        options: {
          destination: join(logsDir, "mcp-inspector.log"),
          mkdir: true,
          sync: false,
        },
      },
      level: "error",
    };
  } else if (isStdioMode) {
    // In Stdio mode, we MUST log to stderr to avoid corrupting the JSON-RPC stream on stdout
    loggerConfig = {
      ...loggerConfig,
      transport: {
        target: "pino/file",
        options: {
          destination: 2, // 2 is stderr
          sync: true, // Sync logging for stderr is safer for immediate output
        },
      },
    };
  } else if (config.logging.pretty) {
    loggerConfig = {
      ...loggerConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    };
  }

  // Re-create the logger with the new configuration
  internalLogger = pino(loggerConfig);
};

// Wrapper to ensure consistent API and allow hot-swapping the internal logger
class LoggerWrapper {
  error(message, meta = {}) {
    internalLogger.error(meta, message);
  }

  warn(message, meta = {}) {
    internalLogger.warn(meta, message);
  }

  info(message, meta = {}) {
    internalLogger.info(meta, message);
  }

  debug(message, meta = {}) {
    internalLogger.debug(meta, message);
  }

  log(level, message, meta = {}) {
    internalLogger[level](meta, message);
  }
}

export default new LoggerWrapper();
