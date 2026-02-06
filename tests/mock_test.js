
import { searchTool } from '../src/tools/search.js';
import { searchAndScrapeTool } from '../src/tools/search-scrape.js';
import { deepResearchTool } from '../src/tools/deep-research.js';
import { scrapeTool } from '../src/tools/scrape.js';
import { siteExportTool } from '../src/tools/site-export.js';
import { exportResultsTool } from '../src/tools/export.js';
import { apiClient } from '../src/core/apiClient.js';

// Mock the API Client
const originalGet = apiClient.get;
apiClient.get = async (url, config) => {
  console.log(`[MOCK] GET ${url}`);
  
  if (url === '/v1/search') {
    return {
      data: {
        results: [
          {
            title: "Mock Result 1",
            url: "https://example.com/1",
            description: "This is a mock result for testing."
          },
          {
            title: "Mock Result 2",
            url: "https://example.com/2",
            description: "Another mock result."
          }
        ],
        metadata: {
          total: 2,
          time: 0.1
        }
      }
    };
  }
  return originalGet.call(apiClient, url, config);
};

// Mock Scrape functionality indirectly via search results or create a mock scraper if needed
// For now, we rely on the tools handling the mock data.

async function runMockTests() {
  console.log('🧪 Starting Mock Verification Tests...');
  let passed = 0;
  let failed = 0;

  async function runStep(name, fn) {
    console.log(`\n🔹 Running: ${name}...`);
    try {
      await fn();
      console.log(`✅ ${name} Success!`);
      passed++;
      return true;
    } catch (error) {
      console.error(`❌ ${name} Failed:`, error.message);
      failed++;
      return false;
    }
  }

  // 1. Test Search (Mocked)
  await runStep('presearch_ai_search', async () => {
    const response = await searchTool.execute({
      query: "mock query", 
      limit: 2 
    });

    // Check MCP format
    if (!response.content || !Array.isArray(response.content)) {
       throw new Error("Invalid MCP response format");
    }

    const content = JSON.parse(response.content[0].text);

    if (!content.results || content.results.length === 0) throw new Error("No results returned");
    if (content.results[0].title !== "Mock Result 1") throw new Error("Unexpected result data");
  });

  // 2. Test Export (No API dependency)
  await runStep('export_search_results', async () => {
    const result = await exportResultsTool.execute({
      results: [
        { title: "Test", url: "https://test.com", description: "Test description" }
      ],
      format: "csv"
    });
    if (!result.content) throw new Error("No content exported");
  });

  // 3. Test Deep Research (Mocked)
  await runStep('presearch_deep_research', async () => {
    const result = await deepResearchTool.execute({
      query: "mock research",
      depth: 1,
      breadth: 2
    });
    // The deep research tool should return content
    if (!result.content) throw new Error("No content returned");
  });

  console.log('\n📊 Mock Test Summary');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
}

runMockTests();
