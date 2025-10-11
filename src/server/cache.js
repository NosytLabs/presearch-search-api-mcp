const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

export const getCacheKey = (params) => {
    return JSON.stringify(params);
};

export const getCachedResult = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        cache.delete(key); // Remove expired entry
    }
    return null;
};

export const setCachedResult = (key, data) => {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
};

export const getCacheStats = () => {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp < CACHE_TTL) {
            validEntries++;
        } else {
            expiredEntries++;
            cache.delete(key);
        }
    }

    return {
        totalEntries: cache.size,
        validEntries,
        expiredEntries,
        hitRate: 'N/A (no hit tracking yet)'
    };
};

export const clearCache = () => {
    const size = cache.size;
    cache.clear();
    return { clearedEntries: size };
};
