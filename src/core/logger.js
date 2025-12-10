/**
 * Simple logger wrapper
 */
const logger = {
  info: (message, meta = {}) => {
    console.error(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },
  warn: (message, meta = {}) => {
    console.error(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },
  error: (message, meta = {}) => {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },
  debug: (message, meta = {}) => {
    if (process.env.LOG_LEVEL === "debug") {
      console.error(
        JSON.stringify({
          level: "debug",
          timestamp: new Date().toISOString(),
          message,
          ...meta,
        }),
      );
    }
  },
};

export default logger;
