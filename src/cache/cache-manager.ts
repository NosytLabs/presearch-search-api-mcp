import { Configuration } from '../config/configuration.js';
import { logger } from '../utils/logger.js';
import { PresearchResponse } from '../types/presearch-types.js';
import { EventEmitter } from 'events';

/**
 * Cache eviction strategies
 */
enum EvictionStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  TTL = 'ttl',
}

/**
 * Cache priority levels
 */
enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Represents a single cache entry with data and metadata
 */
interface CacheEntry {
  /** The cached search response data */
  data: PresearchResponse;
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Last access timestamp for LRU */
  lastAccessed: number;
  /** Access count for LFU */
  accessCount: number;
  /** Cache priority level */
  priority: CachePriority;
  /** Estimated memory size in bytes */
  memorySize: number;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Cache performance statistics and metadata
 */
interface CacheStats {
  /** Current number of entries in cache */
  size: number;
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Hit rate as a percentage (0-1) */
  hitRate: number;
  /** Key of the oldest cache entry */
  oldestEntry?: string;
  /** Key of the newest cache entry */
  newestEntry?: string;
  /** Total memory usage in bytes */
  memoryUsage: number;
  /** Memory usage percentage */
  memoryUsagePercent: number;
  /** Average access time in milliseconds */
  averageAccessTime: number;
  /** Number of evictions */
  evictions: number;
  /** Cache efficiency score (0-1) */
  efficiency: number;
  /** Distribution by priority */
  priorityDistribution: Record<CachePriority, number>;
  /** Distribution by tags */
  tagDistribution: Record<string, number>;
}

/**
 * Cache configuration options
 */
interface CacheConfig {
  /** Maximum number of entries */
  maxSize: number;
  /** Maximum memory usage in bytes */
  maxMemory: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Eviction strategy */
  evictionStrategy: EvictionStrategy;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable cache warming */
  enableWarming: boolean;
  /** Memory pressure threshold (0-1) */
  memoryPressureThreshold: number;
}

/**
 * Cache warming configuration
 */
interface WarmingConfig {
  /** Popular queries to pre-cache */
  popularQueries: string[];
  /** Warming interval in milliseconds */
  interval: number;
  /** Maximum concurrent warming requests */
  maxConcurrent: number;
}

/**
 * Intelligent in-memory cache for search results with advanced features
 *
 * This class provides a sophisticated cache manager with:
 *
 * Features:
 * - Multiple eviction strategies (LRU, LFU, FIFO, TTL)
 * - Memory management and pressure handling
 * - Cache warming and pre-loading
 * - Priority-based caching
 * - Tag-based categorization
 * - Comprehensive statistics and monitoring
 * - Event-driven architecture
 * - Automatic cleanup and optimization
 *
 * @example
 * ```typescript
 * const cache = CacheManager.getInstance();
 * cache.set('search:query', searchResults, {
 *   ttl: 300000,
 *   priority: CachePriority.HIGH,
 *   tags: ['search', 'popular']
 * });
 * const cached = cache.get('search:query');
 * ```
 *
 * @version 3.0.0
 * @since 1.0.0
 */
export class CacheManager extends EventEmitter {
  /** Singleton instance of the cache manager */
  private static instance: CacheManager;

  /** Internal cache storage using Map for O(1) operations */
  private cache = new Map<string, CacheEntry>();

  /** Cache configuration */
  private config: CacheConfig;

  /** Cache performance statistics */
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };

  /** Current memory usage in bytes */
  private currentMemoryUsage = 0;

  /** Interval timer for automatic cleanup */
  private cleanupInterval: NodeJS.Timeout;

  /** Interval timer for cache warming */
  private warmingInterval?: NodeJS.Timeout;

  /**
   * Stop all cache intervals and cleanup resources
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }
    this.cache.clear();
    this.accessOrder.clear();
    logger.info('CacheManager stopped and resources cleared');
  }

  /** Cache warming configuration */
  private warmingConfig?: WarmingConfig;

  /** LRU access order tracking */
  private accessOrder = new Set<string>();

  /**
   * Constructor for singleton pattern
   *
   * Initializes the cache with configuration from the config module
   * and starts the automatic cleanup interval.
   */
  constructor() {
    super();

    // Initialize configuration with defaults
    this.config = {
      maxSize: 1000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      defaultTTL: new Configuration().getCacheTTL(),
      evictionStrategy: EvictionStrategy.LRU,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableWarming: false,
      memoryPressureThreshold: 0.8,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Set up event listeners
    this.setupEventListeners();

    logger.debug('Enhanced cache manager initialized', {
      config: this.config,
      cleanupInterval: `${this.config.cleanupInterval / 1000}s`,
    });
  }

  /**
   * Get the singleton instance of the cache manager
   *
   * Creates a new instance if one doesn't exist, otherwise returns the existing instance.
   * This ensures consistent cache state across the application.
   *
   * @static
   * @returns {CacheManager} The singleton cache manager instance
   *
   * @example
   * ```typescript
   * const cache = CacheManager.getInstance();
   * ```
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Store data in cache with enhanced options
   *
   * Stores a search response in the cache with comprehensive configuration options.
   * Handles memory management, eviction, and priority-based storage.
   *
   * @param {string} key - Unique cache key for the entry
   * @param {PresearchResponse} data - Search response data to cache
   * @param {object} options - Cache options
   * @param {number} [options.ttl] - Time-to-live in milliseconds
   * @param {CachePriority} [options.priority] - Cache priority level
   * @param {string[]} [options.tags] - Tags for categorization
   *
   * @example
   * ```typescript
   * cache.set('search:ai', searchResults, {
   *   ttl: 300000,
   *   priority: CachePriority.HIGH,
   *   tags: ['search', 'popular']
   * });
   * ```
   */
  public set(
    key: string,
    data: PresearchResponse,
    options: {
      ttl?: number;
      priority?: CachePriority;
      tags?: string[];
    } = {}
  ): void {
    const { ttl = this.config.defaultTTL, priority = CachePriority.NORMAL, tags = [] } = options;

    const memorySize = this.estimateMemorySize(data);

    // Check memory pressure and evict if necessary
    this.handleMemoryPressure(memorySize);

    const now = Date.now();
    const entry: CacheEntry = {
      data,
      timestamp: now,
      ttl,
      lastAccessed: now,
      accessCount: 0,
      priority,
      memorySize,
      tags,
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentMemoryUsage -= oldEntry.memorySize;
      this.accessOrder.delete(key);
    }

    this.cache.set(key, entry);
    this.currentMemoryUsage += memorySize;
    this.accessOrder.add(key);

    // Emit cache event
    this.emit('set', { key: this.sanitizeKey(key), size: memorySize, priority, tags });

    logger.debug('Enhanced cache entry stored', {
      key: this.sanitizeKey(key),
      ttl,
      priority,
      tags,
      memorySize,
      totalMemory: this.currentMemoryUsage,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Legacy set method for backward compatibility
   */
  public setLegacy(
    key: string,
    data: PresearchResponse,
    ttl: number = this.config.defaultTTL
  ): void {
    this.set(key, data, { ttl });
  }

  /**
   * Retrieve data from cache with enhanced tracking
   *
   * Attempts to retrieve cached data by key with comprehensive access tracking.
   * Updates LRU order, access counts, and performance metrics.
   *
   * @param {string} key - Cache key to retrieve
   * @returns {PresearchResponse | null} Cached data or null if not found/expired
   *
   * @example
   * ```typescript
   * const cached = cache.get('search:ai');
   * if (cached) {
   *   console.log('Cache hit!');
   * } else {
   *   console.log('Cache miss - need to fetch data');
   * }
   * ```
   */
  public get(key: string): PresearchResponse | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateAccessTime(startTime);
      this.emit('miss', { key: this.sanitizeKey(key) });

      logger.debug('Cache miss', {
        key: this.sanitizeKey(key),
        totalMisses: this.stats.misses,
      });
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.currentMemoryUsage -= entry.memorySize;
      this.accessOrder.delete(key);
      this.stats.misses++;
      this.updateAccessTime(startTime);
      this.emit('expired', { key: this.sanitizeKey(key), age: now - entry.timestamp });

      logger.debug('Cache entry expired', {
        key: this.sanitizeKey(key),
        age: now - entry.timestamp,
        ttl: entry.ttl,
      });
      return null;
    }

    // Update access tracking
    entry.lastAccessed = now;
    entry.accessCount++;

    // Update LRU order
    this.accessOrder.delete(key);
    this.accessOrder.add(key);

    this.stats.hits++;
    this.updateAccessTime(startTime);
    this.emit('hit', {
      key: this.sanitizeKey(key),
      age: now - entry.timestamp,
      accessCount: entry.accessCount,
    });

    logger.debug('Cache hit', {
      key: this.sanitizeKey(key),
      age: now - entry.timestamp,
      accessCount: entry.accessCount,
      totalHits: this.stats.hits,
    });

    return entry.data;
  }

  /**
   * Check if key exists in cache and is not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.currentMemoryUsage -= entry.memorySize;
      this.accessOrder.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set up event listeners for cache monitoring
   */
  private setupEventListeners(): void {
    this.on('memoryPressure', data => {
      logger.warn('Cache memory pressure detected', data);
    });

    this.on('eviction', data => {
      logger.debug('Cache entry evicted', data);
    });

    this.on('warming', data => {
      logger.debug('Cache warming event', data);
    });
  }

  /**
   * Estimate memory size of cache entry
   */
  private estimateMemorySize(data: PresearchResponse): number {
    try {
      const jsonString = JSON.stringify(data);
      // Rough estimation: 2 bytes per character + overhead
      return jsonString.length * 2 + 100;
    } catch {
      // Fallback estimation
      return 1024; // 1KB default
    }
  }

  /**
   * Handle memory pressure by evicting entries
   */
  private handleMemoryPressure(newEntrySize: number): void {
    const projectedUsage = this.currentMemoryUsage + newEntrySize;
    const memoryPressure = projectedUsage / this.config.maxMemory;

    if (memoryPressure > this.config.memoryPressureThreshold) {
      this.emit('memoryPressure', {
        current: this.currentMemoryUsage,
        projected: projectedUsage,
        threshold: this.config.maxMemory * this.config.memoryPressureThreshold,
        pressure: memoryPressure,
      });

      this.evictEntries(newEntrySize);
    }

    // Also check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictEntries(0, 1);
    }
  }

  /**
   * Evict entries based on strategy
   */
  private evictEntries(requiredSpace: number, minEvictions: number = 0): void {
    let evicted = 0;
    let freedSpace = 0;

    const entries = Array.from(this.cache.entries());

    // Sort entries based on eviction strategy
    const sortedEntries = this.sortEntriesForEviction(entries);

    for (const [key, entry] of sortedEntries) {
      if (freedSpace >= requiredSpace && evicted >= minEvictions) {
        break;
      }

      this.cache.delete(key);
      this.currentMemoryUsage -= entry.memorySize;
      this.accessOrder.delete(key);
      freedSpace += entry.memorySize;
      evicted++;
      this.stats.evictions++;

      this.emit('eviction', {
        key: this.sanitizeKey(key),
        reason: this.config.evictionStrategy,
        memoryFreed: entry.memorySize,
        priority: entry.priority,
      });
    }

    logger.debug('Cache eviction completed', {
      evicted,
      freedSpace,
      remainingEntries: this.cache.size,
      memoryUsage: this.currentMemoryUsage,
    });
  }

  /**
   * Sort entries for eviction based on strategy
   */
  private sortEntriesForEviction(entries: [string, CacheEntry][]): [string, CacheEntry][] {
    switch (this.config.evictionStrategy) {
      case EvictionStrategy.LRU:
        return entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      case EvictionStrategy.LFU:
        return entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

      case EvictionStrategy.FIFO:
        return entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      case EvictionStrategy.TTL:
        return entries.sort((a, b) => {
          const aExpiry = a[1].timestamp + a[1].ttl;
          const bExpiry = b[1].timestamp + b[1].ttl;
          return aExpiry - bExpiry;
        });

      default:
        // Priority-based eviction (evict lower priority first)
        return entries.sort((a, b) => a[1].priority - b[1].priority);
    }
  }

  /**
   * Update access time statistics
   */
  private updateAccessTime(startTime: number): void {
    const accessTime = Date.now() - startTime;
    this.stats.totalAccessTime += accessTime;
    this.stats.accessCount++;
  }

  /**
   * Delete specific cache entry
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);

    if (deleted && entry) {
      this.currentMemoryUsage -= entry.memorySize;
      this.accessOrder.delete(key);

      this.emit('delete', {
        key: this.sanitizeKey(key),
        memoryFreed: entry.memorySize,
      });

      logger.debug('Cache entry deleted', {
        key: this.sanitizeKey(key),
        memoryFreed: entry.memorySize,
        cacheSize: this.cache.size,
      });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  public clear(): number {
    const previousSize = this.cache.size;
    const previousMemory = this.currentMemoryUsage;

    this.cache.clear();
    this.accessOrder.clear();
    this.currentMemoryUsage = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.totalAccessTime = 0;
    this.stats.accessCount = 0;

    this.emit('clear', {
      entriesCleared: previousSize,
      memoryFreed: previousMemory,
    });

    logger.info('Cache cleared', {
      previousSize,
      previousMemory,
      currentSize: this.cache.size,
    });

    return previousSize;
  }

  /**
   * Delete cache entries matching a pattern
   */
  public deleteByPattern(pattern: string): number {
    let deletedCount = 0;
    let memoryFreed = 0;
    const regex = new RegExp(pattern, 'i');

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.currentMemoryUsage -= entry.memorySize;
        this.accessOrder.delete(key);
        memoryFreed += entry.memorySize;
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.emit('patternDelete', {
        pattern,
        deletedCount,
        memoryFreed,
      });

      logger.debug('Cache entries deleted by pattern', {
        pattern,
        deletedCount,
        memoryFreed,
        remainingSize: this.cache.size,
      });
    }

    return deletedCount;
  }

  /**
   * Delete cache entries by tags
   */
  public deleteByTags(tags: string[]): number {
    let deletedCount = 0;
    let memoryFreed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        this.cache.delete(key);
        this.currentMemoryUsage -= entry.memorySize;
        this.accessOrder.delete(key);
        memoryFreed += entry.memorySize;
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.emit('tagDelete', {
        tags,
        deletedCount,
        memoryFreed,
      });

      logger.debug('Cache entries deleted by tags', {
        tags,
        deletedCount,
        memoryFreed,
        remainingSize: this.cache.size,
      });
    }

    return deletedCount;
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get comprehensive cache statistics
   */
  public getStats(): CacheStats {
    const entries = Array.from(this.cache.entries());
    const timestamps = entries.map(([, entry]) => entry.timestamp);

    const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const averageAccessTime =
      this.stats.accessCount > 0 ? this.stats.totalAccessTime / this.stats.accessCount : 0;

    // Calculate memory usage percentage
    const memoryUsagePercent =
      this.config.maxMemory > 0 ? this.currentMemoryUsage / this.config.maxMemory : 0;

    // Calculate efficiency (hit rate weighted by access speed)
    const efficiency = hitRate * (1 - Math.min(averageAccessTime / 100, 1));

    // Calculate priority distribution
    const priorityDistribution: Record<CachePriority, number> = {
      [CachePriority.LOW]: 0,
      [CachePriority.NORMAL]: 0,
      [CachePriority.HIGH]: 0,
      [CachePriority.CRITICAL]: 0,
    };

    // Calculate tag distribution
    const tagDistribution: Record<string, number> = {};

    for (const [, entry] of entries) {
      priorityDistribution[entry.priority]++;

      for (const tag of entry.tags) {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      }
    }

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp).toISOString() : undefined,
      newestEntry: newestTimestamp ? new Date(newestTimestamp).toISOString() : undefined,
      memoryUsage: this.currentMemoryUsage,
      memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      averageAccessTime: Math.round(averageAccessTime * 100) / 100,
      evictions: this.stats.evictions,
      efficiency: Math.round(efficiency * 100) / 100,
      priorityDistribution,
      tagDistribution,
    };
  }

  /**
   * Clean up expired entries with enhanced tracking
   */
  public cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    let memoryFreed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.currentMemoryUsage -= entry.memorySize;
        this.accessOrder.delete(key);
        memoryFreed += entry.memorySize;
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.emit('cleanup', {
        removedEntries: removedCount,
        memoryFreed,
        remainingEntries: this.cache.size,
      });

      logger.debug('Cache cleanup completed', {
        removedEntries: removedCount,
        memoryFreed,
        remainingEntries: this.cache.size,
        memoryUsage: this.currentMemoryUsage,
      });
    }
  }

  /**
   * Configure cache settings
   */
  public configure(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart cleanup interval if changed
    if (newConfig.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }

    this.emit('configure', { config: this.config });

    logger.info('Cache configuration updated', {
      config: this.config,
    });
  }

  /**
   * Enable cache warming with popular queries
   */
  public enableWarming(
    config: WarmingConfig,
    searchFunction: (query: string) => Promise<PresearchResponse>
  ): void {
    this.warmingConfig = config;

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.warmingInterval = setInterval(async () => {
      await this.performWarming(searchFunction);
    }, config.interval);

    this.emit('warmingEnabled', { config });

    logger.info('Cache warming enabled', {
      popularQueries: config.popularQueries.length,
      interval: config.interval,
      maxConcurrent: config.maxConcurrent,
    });
  }

  /**
   * Disable cache warming
   */
  public disableWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = undefined;
    }

    this.warmingConfig = undefined;
    this.emit('warmingDisabled');

    logger.info('Cache warming disabled');
  }

  /**
   * Perform cache warming
   */
  private async performWarming(
    searchFunction: (query: string) => Promise<PresearchResponse>
  ): Promise<void> {
    if (!this.warmingConfig) return;

    const { popularQueries, maxConcurrent } = this.warmingConfig;
    const queriesToWarm = popularQueries.filter(query => {
      const key = this.generateKey({ q: query });
      return !this.has(key);
    });

    if (queriesToWarm.length === 0) return;

    this.emit('warming', {
      totalQueries: queriesToWarm.length,
      maxConcurrent,
    });

    // Process queries in batches
    for (let i = 0; i < queriesToWarm.length; i += maxConcurrent) {
      const batch = queriesToWarm.slice(i, i + maxConcurrent);

      const promises = batch.map(async query => {
        try {
          const result = await searchFunction(query);
          const key = this.generateKey({ q: query });

          this.set(key, result, {
            ttl: this.config.defaultTTL,
            priority: CachePriority.LOW,
            tags: ['warmed', 'popular'],
          });

          return { query, success: true };
        } catch (error) {
          logger.warn('Cache warming failed for query', {
            query,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return { query, success: false, error };
        }
      });

      await Promise.allSettled(promises);
    }

    logger.debug('Cache warming completed', {
      warmedQueries: queriesToWarm.length,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Generate cache key from search parameters
   */
  public generateKey(params: Record<string, unknown>): string {
    // Normalize parameters for consistent caching
    const normalized = {
      query: typeof params.q === 'string' ? params.q.toLowerCase().trim() : undefined,
      page: params.page || 1,
      lang: params.lang,
      time: params.time,
      safe: params.safe,
      location: params.location,
      ip: params.ip,
    };

    // Remove undefined values
    const filtered = Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== undefined)
    );

    return JSON.stringify(filtered);
  }

  /**
   * Sanitize cache key for logging (remove sensitive information)
   */
  private sanitizeKey(key: string): string {
    try {
      const parsed = JSON.parse(key);
      const sanitized = { ...parsed };

      // Remove or mask sensitive information
      if (sanitized.ip) {
        sanitized.ip = '[IP_REDACTED]';
      }

      return JSON.stringify(sanitized);
    } catch {
      return '[INVALID_KEY]';
    }
  }

  /**
   * Cleanup resources and destroy cache manager
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    const stats = this.getStats();
    this.clear();
    this.removeAllListeners();

    this.emit('destroy', { finalStats: stats });

    logger.info('Enhanced cache manager destroyed', {
      finalStats: stats,
    });
  }

  /**
   * Get cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Get warming configuration
   */
  public getWarmingConfig(): WarmingConfig | undefined {
    return this.warmingConfig ? { ...this.warmingConfig } : undefined;
  }

  /**
   * Force eviction of entries
   */
  public forceEviction(count: number): number {
    const entries = Array.from(this.cache.entries());
    const sortedEntries = this.sortEntriesForEviction(entries);

    let evicted = 0;
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      const [key, entry] = sortedEntries[i];
      this.cache.delete(key);
      this.currentMemoryUsage -= entry.memorySize;
      this.accessOrder.delete(key);
      this.stats.evictions++;
      evicted++;

      this.emit('forceEviction', {
        key: this.sanitizeKey(key),
        reason: 'manual',
        memoryFreed: entry.memorySize,
      });
    }

    logger.debug('Force eviction completed', {
      evicted,
      remainingEntries: this.cache.size,
    });

    return evicted;
  }

  /**
   * Get entries by priority
   */
  public getEntriesByPriority(priority: CachePriority): string[] {
    const keys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.priority === priority) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Get entries by tags
   */
  public getEntriesByTags(tags: string[]): string[] {
    const keys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        keys.push(key);
      }
    }

    return keys;
  }
}

// Export enums and interfaces
export { EvictionStrategy, CachePriority };
export type { CacheConfig, WarmingConfig, CacheStats };

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
