
import { searchTool } from '../src/tools/search.js';
import { searchAndScrapeTool } from '../src/tools/search-scrape.js';
import { deepResearchTool } from '../src/tools/deep-research.js';
import { scrapeTool } from '../src/tools/scrape.js';
import { siteExportTool } from '../src/tools/site-export.js';
import { exportResultsTool } from '../src/tools/export.js';
import { loadConfig } from '../src/core/config.js';
import logger from '../src/core/logger.js';

async function runLiveTests() {
  console.log('🚀 Starting Live Verification Tests (No Mocks)...');
  
  // Ensure config is loaded (this reads env vars)
  const config = loadConfig();
  
  if (!config.apiKey) {
    console.warn('⚠️  WARNING: PRESEARCH_API_KEY is not set. API calls will likely fail or be limited.');
    console.log('   Please set PRESEARCH_API_KEY in your environment or .env file.');
  } else {
    console.log('✅ PRESEARCH_API_KEY found.');
  }

  // Helper to run a test step
  async function runStep(name, fn) {
    console.log(`\n🔹 Running: ${name}...`);
    try {
      const result = await fn();
      console.log(`✅ ${name} Success!`);
      // console.log(JSON.stringify(result, null, 2).substring(0, 500) + '...'); // Log preview
      return true;
    } catch (error) {
      console.error(`❌ ${name} Failed:`, error.message);
      if (error.response) {
        console.error('   API Status:', error.response.status);
        console.error('   API Data:', JSON.stringify(error.response.data));
      }
      return false;
    }
  }

  // 1. Test Search
  await runStep('presearch_ai_search', async () => {
    const result = await searchTool.execute({ 
      query: "latest artificial intelligence news", 
      limit: 3 
    });
    if (!result.results || result.results.length === 0) throw new Error("No results returned");
    console.log(`   Found ${result.results.length} results.`);
    return result;
  });

  // 2. Test Search & Scrape
  await runStep('presearch_search_and_scrape', async () => {
    const result = await searchAndScrapeTool.execute({ 
      query: "python programming tutorial", 
      limit: 1 
    });
    if (!result.scraped || result.scraped.length === 0) throw new Error("No scraped content returned");
    console.log(`   Scraped ${result.scraped.length} pages.`);
    return result;
  });

  // 3. Test Scrape URL (Direct)
  await runStep('scrape_url_content', async () => {
    const result = await scrapeTool.execute({ 
      url: "https://example.com" 
    });
    if (!result.content) throw new Error("No content scraped");
    console.log(`   Scraped content length: ${result.content.length}`);
    return result;
  });

  // 4. Test Site Export
  await runStep('presearch_site_export', async () => {
    const result = await siteExportTool.execute({ 
      query: "site:example.com",
      format: "json"
    });
    const content = JSON.parse(result.content[0].text);
    if (!Array.isArray(content) || content.length === 0) throw new Error("No items exported");
    console.log(`   Exported ${content.length} items.`);
    return result;
  });

  // 5. Test Export Results
  await runStep('export_search_results', async () => {
    const result = await exportResultsTool.execute({
      results: [
        { title: "Test", url: "https://test.com", description: "Test description" }
      ],
      format: "csv"
    });
    if (!result.content) throw new Error("No content exported");
    return result;
  });

  // 6. Test Deep Research (Resource Intensive - skipped if no key or limited)
  if (config.apiKey) {
    await runStep('presearch_deep_research', async () => {
        console.log("   (This might take a minute...)");
        const result = await deepResearchTool.execute({ 
            query: "future of renewable energy", 
            depth: 1, 
            breadth: 3, // Minimal breadth for speed
            research_focus: "general" 
        });
        if (!result.success) throw new Error(result.message || "Deep research failed");
        console.log("   Research summary:", result.research_summary);
        return result;
    });
  } else {
    console.log('\n⚠️  Skipping Deep Research (Requires API Key)');
  }

  console.log('\n🎉 Live Verification Complete.');
}

runLiveTests().catch(err => console.error("Fatal Error:", err));
