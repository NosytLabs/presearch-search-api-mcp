import { CacheManager, cacheManager } from '../src/utils/cache-manager';
describe('CacheManager', () => {
    let cache;
    beforeEach(() => {
        cache = new CacheManager({ maxSize: 100, defaultTtl: 3600 });
    });
    afterEach(() => {
        cache.destroy();
    });
    afterAll(() => {
        cacheManager.destroy();
    });
    test('should set and get cache entry', async () => {
        await cache.set('key1', 'value1');
        const value = await cache.get('key1');
        expect(value).toBe('value1');
    });
    test('should delete cache entry', async () => {
        await cache.set('key2', 'value2');
        await cache.delete('key2');
        const value = await cache.get('key2');
        expect(value).toBeUndefined();
    });
    test('should clear cache', async () => {
        await cache.set('key3', 'value3');
        await cache.clear();
        const value = await cache.get('key3');
        expect(value).toBeUndefined();
    });
    test('should evict least recently used when max size reached', async () => {
        cache = new CacheManager({ maxSize: 2, defaultTtl: 3600 });
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');
        const value1 = await cache.get('key1');
        expect(value1).toBeUndefined();
        const value3 = await cache.get('key3');
        expect(value3).toBe('value3');
    });
});
//# sourceMappingURL=cache-manager.test.js.map