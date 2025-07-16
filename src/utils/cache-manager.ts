import { EventEmitter } from "events";
import { logger } from "./logger.js";

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
  evictions: number;
  warmingRequests: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  maxMemory: number; // Maximum memory usage in bytes
  defaultTtl: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableAnalytics: boolean;
  enableWarming: boolean;
  warmingThreshold: number; // Percentage of TTL to trigger warming
}

/**
 * Advanced cache manager with analytics, warming, and smart invalidation
 */
export class CacheManager extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    averageAccessTime: 0,
    evictions: 0,
    warmingRequests: 0,
  };
  private accessTimes: number[] = [];
  private cleanupTimer?: NodeJS.Timeout;
  private readonly config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = {
      maxSize: 1000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      defaultTtl: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableAnalytics: true,
      enableWarming: true,
      warmingThreshold: 0.8, // 80% of TTL
      ...config,
    };

    this.startCleanupTimer();
    logger.debug("Cache manager initialized", { config: this.config });
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.recordMiss();
      this.emit("expired", key, entry);
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = now;

    this.recordHit(Date.now() - startTime);

    // Check if warming is needed
    if (this.config.enableWarming && this.shouldWarm(entry)) {
      this.emit("warmingNeeded", key, entry);
      this.stats.warmingRequests++;
    }

    return entry.data;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number, tags: string[] = []): void {
    const now = Date.now();
    const entryTtl = ttl || this.config.defaultTtl;
    const size = this.estimateSize(value);

    // Check memory limits
    if (this.stats.totalSize + size > this.config.maxMemory) {
      this.evictByMemory(size);
    }

    // Check size limits
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      ttl: entryTtl,
      accessCount: 0,
      lastAccessed: now,
      size,
      tags,
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.stats.totalSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.updateStats();

    this.emit("set", key, entry);
    logger.debug("Cache entry set", { key, size, ttl: entryTtl, tags });
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.updateStats();
      this.emit("delete", key, entry);
      return true;
    }
    return false;
  }

  /**
   * Clear cache by tags
   */
  clearByTags(tags: string[]): number {
    let cleared = 0;
    const tagSet = new Set(tags);

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some((tag) => tagSet.has(tag))) {
        this.delete(key);
        cleared++;
      }
    }

    logger.info("Cache cleared by tags", { tags, cleared });
    return cleared;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.totalSize = 0;
    this.updateStats();
    this.emit("clear");
    logger.info("Cache cleared", { entriesCleared: size });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get detailed cache analytics
   */
  getAnalytics() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    return {
      stats: this.getStats(),
      topAccessed: entries
        .sort((a, b) => b[1].accessCount - a[1].accessCount)
        .slice(0, 10)
        .map(([key, entry]) => ({ key, accessCount: entry.accessCount })),
      expiringSoon: entries
        .filter(([, entry]) => entry.timestamp + entry.ttl - now < 60000) // Expiring in 1 minute
        .map(([key, entry]) => ({
          key,
          expiresIn: entry.timestamp + entry.ttl - now,
        })),
      memoryUsage: {
        total: this.stats.totalSize,
        percentage: (this.stats.totalSize / this.config.maxMemory) * 100,
        largest: entries
          .sort((a, b) => b[1].size - a[1].size)
          .slice(0, 5)
          .map(([key, entry]) => ({ key, size: entry.size })),
      },
    };
  }

  /**
   * Warm cache entry (refresh before expiration)
   */
  async warm<T>(
    key: string,
    refreshFn: () => Promise<T>,
    ttl?: number,
  ): Promise<void> {
    try {
      const data = await refreshFn();
      const entry = this.cache.get(key);
      const tags = entry?.tags || [];
      this.set(key, data, ttl, tags);
      this.emit("warmed", key);
      logger.debug("Cache entry warmed", { key });
    } catch (error) {
      logger.error("Cache warming failed", { key, error });
      this.emit("warmingFailed", key, error);
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        cleaned++;
        this.emit("expired", key, entry);
      }
    }

    if (cleaned > 0) {
      this.updateStats();
      logger.debug("Cache cleanup completed", { cleaned });
    }

    return cleaned;
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
    this.removeAllListeners();
    logger.debug("Cache manager destroyed");
  }

  /**
   * Check if entry should be warmed
   */
  private shouldWarm(entry: CacheEntry): boolean {
    const now = Date.now();
    const age = now - entry.timestamp;
    const warmingPoint = entry.ttl * this.config.warmingThreshold;
    return age >= warmingPoint;
  }

  /**
   * Evict entries to free memory
   */
  private evictByMemory(requiredSize: number): void {
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed,
    ); // LRU first

    let freedSize = 0;
    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;

      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.evictions++;
      freedSize += entry.size;
      this.emit("evicted", key, entry, "memory");
    }

    logger.debug("Memory-based eviction completed", {
      freedSize,
      required: requiredSize,
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.stats.totalSize -= entry.size;
      this.stats.evictions++;
      this.emit("evicted", oldestKey, entry, "lru");
      logger.debug("LRU eviction completed", { key: oldestKey });
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size for non-serializable objects
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(accessTime: number): void {
    this.stats.hits++;
    if (this.config.enableAnalytics) {
      this.accessTimes.push(accessTime);
      if (this.accessTimes.length > 1000) {
        this.accessTimes = this.accessTimes.slice(-500); // Keep last 500
      }
    }
    this.updateHitRate();
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * Update hit rate and average access time
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

    if (this.accessTimes.length > 0) {
      this.stats.averageAccessTime =
        this.accessTimes.reduce((sum, time) => sum + time, 0) /
        this.accessTimes.length;
    }
  }

  /**
   * Update general statistics
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager();
