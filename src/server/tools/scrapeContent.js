import { z } from "zod";
import axios from 'axios';
import cheerio from 'cheerio';

const MAX_SCRAPE_TEXT_LENGTH = 2000;
const MAX_SCRAPE_LINKS = 20;
const MAX_SCRAPE_IMAGES = 10;

// URL validation utility
function isValidUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
        return false;
    }
}

export const createScrapeContentTool = (dependencies) => {
    const { config, performanceLogger, ErrorHandler } = dependencies;

    return {
        name: "scrape_content",
        schema: {
            url: z.string().describe("URL to scrape content from"),
            extractText: z.boolean().optional().describe("Extract text content"),
            extractLinks: z.boolean().optional().describe("Extract links"),
            extractImages: z.boolean().optional().describe("Extract images"),
            includeMetadata: z.boolean().optional().describe("Include page metadata")
        },
        handler: async ({ url, extractText = true, extractLinks = false, extractImages = false, includeMetadata = true }) => {
            const operationId = performanceLogger.start('scrape_content', { url });

            try {
                // Validate URL for security
                if (!isValidUrl(url)) {
                    throw ErrorHandler.createError(
                        ErrorHandler.ERROR_CODES.VALIDATION_ERROR,
                        'Invalid URL provided for scraping',
                        null,
                        { url }
                    );
                }

                // For now, we'll use a simple approach with axios
                // In a production system, you'd want a proper scraping library
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'PresearchMCP/1.0.0'
                    },
                    timeout: config.timeout
                });

                const html = response.data;
                const $ = cheerio.load(html);
                const results = {};

                if (includeMetadata) {
                    results.metadata = {
                        title: $('title').text() || 'No title found',
                        description: $('meta[name="description"]').attr('content') || 'No description found',
                        url: url,
                        statusCode: response.status
                    };
                }

                if (extractText) {
                    $('script, style').remove();
                    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
                    results.textContent = textContent.substring(0, MAX_SCRAPE_TEXT_LENGTH) + (textContent.length > MAX_SCRAPE_TEXT_LENGTH ? '...' : '');
                }

                if (extractLinks) {
                    results.links = [];
                    $('a').slice(0, MAX_SCRAPE_LINKS).each((i, el) => {
                        results.links.push({
                            url: $(el).attr('href') || '',
                            text: $(el).text() || ''
                        });
                    });
                }

                if (extractImages) {
                    results.images = [];
                    $('img').slice(0, MAX_SCRAPE_IMAGES).each((i, el) => {
                        results.images.push({
                            src: $(el).attr('src') || '',
                            alt: $(el).attr('alt') || ''
                        });
                    });
                }

                performanceLogger.end(operationId, {
                    status: 'success',
                    extractedText: extractText,
                    extractedLinks: extractLinks,
                    extractedImages: extractImages
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: `🔍 Scraped content from ${url}:\n\n${JSON.stringify(results, null, 2)}`
                        }
                    ]
                };
            } catch (error) {
                const errorInfo = ErrorHandler.handleError(error, 'Content Scraping', { url });
                performanceLogger.end(operationId, { status: 'error' });

                throw new Error(`Scraping failed for ${url}: ${errorInfo.message}`);
            }
        }
    }
};
