import { searchTool } from './src/tools/search.js';
import { exportResultsTool } from './src/tools/export.js';
import { deepResearchTool } from './src/tools/deep-research.js';
import { siteExportTool } from './src/tools/site-export.js';
import { loadConfig } from './src/core/config.js';

async function testExportFunctionality() {
  console.log('🚀 Testing Export Functionality with File Saving...');
  
  const config = loadConfig();
  
  if (!config.apiKey) {
    console.warn('⚠️  WARNING: PRESEARCH_API_KEY is not set.');
    return;
  }

  try {
    // 1. Search for AI news
    console.log('\n🔍 Searching for AI news...');
    const searchResults = await searchTool.execute({ 
      query: "latest AI breakthroughs December 2024", 
      limit: 5 
    });
    
    console.log(`✅ Found ${searchResults.results.length} results`);
    
    // 2. Export to different formats with filenames
    console.log('\n📊 Exporting results to different formats...');
    
    // JSON export
    const jsonExport = await exportResultsTool.execute({
      results: searchResults.results,
      format: "json",
      filename: "ai_news_results.json"
    });
    console.log(`✅ JSON export: ${jsonExport.content}`);
    
    // CSV export
    const csvExport = await exportResultsTool.execute({
      results: searchResults.results,
      format: "csv",
      filename: "ai_news_results.csv"
    });
    console.log(`✅ CSV export: ${csvExport.content}`);
    
    // Markdown export
    const mdExport = await exportResultsTool.execute({
      results: searchResults.results,
      format: "markdown",
      filename: "ai_news_results.md"
    });
    console.log(`✅ Markdown export: ${mdExport.content}`);
    
    // HTML export
    const htmlExport = await exportResultsTool.execute({
      results: searchResults.results,
      format: "html",
      filename: "ai_news_results.html"
    });
    console.log(`✅ HTML export: ${htmlExport.content}`);
    
    // 3. Test deep research with export
    console.log('\n🔬 Testing deep research with export...');
    const researchResults = await deepResearchTool.execute({ 
      query: "quantum computing applications 2024", 
      depth: 2, 
      breadth: 3,
      research_focus: "technology"
    });
    
    if (researchResults.success) {
      const researchExport = await exportResultsTool.execute({
        results: researchResults.sources || [],
        format: "json",
        filename: "quantum_computing_research.json"
      });
      console.log(`✅ Research export: ${researchExport.content}`);
    }
    
    // 4. Test site export
    console.log('\n🌐 Testing site export...');
    const siteResults = await siteExportTool.execute({
      url: "https://example.com",
      format: "json",
      filename: "example_site_export.json",
      depth: 1
    });
    console.log(`✅ Site export completed: ${siteResults.content[0].text.substring(0, 100)}...`);
    
    console.log('\n🎉 All export tests completed successfully!');
    console.log('\n📁 Check your current directory for exported files:');
    console.log('   - ai_news_results.json');
    console.log('   - ai_news_results.csv');
    console.log('   - ai_news_results.md');
    console.log('   - ai_news_results.html');
    console.log('   - quantum_computing_research.json');
    console.log('   - example_site_export.json');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('API Status:', error.response.status);
      console.error('API Data:', JSON.stringify(error.response.data));
    }
  }
}

testExportFunctionality().catch(err => console.error("Fatal Error:", err));