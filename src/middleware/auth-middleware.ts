import { logger } from '../utils/logger';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * Authentication middleware for MCP server
 * Provides API key validation and request authentication
 */
export class AuthMiddleware {
  private static instance: AuthMiddleware;
  private validApiKeys: Set<string> = new Set();
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private totalRequests = 0;
  private successfulAuths = 0;
  private failedAuths = 0;
  private rateLimitViolations = 0;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // per window

  private constructor() {
    this.loadApiKeys();
    this.startCleanupTimer();
  }

  public static getInstance(): AuthMiddleware {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }
    return AuthMiddleware.instance;
  }

  /**
   * Load API keys from environment or configuration
   */
  private loadApiKeys(): void {
    // Load from environment variable (comma-separated)
    const envKeys = process.env.MCP_API_KEYS;
    if (envKeys) {
      const keys = envKeys.split(',').map(key => key.trim()).filter(key => key.length > 0);
      keys.forEach(key => this.validApiKeys.add(key));
      logger.info(`Loaded ${keys.length} API keys for MCP authentication`);
    }

    // If no keys configured, generate a warning
    if (this.validApiKeys.size === 0) {
      logger.warn('No MCP API keys configured. Server will accept all requests. Set MCP_API_KEYS environment variable for security.');
    }
  }

  /**
   * Add an API key programmatically
   */
  public addApiKey(apiKey: string): void {
    if (!apiKey || apiKey.length < 16) {
      throw new Error('API key must be at least 16 characters long');
    }
    this.validApiKeys.add(apiKey);
    logger.info('API key added to authentication middleware');
  }

  /**
   * Remove an API key
   */
  public removeApiKey(apiKey: string): void {
    this.validApiKeys.delete(apiKey);
    logger.info('API key removed from authentication middleware');
  }

  /**
   * Validate API key from request headers
   */
  public validateApiKey(headers: Record<string, string | string[]>): boolean {
    // If no API keys are configured, allow all requests (development mode)
    if (this.validApiKeys.size === 0) {
      return true;
    }

    // Extract API key from various possible header formats
    const apiKey = this.extractApiKey(headers);
    
    if (!apiKey) {
      logger.warn('Missing API key in request headers');
      return false;
    }

    const isValid = this.validApiKeys.has(apiKey);
    if (!isValid) {
      logger.warn('Invalid API key provided', { 
        keyPrefix: apiKey.substring(0, 8) + '...' 
      });
    }

    return isValid;
  }

  /**
   * Extract API key from request headers
   */
  private extractApiKey(headers: Record<string, string | string[]>): string | null {
    // Try different header formats
    const possibleHeaders = [
      'authorization',
      'x-api-key',
      'x-mcp-api-key',
      'api-key'
    ];

    for (const headerName of possibleHeaders) {
      const headerValue = headers[headerName];
      if (headerValue) {
        const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        
        // Handle Bearer token format
        if (headerName === 'authorization' && value.startsWith('Bearer ')) {
          return value.substring(7);
        }
        
        // Handle direct API key
        return value;
      }
    }

    return null;
  }

  /**
   * Rate limiting per API key
   */
  public checkRateLimit(apiKey: string): boolean {
    const now = Date.now();
    const key = apiKey || 'anonymous';
    
    let rateLimitData = this.rateLimitMap.get(key);
    
    if (!rateLimitData || now > rateLimitData.resetTime) {
      // Reset or initialize rate limit data
      rateLimitData = {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      };
      this.rateLimitMap.set(key, rateLimitData);
      return true;
    }

    if (rateLimitData.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      logger.warn('Rate limit exceeded', { 
        apiKey: key.substring(0, 8) + '...',
        count: rateLimitData.count,
        resetTime: new Date(rateLimitData.resetTime).toISOString()
      });
      return false;
    }

    rateLimitData.count++;
    return true;
  }

  /**
   * Authenticate request with comprehensive validation
   */
  public authenticateRequest(headers: Record<string, string | string[]>): {
    isAuthenticated: boolean;
    apiKey?: string;
    error?: string;
  } {
    try {
      this.totalRequests++;
      // Validate API key
      const isValidKey = this.validateApiKey(headers);
      if (!isValidKey) {
        this.failedAuths++;
        return {
          isAuthenticated: false,
          error: 'Invalid or missing API key'
        };
      }
      const apiKey = this.extractApiKey(headers);
      // Check rate limiting
      if (!this.checkRateLimit(apiKey || 'anonymous')) {
        this.rateLimitViolations++;
        this.failedAuths++;
        return {
          isAuthenticated: false,
          error: 'Rate limit exceeded'
        };
      }
      this.successfulAuths++;
      return {
        isAuthenticated: true,
        apiKey: apiKey || undefined
      };
    } catch (error) {
      logger.error('Authentication error', { error });
      this.failedAuths++;
      return {
        isAuthenticated: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Generate a secure API key
   */
  public generateApiKey(prefix?: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix ? `${prefix}-` : 'mcp-';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get authentication statistics
   */
  public getStats(): {
    totalApiKeys: number;
    activeRateLimits: number;
    totalRequests: number;
    successfulAuths: number;
    failedAuths: number;
    rateLimitViolations: number;
    rateLimitData: Array<{
      apiKey: string;
      count: number;
      resetTime: string;
    }>;
  } {
    const rateLimitData = Array.from(this.rateLimitMap.entries()).map(([key, data]) => ({
      apiKey: key.substring(0, 8) + '...',
      count: data.count,
      resetTime: new Date(data.resetTime).toISOString()
    }));
    return {
      totalApiKeys: this.validApiKeys.size,
      activeRateLimits: this.rateLimitMap.size,
      totalRequests: this.totalRequests,
      successfulAuths: this.successfulAuths,
      failedAuths: this.failedAuths,
      rateLimitViolations: this.rateLimitViolations,
      rateLimitData
    };
  }
  public resetStats(): void {
    this.totalRequests = 0;
    this.successfulAuths = 0;
    this.failedAuths = 0;
    this.rateLimitViolations = 0;
  }

  /**
   * Cleanup expired rate limit entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitMap.entries()) {
        if (now > data.resetTime) {
          this.rateLimitMap.delete(key);
        }
      }
    }, this.RATE_LIMIT_WINDOW);
  }

  /**
   * Middleware function for MCP requests
   */
  public createAuthMiddleware() {
    return (request: any, next: () => Promise<any>) => {
      const headers = request.headers || {};
      const authResult = this.authenticateRequest(headers);
      
      if (!authResult.isAuthenticated) {
        throw new McpError(
          -32603, // Internal error code
          authResult.error || 'Authentication failed'
        );
      }

      // Add authentication info to request context
      request.auth = {
        apiKey: authResult.apiKey,
        authenticated: true
      };

      return next();
    };
  }
}

// Export singleton instance
export const authMiddleware = AuthMiddleware.getInstance();