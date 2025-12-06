import { searchTool } from '../src/tools/search.js';
import { deepResearchTool } from '../src/tools/deep-research.js';
import { searchAndScrapeTool } from '../src/tools/search-scrape.js';
import { apiClient } from '../src/core/apiClient.js';

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.PRESEARCH_API_KEY;

if (!API_KEY) {
  console.error('ERROR: PRESEARCH_API_KEY not found in environment variables.');
  process.exit(1);
}

const context = { apiKey: API_KEY };

async function runRealTests() {
  console.log('Starting REAL API Tests...');
  let passed = 0;
  let failed = 0;

  // Test 1: Real Search
  try {
    console.log('\n--- Test 1: Real Search (Query: "latest spacex launch") ---');
    const args = {
      query: 'latest spacex launch',
      freshness: 'month',
      count: 5,
      safe: 'moderate',
      country: 'US'
    };
    const result = await searchTool.execute(args, { apiKey: API_KEY });
    
    if (result.success && result.results && result.results.length > 0) {
      console.log(`✅ PASS: Found ${result.results.length} results`);
      console.log(`   Top result: ${result.results[0].title}`);
      passed++;
    } else {
      console.log('❌ FAIL: No results returned');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Search test error:', error.message);
    failed++;
  }

  // Test 2: Search and Scrape
  try {
    console.log('\n--- Test 2: Search and Scrape (Query: "AI safety 2024") ---');
    const args = {
      query: 'AI safety 2024',
      count: 3,
      scrape_results: true,
      max_scraped_chars: 2000
    };
    const result = await searchAndScrapeTool.execute(args, { apiKey: API_KEY });
    
    if (result.success && result.results && result.results.length > 0) {
      const scrapedCount = result.scraped ? result.scraped.length : 0;
      console.log(`✅ PASS: Found ${result.results.length} results, scraped ${scrapedCount}`);
      if (scrapedCount > 0) {
          console.log(`   First scraped content length: ${result.scraped[0].textLength || 'N/A'}`);
      }
      passed++;
    } else {
      console.log('❌ FAIL: Search and scrape failed');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Search and scrape error:', error.message);
    failed++;
  }

  // Test 3: Deep Research
  try {
    console.log('\n--- Test 3: Deep Research (Query: "quantum computing breakthroughs") ---');
    const args = {
      query: 'quantum computing breakthroughs',
      max_iterations: 2,
      max_results_per_iteration: 3
    };
    const result = await deepResearchTool.execute(args, { apiKey: API_KEY });
    
    if (result.success) {
      const sourcesCount = result.research_summary?.sources_analyzed || result.sources?.length || 0;
      console.log(`✅ PASS: Research completed with ${sourcesCount} sources analyzed`);
      if (result.analysis) {
          console.log(`   Analysis topics: ${Object.keys(result.analysis).length}`);
      }
      passed++;
    } else {
      console.log('❌ FAIL: Deep research failed');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Deep research error:', error.message);
    failed++;
  }
}
runRealTests();
