export const createCacheClearTool = (dependencies) => {
    const { clearCache, logger } = dependencies;

    return {
        name: "cache_clear",
        schema: {},
        handler: async () => {
            const result = clearCache();
            logger.info('Cache cleared', result);

            return {
                content: [
                    {
                        type: "text",
                        text: `🗑️ Cache cleared: ${result.clearedEntries} entries removed`
                    }
                ]
            };
        }
    }
};
