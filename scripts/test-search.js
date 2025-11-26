
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
      include_metadata: true
    };
    
    const result = await searchTool.execute(args, context);
    
    console.log(`Results found: ${result.results.length}`);
    if (result.results.length > 0) {
      console.log('Top Result:', result.results[0].title);
      console.log('URL:', result.results[0].url);
      passed++;
    } else {
      console.error('FAILED: No results returned');
      failed++;
    }

    // Check for rate limit headers (captured by apiClient)
    const stats = apiClient.getRateLimitStats();
    console.log('Rate Limit Stats:', JSON.stringify(stats.apiHeaders, null, 2));
    if (stats.apiHeaders && stats.apiHeaders.remaining) {
      console.log('PASSED: Rate limit headers captured');
      passed++;
    } else {
      console.warn('WARNING: Rate limit headers missing (might be first request or cached)');
    }

  } catch (err) {
    console.error('Test 1 Error:', err);
    failed++;
  }

  // Test 2: Real Search & Scrape
  try {
    console.log('\n--- Test 2: Real Search & Scrape (Query: "example domain", Count: 1) ---');
    // Using a simple query to avoid heavy scraping
    const args = {
      query: 'example domain',
      count: 1,
      scrape_count: 1,
      include_text: true
    };

    const result = await searchAndScrapeTool.execute(args, context);
    
    if (result.scraped && result.scraped.length > 0) {
      const scrapedItem = result.scraped[0];
      console.log('Scraped URL:', scrapedItem.url);
      console.log('Content Length:', scrapedItem.textLength);
      console.log('Preview:', scrapedItem.text ? scrapedItem.text.substring(0, 100).replace(/\n/g, ' ') : 'No text');
      
      if (scrapedItem.textLength > 0) {
        console.log('PASSED: Content scraped successfully');
        passed++;
      } else {
        console.error('FAILED: Scraped content empty');
        failed++;
      }
    } else {
      console.error('FAILED: No items scraped');
      failed++;
    }

  } catch (err) {
    console.error('Test 2 Error:', err);
    failed++;
  }

  // Test 3: Real Deep Research (Small scope)
  try {
    console.log('\n--- Test 3: Real Deep Research (Query: "benefits of green tea") ---');
    // Keep it small: depth 1, breadth 3
    const args = {
      query: 'benefits of green tea',
      depth: 1,
      breadth: 3,
      research_focus: 'general'
    };

    const result = await deepResearchTool.execute(args, context);
    
    if (result.success) {
      console.log('Research Summary:', JSON.stringify(result.research_summary, null, 2));
      console.log('Sources Found:', result.sources.length);
      console.log('Recommendations:', result.recommendations ? result.recommendations.length : 0);
      
      if (result.sources.length > 0) {
        console.log('PASSED: Deep research successful');
        passed++;
      } else {
        console.error('FAILED: No sources analyzed');
        failed++;
      }
    } else {
      console.error('FAILED: Deep research returned success=false', result);
      failed++;
    }

  } catch (err) {
    console.error('Test 3 Error:', err);
    failed++;
  }

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runRealTests().catch(console.error);
