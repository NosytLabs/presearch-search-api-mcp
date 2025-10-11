export const createCacheStatsTool = (dependencies) => {
    const { getCacheStats, logger } = dependencies;

    return {
        name: "cache_stats",
        schema: {},
        handler: async () => {
            const stats = getCacheStats();
            logger.info('Cache stats requested', stats);

            return {
                content: [
                    {
                        type: "text",
                        text: `📊 Cache Statistics:\n${JSON.stringify(stats, null, 2)}`
                    }
                ]
            };
        }
    }
};
