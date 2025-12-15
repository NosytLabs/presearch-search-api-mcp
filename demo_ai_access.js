import { createMcpServer } from './src/mcp-server.js';
import { loadConfig } from './src/core/config.js';

async function demonstrateAiAgentAccess() {
  console.log('🤖 Demonstrating How AI Agents Access MCP Content...\n');
  
  const config = loadConfig();
  
  try {
    // Create MCP server instance (this is what AI clients connect to)
    const server = await createMcpServer(config);
    
    console.log('✅ MCP Server Created Successfully');
    console.log('📋 Server Info:');
    console.log(`   - Name: ${server.name}`);
    console.log(`   - Version: ${server.version}`);
    console.log(`   - Description: ${server.description}`);
    
    // Simulate what an AI agent would do
    console.log('\n🔍 Simulating AI Agent Request...');
    
    // Example 1: Simple search (what Claude/Cursor would call)
    console.log('\n1️⃣ AI Agent: "Search for latest AI news"');
    const searchTool = server._tools.find(t => t.name === 'presearch_ai_search');
    
    if (searchTool) {
      console.log('   ✅ Found search tool');
      console.log('   📝 Tool Schema:', JSON.stringify(searchTool.inputSchema, null, 4));
      
      // Execute search (simulating AI agent call)
      const searchResults = await searchTool.execute({
        query: "latest AI breakthroughs December 2024",
        limit: 3
      });
      
      console.log('   📊 Results received:', searchResults.results.length, 'items');
      console.log('   📄 First result:', {
        title: searchResults.results[0].title,
        url: searchResults.results[0].url,
        snippet: searchResults.results[0].snippet.substring(0, 100) + '...'
      });
    }
    
    // Example 2: Export functionality
    console.log('\n2️⃣ AI Agent: "Export these results to JSON"');
    const exportTool = server._tools.find(t => t.name === 'export_search_results');
    
    if (exportTool) {
      console.log('   ✅ Found export tool');
      
      // Create sample results for export
      const sampleResults = [
        {
          title: "Sample AI Article",
          url: "https://example.com/ai-article",
          snippet: "This is a sample article about AI breakthroughs...",
          description: "Detailed article content...",
          source: "example.com",
          publishedDate: "2024-12-14"
        }
      ];
      
      const exportResult = await exportTool.execute({
        results: sampleResults,
        format: "json",
        filename: "ai_agent_export_test.json"
      });
      
      console.log('   💾 Export result:', exportResult.content);
      console.log('   📁 File saved to:', process.cwd() + '/ai_agent_export_test.json');
    }
    
    // Example 3: Deep research (complex AI agent workflow)
    console.log('\n3️⃣ AI Agent: "Conduct deep research on quantum computing"');
    const researchTool = server._tools.find(t => t.name === 'presearch_deep_research');
    
    if (researchTool) {
      console.log('   ✅ Found deep research tool');
      console.log('   🎯 Starting research (this may take a moment)...');
      
      const researchResults = await researchTool.execute({
        query: "quantum computing applications 2024",
        depth: 1,
        breadth: 2,
        research_focus: "technology"
      });
      
      console.log('   📚 Research completed:', researchResults.success);
      if (researchResults.success) {
        console.log('   📖 Research summary:', researchResults.research_summary.substring(0, 200) + '...');
        console.log('   🔗 Sources analyzed:', researchResults.sources_analyzed);
      }
    }
    
    console.log('\n✅ AI Agent Access Demonstration Complete!');
    console.log('\n📋 Summary:');
    console.log('   • AI agents connect to MCP server via stdio or HTTP');
    console.log('   • Server exposes tools that AI can call with parameters');
    console.log('   • Results are returned as JSON for AI to process');
    console.log('   • Files are saved locally when export tools are used');
    console.log('   • AI agents get structured data, not raw HTML');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
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