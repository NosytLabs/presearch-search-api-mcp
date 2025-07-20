/**
 * Security middleware for adding security headers and additional protections
 */

import { Logger } from '../utils/logger';
import { SecurityError, InputSanitizationError } from '../utils/enhanced-error-types';

export interface SecurityConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXContentTypeOptions: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  maxRequestSize: number;
  allowedOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  enableRequestLogging: boolean;
  enableSuspiciousActivityDetection: boolean;
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'X-XSS-Protection'?: string;
  'X-DNS-Prefetch-Control'?: string;
}

export interface SecurityContext {
  requestId: string;
  timestamp: Date;
  userAgent?: string;
  origin?: string;
  referer?: string;
  ipAddress?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
}

export interface SuspiciousActivity {
  type: 'RAPID_REQUESTS' | 'INVALID_INPUT' | 'SUSPICIOUS_HEADERS' | 'MALFORMED_REQUEST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  context: SecurityContext;
  timestamp: Date;
}

/**
 * Security middleware class for comprehensive request protection
 */
export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private logger: Logger;
  private config: SecurityConfig;
  private requestCounts: Map<string, { count: number; firstRequest: Date }> = new Map();
  private suspiciousActivities: SuspiciousActivity[] = [];
  private blockedIPs: Set<string> = new Set();

  private constructor(config?: Partial<SecurityConfig>) {
    this.logger = Logger.getInstance();
    this.config = {
      enableCSP: true,
      enableHSTS: true,
      enableXFrameOptions: true,
      enableXContentTypeOptions: true,
      enableReferrerPolicy: true,
      enablePermissionsPolicy: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: ['*'], // Configure based on your needs
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 100, // 100 requests per minute
      enableRequestLogging: true,
      enableSuspiciousActivityDetection: true,
      ...config,
    };

    // Clean up old request counts periodically
    setInterval(() => this.cleanupRequestCounts(), 60000); // Every minute
    
    // Clean up old suspicious activities
    setInterval(() => this.cleanupSuspiciousActivities(), 300000); // Every 5 minutes
  }

  public static getInstance(config?: Partial<SecurityConfig>): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware(config);
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Apply security middleware to a request
   */
  public async applySecurityMiddleware(
    request: any,
    context?: Record<string, unknown>
  ): Promise<{ headers: SecurityHeaders; context: SecurityContext }> {
    const securityContext = this.createSecurityContext(request);
    
    try {
      // Check if IP is blocked
      if (this.isIPBlocked(securityContext.ipAddress)) {
        throw new SecurityError(`IP address ${securityContext.ipAddress} is blocked`);
      }

      // Apply rate limiting
      await this.applyRateLimit(securityContext);

      // Validate request size
      this.validateRequestSize(request);

      // Sanitize and validate headers
      this.validateHeaders(securityContext.headers);

      // Detect suspicious activity
      if (this.config.enableSuspiciousActivityDetection) {
        this.detectSuspiciousActivity(securityContext);
      }

      // Log request if enabled
      if (this.config.enableRequestLogging) {
        this.logRequest(securityContext, context);
      }

      // Generate security headers
      const headers = this.generateSecurityHeaders();

      return { headers, context: securityContext };
    } catch (error) {
      this.logger.error('Security middleware error', {
        error: error instanceof Error ? error.message : String(error),
        context: securityContext,
      });
      throw error;
    }
  }

  /**
   * Create security context from request
   */
  private createSecurityContext(request: any): SecurityContext {
    return {
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      userAgent: request.headers?.['user-agent'],
      origin: request.headers?.['origin'],
      referer: request.headers?.['referer'],
      ipAddress: this.extractIPAddress(request),
      method: request.method,
      path: request.url || request.path,
      headers: request.headers || {},
    };
  }

  /**
   * Extract IP address from request
   */
  private extractIPAddress(request: any): string {
    // Try various headers for IP address
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip',
      'true-client-ip',
    ];

    for (const header of ipHeaders) {
      const ip = request.headers?.[header];
      if (ip) {
        // Take the first IP if comma-separated
        return ip.split(',')[0].trim();
      }
    }

    return request.connection?.remoteAddress || 
           request.socket?.remoteAddress || 
           request.ip || 
           'unknown';
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(context: SecurityContext): Promise<void> {
    const key = context.ipAddress || 'unknown';
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.rateLimitWindow);

    // Get or create request count for this IP
    let requestData = this.requestCounts.get(key);
    if (!requestData || requestData.firstRequest < windowStart) {
      requestData = { count: 0, firstRequest: now };
      this.requestCounts.set(key, requestData);
    }

    requestData.count++;

    if (requestData.count > this.config.rateLimitMax) {
      // Record suspicious activity
      this.recordSuspiciousActivity({
        type: 'RAPID_REQUESTS',
        severity: 'HIGH',
        description: `Rate limit exceeded: ${requestData.count} requests in window`,
        context,
        timestamp: now,
      });

      // Temporarily block IP if too many violations
      if (requestData.count > this.config.rateLimitMax * 2) {
        this.blockedIPs.add(key);
        setTimeout(() => this.blockedIPs.delete(key), 300000); // Block for 5 minutes
      }

      throw new SecurityError(
        `Rate limit exceeded for IP ${key}: ${requestData.count} requests in ${this.config.rateLimitWindow}ms window`
      );
    }
  }

  /**
   * Validate request size
   */
  private validateRequestSize(request: any): void {
    const contentLength = parseInt(request.headers?.['content-length'] || '0', 10);
    if (contentLength > this.config.maxRequestSize) {
      throw new SecurityError(
        `Request size ${contentLength} exceeds maximum allowed size ${this.config.maxRequestSize}`
      );
    }
  }

  /**
   * Validate and sanitize headers
   */
  private validateHeaders(headers: Record<string, string> = {}): void {
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /eval\(/i,
      /expression\(/i,
    ];

    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        // Check for suspicious patterns
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(value)) {
            throw new InputSanitizationError(
              value,
              `Suspicious pattern detected in header ${name}`
            );
          }
        }

        // Validate header length
        if (value.length > 8192) { // 8KB limit per header
          throw new SecurityError(`Header ${name} exceeds maximum length`);
        }
      }
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(context: SecurityContext): void {
    // Check for suspicious user agents
    if (context.userAgent) {
      const suspiciousUAPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
      ];

      if (suspiciousUAPatterns.some(pattern => pattern.test(context.userAgent!))) {
        this.recordSuspiciousActivity({
          type: 'SUSPICIOUS_HEADERS',
          severity: 'MEDIUM',
          description: `Suspicious user agent: ${context.userAgent}`,
          context,
          timestamp: new Date(),
        });
      }
    }

    // Check for missing common headers
    if (!context.headers?.['user-agent'] && !context.headers?.['accept']) {
      this.recordSuspiciousActivity({
        type: 'SUSPICIOUS_HEADERS',
        severity: 'MEDIUM',
        description: 'Missing common headers (User-Agent, Accept)',
        context,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Generate security headers
   */
  private generateSecurityHeaders(): SecurityHeaders {
    const headers: SecurityHeaders = {};

    if (this.config.enableCSP) {
      headers['Content-Security-Policy'] = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
      ].join('; ');
    }

    if (this.config.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.enableXFrameOptions) {
      headers['X-Frame-Options'] = 'DENY';
    }

    if (this.config.enableXContentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    if (this.config.enableReferrerPolicy) {
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    }

    if (this.config.enablePermissionsPolicy) {
      headers['Permissions-Policy'] = [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
      ].join(', ');
    }

    // Additional security headers
    headers['X-XSS-Protection'] = '1; mode=block';
    headers['X-DNS-Prefetch-Control'] = 'off';

    return headers;
  }

  /**
   * Record suspicious activity
   */
  private recordSuspiciousActivity(activity: SuspiciousActivity): void {
    this.suspiciousActivities.push(activity);
    
    this.logger.warn('Suspicious activity detected', {
      type: activity.type,
      severity: activity.severity,
      description: activity.description,
      context: activity.context,
    });

    // Keep only recent activities (last 1000)
    if (this.suspiciousActivities.length > 1000) {
      this.suspiciousActivities = this.suspiciousActivities.slice(-1000);
    }
  }

  /**
   * Check if IP is blocked
   */
  private isIPBlocked(ipAddress?: string): boolean {
    return ipAddress ? this.blockedIPs.has(ipAddress) : false;
  }

  /**
   * Clean up old request counts
   */
  private cleanupRequestCounts(): void {
    const cutoff = new Date(Date.now() - this.config.rateLimitWindow * 2);
    
    for (const [key, data] of this.requestCounts.entries()) {
      if (data.firstRequest < cutoff) {
        this.requestCounts.delete(key);
      }
    }
  }

  /**
   * Clean up old suspicious activities
   */
  private cleanupSuspiciousActivities(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    this.suspiciousActivities = this.suspiciousActivities.filter(
      activity => activity.timestamp > cutoff
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log request for security monitoring
   */
  private logRequest(context: SecurityContext, additionalContext?: Record<string, unknown>): void {
    this.logger.info('Security middleware request', {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      origin: context.origin,
      timestamp: context.timestamp,
      ...additionalContext,
    });
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): {
    activeConnections: number;
    blockedIPs: number;
    suspiciousActivities: number;
    recentActivities: SuspiciousActivity[];
  } {
    return {
      activeConnections: this.requestCounts.size,
      blockedIPs: this.blockedIPs.size,
      suspiciousActivities: this.suspiciousActivities.length,
      recentActivities: this.suspiciousActivities.slice(-10), // Last 10 activities
    };
  }

  /**
   * Update security configuration
   */
  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Security configuration updated', { config: this.config });
  }

  /**
   * Manually block an IP address
   */
  public blockIP(ipAddress: string, duration: number = 300000): void {
    this.blockedIPs.add(ipAddress);
    setTimeout(() => this.blockedIPs.delete(ipAddress), duration);
    this.logger.warn(`IP address blocked: ${ipAddress} for ${duration}ms`);
  }

  /**
   * Unblock an IP address
   */
  public unblockIP(ipAddress: string): void {
    this.blockedIPs.delete(ipAddress);
    this.logger.info(`IP address unblocked: ${ipAddress}`);
  }
}

// Export singleton instance
export const securityMiddleware = SecurityMiddleware.getInstance();