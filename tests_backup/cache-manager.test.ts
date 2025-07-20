import { CacheManager, cacheManager } from '../src/utils/cache-manager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 100, defaultTtl: 3600 });
  });

  afterEach(() => {
    cache.clear();
  });

  afterAll(() => {
    cacheManager.clear();
  });

  test('should set and get cache entry', () => {
    cache.set('key1', 'value1');
    const value = cache.get('key1');
    expect(value).toBe('value1');
  });

  test('should delete cache entry', () => {
    cache.set('key2', 'value2');
    cache.delete('key2');
    const value = cache.get('key2');
    expect(value).toBeUndefined();
  });

  test('should clear cache', () => {
    cache.set('key3', 'value3');
    cache.clear();
    const value = cache.get('key3');
    expect(value).toBeUndefined();
  });

  test('should evict least recently used when max size reached', () => {
    cache = new CacheManager({ maxSize: 2, defaultTtl: 3600 });
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    const value1 = cache.get('key1');
    expect(value1).toBeUndefined();
    const value3 = cache.get('key3');
    expect(value3).toBe('value3');
  });
});