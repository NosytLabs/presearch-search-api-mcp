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
  maxSize: number;
  maxMemory: number;
  defaultTtl: number;
  cleanupInterval: number;
  enableAnalytics: boolean;
  enableWarming: boolean;
  warmingThreshold: number;
  compressionEnabled: boolean;
  compressionThreshold: number;
}

/**
 * Advanced cache manager with analytics, warming, and smart invalidation
 */
export class CacheManager extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
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
      compressionEnabled: true,
      compressionThreshold: 1024,
      ...config,
    };

    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.config.cleanupInterval,
    );
    logger.info("Cache manager initialized", { config: this.config });
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
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
    this.recordHit();

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl || this.config.defaultTtl;
    const size = this.estimateSize(value);

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
      tags: [],
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
   * Destroy the cache manager and clean up resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.emit("destroy");
    logger.info("Cache manager destroyed");
  }

  /**
   * Get the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
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
    }

    return cleaned;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

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
    }
  }

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
  private recordHit(): void {
    this.stats.hits++;
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
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Update general statistics
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager();
