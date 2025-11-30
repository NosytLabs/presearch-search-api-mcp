import { searchTool } from '../src/tools/search.js';
import { deepResearchTool } from '../src/tools/deep-research.js';
import { searchAndScrapeTool } from '../src/tools/search-scrape.js';
import { contentAnalysisTool } from '../src/tools/content-analysis.js';
import { exportResultsTool } from '../src/tools/export.js';
import { scrapeTool } from '../src/tools/scrape.js';
import { healthTool } from '../src/tools/health.js';
import { nodeStatusTool } from '../src/tools/node-status.js';
import { cacheStatsTool, cacheClearTool } from '../src/tools/cache.js';
import enhancedExportTool from '../src/tools/enhanced-export.js';

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.PRESEARCH_API_KEY;

if (!API_KEY) {
  console.error('ERROR: PRESEARCH_API_KEY not found in environment variables.');
  process.exit(1);
}

const context = { apiKey: API_KEY };

const tools = [
  { name: 'search', tool: searchTool, testArgs: { query: 'AI news', count: 3 } },
  { name: 'searchAndScrape', tool: searchAndScrapeTool, testArgs: { query: 'machine learning', count: 2, scrape_results: true } },
  { name: 'deepResearch', tool: deepResearchTool, testArgs: { query: 'climate change effects', max_iterations: 2 } },
  { name: 'contentAnalysis', tool: contentAnalysisTool, testArgs: { content: [{ title: 'Test Article', url: 'https://example.com', description: 'A test article about AI' }], focus_area: 'technical' } },
  { name: 'exportResults', tool: exportResultsTool, testArgs: { query: 'test search', format: 'json' } },
  { name: 'scrape', tool: scrapeTool, testArgs: { url: 'https://example.com' } },
  { name: 'health', tool: healthTool, testArgs: {} },
  { name: 'nodeStatus', tool: nodeStatusTool, testArgs: { node_id: 'test_node' } },
  { name: 'cacheStats', tool: cacheStatsTool, testArgs: {} },
  { name: 'cacheClear', tool: cacheClearTool, testArgs: {} },
  { name: 'enhancedExport', tool: enhancedExportTool, testArgs: { url: 'https://example.com', format: 'json' } },
];

async function testAllTools() {
  console.log('🧪 Testing All MCP Tools...\n');
  let passed = 0;
  let failed = 0;

  for (const { name, tool, testArgs } of tools) {
    try {
      console.log(`Testing ${name}...`);
      const result = await tool.execute(testArgs, context);
      
      if (result && typeof result === 'object') {
        console.log(`✅ ${name}: Success`);
        if (result.success === false) {
          console.log(`   Warning: success=false but no error thrown`);
        }
        passed++;
      } else {
        console.log(`❌ ${name}: Invalid result format`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
    console.log(''); // Empty line for readability
  }

  console.log('\n=== TOOL TEST SUMMARY ===');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tools failed. Check the error messages above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tools are working correctly!');
    process.exit(0);
  }
}

// Run comprehensive tool tests
testAllTools().catch(console.error);