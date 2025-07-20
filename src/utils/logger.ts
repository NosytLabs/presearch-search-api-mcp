import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath: string;
  maxFileSize: number;
  maxFiles: number;
  enableRotation: boolean;
  enableStructuredLogging: boolean;
  enablePerformanceLogging: boolean;
}

interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger with configurable levels and context
 */
export class Logger {
  private static defaultConfig: LogConfig = {
    level: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    filePath: "./logs/app.log",
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    enableRotation: true,
    enableStructuredLogging: true,
    enablePerformanceLogging: false,
  };

  private static instance: Logger | null = null;
  private config: LogConfig;
  private isShutdown: boolean = false;
  private timers: Map<string, number> = new Map();

  private constructor(config: LogConfig = Logger.defaultConfig) {
    this.config = config;
  }

  public static getInstance(config?: LogConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config ?? Logger.defaultConfig);
    } else if (config) {
      Logger.instance.updateConfig(config);
    }
    return Logger.instance;
  }

  /**
   * Log a message with the specified level
   */
  public log(level: LogLevel, message: any, context?: LogContext | null): void {
    if (typeof message !== "string") {
      message = this.stringifySafe(message);
    }
    if (this.isShutdown) return;
    if (level > this.config.level) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level].toUpperCase();

    let callerInfo = "";
    if (level === LogLevel.DEBUG) {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split("\n");
        const callerLine = lines[3] || lines[2];
        callerInfo = callerLine ? callerLine.trim() : "";
      }
    }

    let prefix: string;
    if (level === LogLevel.DEBUG) {
      prefix = `[${levelStr}] ${callerInfo}`;
    } else {
      prefix = `${timestamp} [${levelStr}]`;
    }
    let logArgs = [prefix, message];
    if (context && this.config.enableStructuredLogging) {
      logArgs.push(this.formatContext(context));
    }

    if (this.config.enableConsole) {
      let consoleMethod = console.log;
      switch (level) {
        case LogLevel.ERROR:
          consoleMethod = console.error;
          break;
        case LogLevel.WARN:
          consoleMethod = console.warn;
          break;
        case LogLevel.INFO:
          consoleMethod = console.info;
          break;
        case LogLevel.DEBUG:
          consoleMethod = console.debug;
          break;
      }
      try {
        consoleMethod(...logArgs);
      } catch (e) {
        // Handle console error silently to prevent app crash
      }
    }

    if (this.config.enableFile) {
      this.writeToLogFile(logArgs.join(" "));
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: LogContext | null): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: LogContext | null): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: LogContext | null): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: LogContext | null): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Format context object for logging
   */
  private formatContext(context: LogContext): string {
    try {
      return this.stringifySafe(context);
    } catch (error) {
      return `[Context serialization failed: ${error}]`;
    }
  }

  private stringifySafe(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      if (
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("password")
      ) {
        return "[REDACTED]";
      }
      if (typeof value === "function") return "[Function]";
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "symbol") return value.toString();
      return value;
    });
  }

  private writeToLogFile(logMessage: string) {
    try {
      const dir = path.dirname(this.config.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (this.config.enableRotation) {
        if (fs.existsSync(this.config.filePath)) {
          const stats = fs.statSync(this.config.filePath);
          if (stats.size > this.config.maxFileSize) this.rotateLogs();
        }
      }
      fs.appendFileSync(this.config.filePath, logMessage + "\n", "utf8");
    } catch (e) {
      console.error("Failed to write to log file", e);
    }
  }

  private rotateLogs() {
    try {
      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const oldPath = `${this.config.filePath}.${i}`;
        const newPath = `${this.config.filePath}.${i + 1}`;
        if (fs.existsSync(oldPath)) {
          if (i === this.config.maxFiles - 1) {
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }
      fs.renameSync(this.config.filePath, `${this.config.filePath}.1`);
    } catch (e) {
      console.error("Log rotation failed", e);
    }
  }

  public startTimer(operation: string): string {
    if (!this.config.enablePerformanceLogging) return "";
    this.cleanupOldTimers();
    const id = `${operation}_${Date.now()}`;
    this.timers.set(id, Date.now());
    return id;
  }

  public endTimer(id: string, message: string): void {
    if (!this.config.enablePerformanceLogging) return;
    const start = this.timers.get(id);
    if (start === undefined) {
      this.warn(`Timer not found: ${id}`);
      return;
    }
    const duration = Date.now() - start;
    this.info(`${message} - duration: ${duration}ms`, { duration });
    this.timers.delete(id);
  }

  private cleanupOldTimers(): void {
    const now = Date.now();
    for (const [id, start] of this.timers.entries()) {
      if (now - start > 60000) {
        this.timers.delete(id);
      }
    }
  }

  public updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public async shutdown(): Promise<void> {
    this.isShutdown = true;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
