import { deepResearchTool } from '../src/tools/deep-research.js';
import contentFetcher from '../src/services/contentFetcher.js';
import logger from '../src/core/logger.js';

async function testDeepResearch() {
  console.log('🚀 Starting Deep Research V2 Test...');
  
  // Mock the search part to isolate the fetching logic if possible, 
  // or just run a real query if we have an API key.
  // Since we might not have a valid API key in this environment, 
  // we'll rely on the tool's error handling or mocking if needed.
  // However, deepResearch calls presearchService.search.
  
  // Let's try a real call first. If it fails due to auth, we'll know.
  // But to test batch fetching specifically, we really want to see it hit multiple URLs.
  
  const query = "latest developments in quantum computing";
  
  console.log(`Testing query: "${query}"`);
  
  try {
    const result = await deepResearchTool.execute({
      query,
      breadth: 5, // Minimum is 5 based on error message
      depth: 1,
    });

    if (result.success) {
      console.log('✅ Deep Research Successful');
      console.log(`Found ${result.data.sources.length} sources`);
      result.data.sources.forEach((r, i) => {
        console.log(`\n[${i+1}] ${r.title}`);
        console.log(`    URL: ${r.url}`);
        console.log(`    Content Length: ${r.content_preview?.length || 0} (preview)`);
      });
      
      // Check stats
      const stats = contentFetcher.getStats();
      console.log('\n📊 Fetcher Stats:', stats);
    } else {
      console.log('❌ Deep Research Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test Exception:', error);
  }
}

testDeepResearch();
