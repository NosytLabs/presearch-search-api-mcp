/**
 * Tests for Rate Limiter
 */

import { RateLimiter } from '../../src/middleware/rate-limiter.js';
import { Configuration } from '../../src/config/configuration.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockConfig: Configuration;

  beforeEach(() => {
    mockConfig = new Configuration({
      rateLimit: {
        requests: 10,
        window: 1000, // 1 second
      },
    });
    
    rateLimiter = new RateLimiter(mockConfig);
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  describe('Constructor', () => {
    it('should create rate limiter with configuration', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiter);
    });

    it('should handle disabled rate limiting', () => {
      const disabledConfig = new Configuration({
        rateLimit: {
          requests: 0, // Disabled
          window: 1000,
        },
      });
      
      const disabledLimiter = new RateLimiter(disabledConfig);
      expect(disabledLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const clientId = 'test-client-1';
      
      // Should allow first request
      const result1 = await rateLimiter.checkLimit(clientId);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result1.resetTime).toBeGreaterThan(Date.now());
      
      // Should allow second request
      const result2 = await rateLimiter.checkLimit(clientId);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8);
    });

    it('should block requests exceeding limit', async () => {
      const clientId = 'test-client-2';
      
      // Use up all allowed requests
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(clientId);
        expect(result.allowed).toBe(true);
      }
      
      // Next request should be blocked
      const blockedResult = await rateLimiter.checkLimit(clientId);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });

    it('should track different clients separately', async () => {
      const client1 = 'test-client-1';
      const client2 = 'test-client-2';
      
      // Use up all requests for client1
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(client1);
      }
      
      // Client1 should be blocked
      const client1Result = await rateLimiter.checkLimit(client1);
      expect(client1Result.allowed).toBe(false);
      
      // Client2 should still be allowed
      const client2Result = await rateLimiter.checkLimit(client2);
      expect(client2Result.allowed).toBe(true);
      expect(client2Result.remaining).toBe(9);
    });

    it('should reset limits after time window', (done) => {
      const shortWindowConfig = new Configuration({
        rateLimit: {
          requests: 2,
          window: 100, // 100ms
        },
      });
      
      const shortWindowLimiter = new RateLimiter(shortWindowConfig);
      const clientId = 'test-client-reset';
      
      // Use up all requests
      shortWindowLimiter.checkLimit(clientId).then((result1) => {
        expect(result1.allowed).toBe(true);
        
        return shortWindowLimiter.checkLimit(clientId);
      }).then((result2) => {
        expect(result2.allowed).toBe(true);
        
        return shortWindowLimiter.checkLimit(clientId);
      }).then((result3) => {
        expect(result3.allowed).toBe(false);
        
        // Wait for window to reset
        setTimeout(() => {
          shortWindowLimiter.checkLimit(clientId).then((resetResult) => {
            expect(resetResult.allowed).toBe(true);
            expect(resetResult.remaining).toBe(1);
            done();
          });
        }, 150); // Wait longer than window
      });
    });
  });

  describe('Sliding Window', () => {
    it('should implement sliding window correctly', (done) => {
      const slidingConfig = new Configuration({
        rateLimit: {
          requests: 3,
          window: 200, // 200ms
        },
      });
      
      const slidingLimiter = new RateLimiter(slidingConfig);
      const clientId = 'sliding-client';
      
      // Make 3 requests quickly
      Promise.all([
        slidingLimiter.checkLimit(clientId),
        slidingLimiter.checkLimit(clientId),
        slidingLimiter.checkLimit(clientId),
      ]).then((results) => {
        expect(results[0].allowed).toBe(true);
        expect(results[1].allowed).toBe(true);
        expect(results[2].allowed).toBe(true);
        
        // 4th request should be blocked
        return slidingLimiter.checkLimit(clientId);
      }).then((result4) => {
        expect(result4.allowed).toBe(false);
        
        // Wait for first request to slide out of window
        setTimeout(() => {
          slidingLimiter.checkLimit(clientId).then((result5) => {
            expect(result5.allowed).toBe(true);
            done();
          });
        }, 100); // Wait for partial window reset
      });
    });
  });

  describe('Disabled Rate Limiting', () => {
    let disabledLimiter: RateLimiter;

    beforeEach(() => {
      const disabledConfig = new Configuration({
        rateLimit: {
          requests: 0, // Disabled
          window: 1000,
        },
      });
      
      disabledLimiter = new RateLimiter(disabledConfig);
    });

    it('should allow unlimited requests when disabled', async () => {
      const clientId = 'unlimited-client';
      
      // Make many requests
      for (let i = 0; i < 100; i++) {
        const result = await disabledLimiter.checkLimit(clientId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(Infinity);
      }
    });

    it('should not track client data when disabled', async () => {
      const clientId = 'no-tracking-client';
      
      await disabledLimiter.checkLimit(clientId);
      
      const stats = disabledLimiter.getStats();
      expect(stats.totalClients).toBe(0);
    });
  });

  describe('Rate Limiter Statistics', () => {
    it('should provide accurate statistics', async () => {
      const client1 = 'stats-client-1';
      const client2 = 'stats-client-2';
      
      // Make some requests
      await rateLimiter.checkLimit(client1);
      await rateLimiter.checkLimit(client1);
      await rateLimiter.checkLimit(client2);
      
      const stats = rateLimiter.getStats();
      
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats.totalClients).toBe(2);
      expect(stats.totalRequests).toBe(3);
      expect(stats.allowedRequests).toBe(3);
      expect(stats.blockedRequests).toBe(0);
    });

    it('should track blocked requests', async () => {
      const clientId = 'blocked-stats-client';
      
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(clientId);
      }
      
      // Make blocked requests
      await rateLimiter.checkLimit(clientId);
      await rateLimiter.checkLimit(clientId);
      
      const stats = rateLimiter.getStats();
      expect(stats.blockedRequests).toBe(2);
      expect(stats.allowedRequests).toBe(10);
      expect(stats.totalRequests).toBe(12);
    });

    it('should provide per-client statistics', async () => {
      const clientId = 'per-client-stats';
      
      await rateLimiter.checkLimit(clientId);
      await rateLimiter.checkLimit(clientId);
      
      const clientStats = rateLimiter.getClientStats(clientId);
      
      expect(clientStats).toHaveProperty('requests');
      expect(clientStats).toHaveProperty('remaining');
      expect(clientStats).toHaveProperty('resetTime');
      expect(clientStats.requests).toBe(2);
      expect(clientStats.remaining).toBe(8);
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired client data', (done) => {
      const shortWindowConfig = new Configuration({
        rateLimit: {
          requests: 5,
          window: 100, // 100ms
        },
      });
      
      const shortWindowLimiter = new RateLimiter(shortWindowConfig);
      const clientId = 'cleanup-client';
      
      shortWindowLimiter.checkLimit(clientId).then(() => {
        let stats = shortWindowLimiter.getStats();
        expect(stats.totalClients).toBe(1);
        
        // Wait for cleanup
        setTimeout(() => {
          // Trigger cleanup by checking stats
          stats = shortWindowLimiter.getStats();
          expect(stats.totalClients).toBe(0);
          done();
        }, 200);
      });
    });

    it('should handle memory pressure with many clients', async () => {
      // Create many clients
      for (let i = 0; i < 1000; i++) {
        await rateLimiter.checkLimit(`client-${i}`);
      }
      
      const stats = rateLimiter.getStats();
      expect(stats.totalClients).toBe(1000);
      
      // Should still function correctly
      const result = await rateLimiter.checkLimit('new-client');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests from same client', async () => {
      const clientId = 'concurrent-client';
      
      // Make concurrent requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(rateLimiter.checkLimit(clientId));
      }
      
      const results = await Promise.all(promises);
      
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;
      
      expect(allowedCount).toBe(10); // Should allow exactly 10
      expect(blockedCount).toBe(5);  // Should block 5
    });

    it('should handle invalid client IDs gracefully', async () => {
      const invalidIds = [null, undefined, '', 0, false, {}];
      
      for (const invalidId of invalidIds) {
        const result = await rateLimiter.checkLimit(invalidId as any);
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('resetTime');
      }
    });

    it('should handle very small time windows', async () => {
      const microWindowConfig = new Configuration({
        rateLimit: {
          requests: 1,
          window: 1, // 1ms
        },
      });
      
      const microWindowLimiter = new RateLimiter(microWindowConfig);
      const clientId = 'micro-window-client';
      
      const result1 = await microWindowLimiter.checkLimit(clientId);
      expect(result1.allowed).toBe(true);
      
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const result2 = await microWindowLimiter.checkLimit(clientId);
      expect(result2.allowed).toBe(true);
    });

    it('should handle very large request limits', async () => {
      const largeConfig = new Configuration({
        rateLimit: {
          requests: 1000000,
          window: 1000,
        },
      });
      
      const largeLimiter = new RateLimiter(largeConfig);
      const clientId = 'large-limit-client';
      
      const result = await largeLimiter.checkLimit(clientId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999999);
    });
  });

  describe('Integration with Search Requests', () => {
    it('should rate limit search requests by API key', async () => {
      const apiKey1 = 'api-key-1';
      const apiKey2 = 'api-key-2';
      
      // Use up limit for apiKey1
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(apiKey1);
        expect(result.allowed).toBe(true);
      }
      
      // apiKey1 should be blocked
      const blocked = await rateLimiter.checkLimit(apiKey1);
      expect(blocked.allowed).toBe(false);
      
      // apiKey2 should still work
      const allowed = await rateLimiter.checkLimit(apiKey2);
      expect(allowed.allowed).toBe(true);
    });

    it('should provide retry-after information', async () => {
      const clientId = 'retry-after-client';
      
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(clientId);
      }
      
      const blocked = await rateLimiter.checkLimit(clientId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(1000); // Should be within window
    });
  });

  describe('Configuration Updates', () => {
    it('should handle configuration updates', () => {
      const newConfig = new Configuration({
        rateLimit: {
          requests: 20,
          window: 2000,
        },
      });
      
      expect(() => {
        rateLimiter = new RateLimiter(newConfig);
      }).not.toThrow();
    });

    it('should reset state when requested', async () => {
      const clientId = 'reset-client';
      
      // Make some requests
      await rateLimiter.checkLimit(clientId);
      await rateLimiter.checkLimit(clientId);
      
      let stats = rateLimiter.getStats();
      expect(stats.totalRequests).toBe(2);
      
      // Reset state
      rateLimiter.reset();
      
      stats = rateLimiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalClients).toBe(0);
      
      // Should work normally after reset
      const result = await rateLimiter.checkLimit(clientId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });
});