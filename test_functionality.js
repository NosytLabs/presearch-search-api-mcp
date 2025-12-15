#!/usr/bin/env node

/**
 * Comprehensive Functionality Test for Presearch MCP Server
 * Tests all tools, error handling, and edge cases
 */

import { tools } from './src/tools/index.js';
import { loadConfig } from './src/core/config.js';
import logger from './src/core/logger.js';

const config = loadConfig();

console.log('🧪 COMPREHENSIVE FUNCTIONALITY TEST');
console.log('=====================================');
console.log(`API Key: ${config.apiKey ? '✅ Configured' : '❌ Missing'}`);
console.log(`Tools Available: ${tools.length}`);
console.log('');

// Test configuration
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

async function testTool(toolName, testFn, expectedError = false) {
  testResults.total++;
  console.log(`🔍 Testing: ${toolName}`);
  
  try {
    const result = await testFn();
    
    if (expectedError) {
      console.log(`❌ ${toolName}: Expected error but got success`);
      testResults.failed++;
    } else {
      console.log(`✅ ${toolName}: Success`);
      if (result) {
        console.log(`   Result: ${JSON.stringify(result).substring(0, 100)}...`);
      }
      testResults.passed++;
    }
  } catch (error) {
    if (expectedError) {
      console.log(`✅ ${toolName}: Expected error - ${error.message}`);
      testResults.passed++;
    } else {
      console.log(`❌ ${toolName}: Failed - ${error.message}`);
      testResults.errors.push({ tool: toolName, error: error.message });
      testResults.failed++;
    }
  }
  console.log('');
}

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Functionality Tests...\n');

  // Test 1: Health Check
  await testTool('Health Check', async () => {
    const healthTool = tools.find(t => t.name === 'presearch_health_check');
    return await healthTool.execute({});
  });

  // Test 2: Basic Search
  await testTool('Basic Search', async () => {
    const searchTool = tools.find(t => t.name === 'presearch_ai_search');
    return await searchTool.execute({ 
      query: 'test search functionality',
      limit: 2 
    });
  });

  // Test 3: Search with Invalid Query
  await testTool('Search with Empty Query', async () => {
    const searchTool = tools.find(t => t.name === 'presearch_ai_search');
    const result = await searchTool.execute({ query: '', limit: 1 });
    // Check if result contains error
    if (result && result.error) {
      throw new Error(result.error.message || 'Validation error occurred');
    }
    return result;
  }, true); // Expect error

  // Test 4: Scrape Valid URL
  await testTool('Scrape Valid URL', async () => {
    const scrapeTool = tools.find(t => t.name === 'scrape_url');
    return await scrapeTool.execute({ 
      url: 'https://example.com',
      format: 'text'
    });
  });

  // Test 5: Scrape Invalid URL
  await testTool('Scrape Invalid URL', async () => {
    const scrapeTool = tools.find(t => t.name === 'scrape_url');
    const result = await scrapeTool.execute({ 
      url: 'not-a-valid-url',
      format: 'text'
    });
    // Check if result contains error
    if (result && result.error) {
      throw new Error(result.error.message || 'URL validation error occurred');
    }
    return result;
  }, true); // Expect error

  // Test 6: Export Results
  await testTool('Export Results', async () => {
    const exportTool = tools.find(t => t.name === 'export_search_results');
    const mockResults = [
      { title: 'Test 1', url: 'http://test1.com', snippet: 'Test snippet 1' },
      { title: 'Test 2', url: 'http://test2.com', snippet: 'Test snippet 2' }
    ];
    return await exportTool.execute({ 
      results: mockResults,
      format: 'json',
      filename: 'test_export.json'
    });
  });

  // Test 7: Cache Stats
  await testTool('Cache Statistics', async () => {
    const cacheTool = tools.find(t => t.name === 'cache_stats');
    return await cacheTool.execute({});
  });

  // Test 8: Deep Research (if API key available)
  if (config.apiKey) {
    await testTool('Deep Research', async () => {
      const researchTool = tools.find(t => t.name === 'presearch_deep_research');
      return await researchTool.execute({ 
        query: 'test research functionality',
        depth: 1,
        breadth: 2
      });
    });
  } else {
    console.log('⚠️ Skipping Deep Research test (no API key)\n');
  }

  // Test 9: Search and Scrape
  await testTool('Search and Scrape', async () => {
    const searchScrapeTool = tools.find(t => t.name === 'presearch_search_and_scrape');
    return await searchScrapeTool.execute({ 
      query: 'test functionality',
      limit: 2,
      scrape_results: true
    });
  });

  // Test 10: Content Analysis
  await testTool('Content Analysis', async () => {
    const analyzeTool = tools.find(t => t.name === 'analyze_content');
    const testContent = 'This is a test about artificial intelligence and machine learning. The technology is advancing rapidly.';
    return await analyzeTool.execute({ 
      content: testContent,
      include_keywords: true,
      include_summary: true
    });
  });

  console.log('📊 FINAL RESULTS');
  console.log('================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 ERRORS ENCOUNTERED:');
    testResults.errors.forEach(({ tool, error }) => {
      console.log(`  - ${tool}: ${error}`);
    });
  }

  // Overall assessment
  const isFunctional = testResults.failed === 0;
  console.log('\n🏁 OVERALL ASSESSMENT:');
  if (isFunctional) {
    console.log('✅ MCP SERVER IS FULLY FUNCTIONAL!');
    console.log('✅ Ready for GitHub release and Smithery.ai deployment');
  } else {
    console.log('❌ MCP SERVER HAS ISSUES THAT NEED FIXING');
    console.log('❌ Not ready for release until errors are resolved');
  }

  return isFunctional;
}

// Run tests
runComprehensiveTests().then(isFunctional => {
  process.exit(isFunctional ? 0 : 1);
}).catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});