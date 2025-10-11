import { z } from "zod";

export const createExportResultsTool = (dependencies) => {
    const { presearchApi, performanceLogger, ErrorHandler } = dependencies;

    return {
        name: "export_results",
        schema: {
            query: z.string().describe("Search query to export"),
            ip: z.string().describe("IP address of the user"),
            format: z.enum(["json", "csv", "markdown"]).describe("Export format"),
            count: z.number().optional().describe("Number of results to export"),
            country: z.string().optional().describe("Country code for search")
        },
        handler: async ({ query, ip, format, count = 10, country }) => {
            const operationId = performanceLogger.start('export_results', { query, format, count });

            try {
                const params = {
                    q: query,
                    count: Math.min(Math.max(count, 1), 20),
                    ip
                };
                if (country) params.country = country;

                const response = await presearchApi.get('/v1/search', { params });

                const data = response.data;
                let exportData = data.data?.standardResults?.slice(0, count) || [];

                let exportedContent = "";

                switch (format) {
                    case "json":
                        exportedContent = JSON.stringify({
                            query,
                            timestamp: new Date().toISOString(),
                            results: exportData
                        }, null, 2);
                        break;

                    case "csv":
                        if (exportData.length > 0) {
                            const headers = Object.keys(exportData[0]).join(",");
                            const rows = exportData.map(row =>
                                Object.values(row).map(val =>
                                    typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
                                ).join(",")
                            ).join("\n");
                            exportedContent = `${headers}\n${rows}`;
                        }
                        break;

                    case "markdown":
                        exportedContent = `# Search Results for "${query}"\n\n`;
                        exportedContent += `Generated: ${new Date().toISOString()}\n\n`;
                        exportData.forEach((result, index) => {
                            exportedContent += `## ${index + 1}. ${result.title}\n`;
                            exportedContent += `**Link:** ${result.url}\n`;
                            exportedContent += `**Description:** ${result.description}\n\n`;
                        });
                        break;
                }

                performanceLogger.end(operationId, {
                    status: 'success',
                    format,
                    resultCount: exportData.length
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: `📤 Exported ${exportData.length} results in ${format.toUpperCase()} format:\n\n${exportedContent}`
                        }
                    ]
                };
            } catch (error) {
                const errorInfo = ErrorHandler.handleError(error, 'Export Results', { query, format });
                performanceLogger.end(operationId, { status: 'error' });

                throw new Error(`Export failed: ${errorInfo.message}`);
            }
        }
    }
};
