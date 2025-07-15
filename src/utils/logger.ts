import { config } from '../config/configuration.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger with configurable levels and context
 */
export class Logger {
  private static instance: Logger;
  private readonly requestId?: string;

  private constructor(requestId?: string) {
    this.requestId = requestId;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public createChild(requestId: string): Logger {
    return new Logger(requestId);
  }

  /**
   * Log a message with the specified level
   */
  public log(level: LogLevel, message: string, context?: LogContext): void {
    const logLevel = config.getLogLevel();
    
    // Skip logs based on configured log level
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex > currentLevelIndex) return;

    const timestamp = new Date().toISOString();
    const requestIdPart = this.requestId ? ` [${this.requestId}]` : '';
    const prefix = `[${timestamp}]${requestIdPart} [${level.toUpperCase()}]`;

    const logMessage = context && Object.keys(context).length > 0
      ? [`${prefix} ${message}`, this.formatContext(context)]
      : [`${prefix} ${message}`];

    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(...logMessage);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(...logMessage);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(...logMessage);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(...logMessage);
        break;
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  public error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Format context object for logging
   */
  private formatContext(context: LogContext): string {
    try {
      return JSON.stringify(context, this.jsonReplacer, 2);
    } catch (error) {
      return `[Context serialization failed: ${error}]`;
    }
  }

  /**
   * JSON replacer to handle circular references and sensitive data
   */
  private jsonReplacer(key: string, value: unknown): unknown {
    // Hide sensitive information
    if (
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('password')
    ) {
      return '[REDACTED]';
    }

    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (value.constructor === Object || Array.isArray(value)) {
        return value;
      }
      return '[Object]';
    }

    return value;
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger that includes additional context in all log messages
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}

  public debug(message: string, additionalContext?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...additionalContext });
  }

  public info(message: string, additionalContext?: LogContext): void {
    this.parent.info(message, { ...this.context, ...additionalContext });
  }

  public warn(message: string, additionalContext?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...additionalContext });
  }

  public error(message: string, additionalContext?: LogContext): void {
    this.parent.error(message, { ...this.context, ...additionalContext });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
