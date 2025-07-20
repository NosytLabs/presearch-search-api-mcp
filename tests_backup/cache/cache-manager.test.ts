/**
 * Tests for Cache Manager
 */

import { CacheManager } from '../../src/cache/cache-manager.js';
import { Configuration } from '../../src/config/configuration.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockConfig: Configuration;

  beforeEach(() => {
    mockConfig = new Configuration({
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes
        maxSize: 100,
      },
    });
    
    cacheManager = new CacheManager(mockConfig);
  });

  afterEach(() => {
    cacheManager.clear();
  });

  describe('Constructor', () => {
    it('should create cache manager with configuration', () => {
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });

    it('should handle disabled cache configuration', () => {
      const disabledConfig = new Configuration({
        cache: {
          enabled: false,
          ttl: 300,
          maxSize: 100,
        },
      });
      
      const disabledCacheManager = new CacheManager(disabledConfig);
      expect(disabledCacheManager).toBeInstanceOf(CacheManager);
    });
  });

  describe('Basic Cache Operations', () => {
    const testKey = 'test-key';
    const testValue = { data: 'test-value', timestamp: Date.now() };

    it('should set and get cache values', () => {
      cacheManager.set(testKey, testValue);
      const retrieved = cacheManager.get(testKey);
      
      expect(retrieved).toEqual(testValue);
    });

    it('should return undefined for non-existent keys', () => {
      const retrieved = cacheManager.get('non-existent-key');
      expect(retrieved).toBeUndefined();
    });

    it('should check if key exists', () => {
      expect(cacheManager.has(testKey)).toBe(false);
      
      cacheManager.set(testKey, testValue);
      expect(cacheManager.has(testKey)).toBe(true);
    });

    it('should delete cache entries', () => {
      cacheManager.set(testKey, testValue);
      expect(cacheManager.has(testKey)).toBe(true);
      
      const deleted = cacheManager.delete(testKey);
      expect(deleted).toBe(true);
      expect(cacheManager.has(testKey)).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cacheManager.delete('non-existent-key');
      expect(deleted).toBe(false);
    });

    it('should clear all cache entries', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      cacheManager.set('key3', 'value3');
      
      expect(cacheManager.size()).toBe(3);
      
      cacheManager.clear();
      expect(cacheManager.size()).toBe(0);
    });

    it('should return correct cache size', () => {
      expect(cacheManager.size()).toBe(0);
      
      cacheManager.set('key1', 'value1');
      expect(cacheManager.size()).toBe(1);
      
      cacheManager.set('key2', 'value2');
      expect(cacheManager.size()).toBe(2);
      
      cacheManager.delete('key1');
      expect(cacheManager.size()).toBe(1);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', (done) => {
      const shortTtlConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 0.1, // 100ms
          maxSize: 100,
        },
      });
      
      const shortTtlCache = new CacheManager(shortTtlConfig);
      const testKey = 'expiring-key';
      const testValue = 'expiring-value';
      
      shortTtlCache.set(testKey, testValue);
      expect(shortTtlCache.get(testKey)).toBe(testValue);
      
      setTimeout(() => {
        expect(shortTtlCache.get(testKey)).toBeUndefined();
        expect(shortTtlCache.has(testKey)).toBe(false);
        done();
      }, 150); // Wait longer than TTL
    });

    it('should not expire entries before TTL', (done) => {
      const longTtlConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 1, // 1 second
          maxSize: 100,
        },
      });
      
      const longTtlCache = new CacheManager(longTtlConfig);
      const testKey = 'non-expiring-key';
      const testValue = 'non-expiring-value';
      
      longTtlCache.set(testKey, testValue);
      
      setTimeout(() => {
        expect(longTtlCache.get(testKey)).toBe(testValue);
        expect(longTtlCache.has(testKey)).toBe(true);
        done();
      }, 100); // Wait less than TTL
    });

    it('should handle zero TTL (immediate expiration)', () => {
      const zeroTtlConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 0,
          maxSize: 100,
        },
      });
      
      const zeroTtlCache = new CacheManager(zeroTtlConfig);
      const testKey = 'immediate-expire-key';
      const testValue = 'immediate-expire-value';
      
      zeroTtlCache.set(testKey, testValue);
      
      // Should be immediately expired
      expect(zeroTtlCache.get(testKey)).toBeUndefined();
    });
  });

  describe('Max Size Limits', () => {
    it('should respect maximum cache size', () => {
      const smallCacheConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 300,
          maxSize: 3,
        },
      });
      
      const smallCache = new CacheManager(smallCacheConfig);
      
      // Fill cache to max size
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      
      expect(smallCache.size()).toBe(3);
      
      // Adding one more should evict the oldest
      smallCache.set('key4', 'value4');
      
      expect(smallCache.size()).toBe(3);
      expect(smallCache.has('key1')).toBe(false); // Oldest should be evicted
      expect(smallCache.has('key4')).toBe(true); // Newest should be present
    });

    it('should use LRU eviction policy', () => {
      const smallCacheConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 300,
          maxSize: 3,
        },
      });
      
      const smallCache = new CacheManager(smallCacheConfig);
      
      // Fill cache
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      
      // Access key1 to make it recently used
      smallCache.get('key1');
      
      // Add new key, should evict key2 (least recently used)
      smallCache.set('key4', 'value4');
      
      expect(smallCache.has('key1')).toBe(true); // Recently accessed
      expect(smallCache.has('key2')).toBe(false); // Should be evicted
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });
  });

  describe('Disabled Cache', () => {
    let disabledCache: CacheManager;

    beforeEach(() => {
      const disabledConfig = new Configuration({
        cache: {
          enabled: false,
          ttl: 300,
          maxSize: 100,
        },
      });
      
      disabledCache = new CacheManager(disabledConfig);
    });

    it('should not store values when disabled', () => {
      disabledCache.set('key', 'value');
      expect(disabledCache.get('key')).toBeUndefined();
      expect(disabledCache.has('key')).toBe(false);
      expect(disabledCache.size()).toBe(0);
    });

    it('should handle all operations gracefully when disabled', () => {
      expect(() => {
        disabledCache.set('key', 'value');
        disabledCache.get('key');
        disabledCache.has('key');
        disabledCache.delete('key');
        disabledCache.clear();
        disabledCache.size();
      }).not.toThrow();
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', () => {
      const stats = cacheManager.getStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('enabled');
    });

    it('should track cache hits and misses', () => {
      const testKey = 'stats-key';
      const testValue = 'stats-value';
      
      // Initial stats
      let stats = cacheManager.getStats();
      const initialHits = stats.hits;
      const initialMisses = stats.misses;
      
      // Cache miss
      cacheManager.get(testKey);
      stats = cacheManager.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
      
      // Cache set and hit
      cacheManager.set(testKey, testValue);
      cacheManager.get(testKey);
      stats = cacheManager.getStats();
      expect(stats.hits).toBe(initialHits + 1);
    });

    it('should calculate hit rate correctly', () => {
      const testKey = 'hit-rate-key';
      const testValue = 'hit-rate-value';
      
      cacheManager.set(testKey, testValue);
      
      // 2 hits, 1 miss
      cacheManager.get(testKey); // hit
      cacheManager.get(testKey); // hit
      cacheManager.get('non-existent'); // miss
      
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBeCloseTo(0.67, 2); // 2/3 ≈ 0.67
    });
  });

  describe('Search Result Caching', () => {
    const mockSearchRequest = {
      query: 'test search',
      page: 1,
      resultsPerPage: 10,
    };
    
    const mockSearchResponse = {
      results: [
        {
          title: 'Test Result',
          url: 'https://example.com',
          description: 'Test description',
          displayUrl: 'example.com',
        },
      ],
      totalResults: 1,
      page: 1,
      resultsPerPage: 10,
    };

    it('should cache search results', () => {
      const cacheKey = cacheManager.generateSearchCacheKey(mockSearchRequest);
      
      cacheManager.set(cacheKey, mockSearchResponse);
      const cached = cacheManager.get(cacheKey);
      
      expect(cached).toEqual(mockSearchResponse);
    });

    it('should generate consistent cache keys for same search', () => {
      const key1 = cacheManager.generateSearchCacheKey(mockSearchRequest);
      const key2 = cacheManager.generateSearchCacheKey(mockSearchRequest);
      
      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different searches', () => {
      const request1 = { ...mockSearchRequest, query: 'search 1' };
      const request2 = { ...mockSearchRequest, query: 'search 2' };
      
      const key1 = cacheManager.generateSearchCacheKey(request1);
      const key2 = cacheManager.generateSearchCacheKey(request2);
      
      expect(key1).not.toBe(key2);
    });

    it('should include all search parameters in cache key', () => {
      const basicRequest = { query: 'test' };
      const detailedRequest = {
        query: 'test',
        page: 2,
        resultsPerPage: 20,
        lang: 'en-US',
        time: 'week' as const,
      };
      
      const basicKey = cacheManager.generateSearchCacheKey(basicRequest);
      const detailedKey = cacheManager.generateSearchCacheKey(detailedRequest);
      
      expect(basicKey).not.toBe(detailedKey);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid cache operations gracefully', () => {
      expect(() => {
        cacheManager.set(null as any, 'value');
        cacheManager.get(null as any);
        cacheManager.has(null as any);
        cacheManager.delete(null as any);
      }).not.toThrow();
    });

    it('should handle circular references in cached objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      expect(() => {
        cacheManager.set('circular', circularObj);
        cacheManager.get('circular');
      }).not.toThrow();
    });

    it('should handle very large cache values', () => {
      const largeValue = 'x'.repeat(1000000); // 1MB string
      
      expect(() => {
        cacheManager.set('large', largeValue);
        const retrieved = cacheManager.get('large');
        expect(retrieved).toBe(largeValue);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired entries automatically', (done) => {
      const autoCleanConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 0.1, // 100ms
          maxSize: 100,
        },
      });
      
      const autoCleanCache = new CacheManager(autoCleanConfig);
      
      // Add multiple entries
      for (let i = 0; i < 10; i++) {
        autoCleanCache.set(`key${i}`, `value${i}`);
      }
      
      expect(autoCleanCache.size()).toBe(10);
      
      setTimeout(() => {
        // Trigger cleanup by accessing cache
        autoCleanCache.get('any-key');
        
        // All entries should be expired and cleaned up
        expect(autoCleanCache.size()).toBe(0);
        done();
      }, 200);
    });

    it('should handle memory pressure gracefully', () => {
      const pressureConfig = new Configuration({
        cache: {
          enabled: true,
          ttl: 300,
          maxSize: 10,
        },
      });
      
      const pressureCache = new CacheManager(pressureConfig);
      
      // Add many entries to trigger eviction
      for (let i = 0; i < 50; i++) {
        pressureCache.set(`key${i}`, `value${i}`);
      }
      
      // Should never exceed max size
      expect(pressureCache.size()).toBeLessThanOrEqual(10);
      
      // Should still be functional
      pressureCache.set('test', 'value');
      expect(pressureCache.get('test')).toBe('value');
    });
  });
});