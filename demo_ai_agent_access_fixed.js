import { tools } from './src/tools/index.js';
import { loadConfig } from './src/core/config.js';

async function demonstrateAiAgentAccess() {
  console.log('🤖 Demonstrating How AI Agents Access MCP Content...\n');
  
  const config = loadConfig();
  
  if (!config.apiKey) {
    console.warn('⚠️  WARNING: PRESEARCH_API_KEY is not set. Some features may not work.');
  }
  
  try {
    console.log('📋 Available MCP Tools for AI Agents:');
    console.log('=====================================');
    
    tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log('');
    });
    
    console.log('\n🔍 Testing AI Agent Workflows...');
    console.log('=================================');
    
    // Example 1: AI Agent searches for information
    console.log('\n1️⃣ AI Agent: "Find latest AI breakthroughs"');
    const searchTool = tools.find(t => t.name === 'presearch_ai_search');
    
    if (searchTool && config.apiKey) {
      console.log('   🛠️  Using tool:', searchTool.name);
      console.log('   📥 Input: { query: "latest AI breakthroughs December 2024", limit: 3 }');
      
      const searchResults = await searchTool.execute({ 
        query: "latest AI breakthroughs December 2024", 
        limit: 3 
      });
      
      console.log('   📤 Output received:');
      console.log(`   - Results count: ${searchResults.results.length}`);
      console.log(`   - First result title: "${searchResults.results[0]?.title}"`);
      console.log(`   - First result URL: ${searchResults.results[0]?.url}`);
      console.log(`   - Sample snippet: "${searchResults.results[0]?.snippet?.substring(0, 100)}..."`);
    }
    
    // Example 2: AI Agent exports results
    console.log('\n2️⃣ AI Agent: "Export these results to a file"');
    const exportTool = tools.find(t => t.name === 'export_search_results');
    
    if (exportTool) {
      console.log('   🛠️  Using tool:', exportTool.name);
      
      // Create sample data for export
      const sampleResults = [
        {
          title: "AI Breakthrough in December 2024",
          url: "https://example.com/ai-breakthrough",
          snippet: "Researchers announced a major advancement in AI technology...",
          description: "Detailed analysis of the breakthrough...",
          source: "example.com",
          publishedDate: "2024-12-14"
        }
      ];
      
      console.log('   📥 Input: { results: [...], format: "json", filename: "ai_research.json" }');
      
      const exportResult = await exportTool.execute({
        results: sampleResults,
        format: "json",
        filename: "ai_agent_demo_export.json"
      });
      
      console.log('   📤 Output received:');
      console.log(`   - Format: ${exportResult.format}`);
      console.log(`   - Count: ${exportResult.count}`);
      console.log(`   - File saved: ${exportResult.content}`);
    }
    
    // Example 3: AI Agent conducts deep research
    console.log('\n3️⃣ AI Agent: "Conduct comprehensive research on quantum computing"');
    const researchTool = tools.find(t => t.name === 'presearch_deep_research');
    
    if (researchTool && config.apiKey) {
      console.log('   🛠️  Using tool:', researchTool.name);
      console.log('   📥 Input: { query: "quantum computing applications 2024", depth: 1, breadth: 2 }');
      
      const researchResults = await researchTool.execute({
        query: "quantum computing applications 2024",
        depth: 1,
        breadth: 2,
        research_focus: "technology"
      });
      
      console.log('   📤 Output received:');
      console.log(`   - Success: ${researchResults.success}`);
      console.log(`   - Sources analyzed: ${researchResults.research_summary?.sources_analyzed}`);
      console.log(`   - Research summary:`, researchResults.research_summary);
      if (researchResults.analysis) {
        console.log(`   - Analysis available: ${Object.keys(researchResults.analysis).length} sections`);
      }
    }
    
    // Example 4: AI Agent scrapes specific content
    console.log('\n4️⃣ AI Agent: "Scrape content from specific URLs"');
    const scrapeTool = tools.find(t => t.name === 'scrape_url');
    
    if (scrapeTool) {
      console.log('   🛠️  Using tool:', scrapeTool.name);
      console.log('   📥 Input: { urls: ["https://example.com"], include_text: true }');
      
      const scrapeResults = await scrapeTool.execute({
        url: "https://example.com",
        include_text: true
      });
      
      console.log('   📤 Output received:');
      console.log(`   - URL: ${scrapeResults.url}`);
      console.log(`   - Title: ${scrapeResults.title}`);
      console.log(`   - Content length: ${scrapeResults.text?.length || 0} characters`);
      console.log(`   - Status: ${scrapeResults.status}`);
    }
    
    console.log('\n✅ AI Agent Access Demonstration Complete!');
    console.log('\n📝 Key Points for AI Agents:');
    console.log('   • AI agents call MCP tools with structured parameters');
    console.log('   • Results are returned as JSON objects');
    console.log('   • Files are saved locally when export tools are used');
    console.log('   • AI agents can chain multiple tools for complex workflows');
    console.log('   • All tools support both string and native parameter types');
    console.log('   • Error handling provides clear feedback to AI agents');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the demonstration
demonstrateAiAgentAccess().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});