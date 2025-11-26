import { scrapeTool } from '../src/tools/scrape.js';
import { contentAnalysisTool } from '../src/tools/content-analysis.js';
import { healthTool } from '../src/tools/health.js';

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.PRESEARCH_API_KEY;

if (!API_KEY) {
  console.error('ERROR: PRESEARCH_API_KEY not found in environment variables.');
  process.exit(1);
}

const context = { apiKey: API_KEY };

async function runExtraTests() {
  console.log('Starting EXTRA API Tests...');
  let passed = 0;
  let failed = 0;

  // Test 4: Health Check
  try {
    console.log('\n--- Test 4: Health Check ---');
    const result = await healthTool.execute({}, context);
    console.log('Health Status:', result.status);
    if (result.success && result.status.reachable) {
        console.log('PASSED: Health check OK');
        passed++;
    } else {
        console.error('FAILED: Health check not OK');
        failed++;
    }
  } catch (err) {
    console.error('Test 4 Error:', err);
    failed++;
  }

  // Test 5: Scrape Tool
  try {
    console.log('\n--- Test 5: Scrape Tool (URL: "https://example.com/") ---');
    const args = {
        urls: ['https://example.com/'],
        include_text: true
    };
    const result = await scrapeTool.execute(args, context);
    if (result.items && result.items.length > 0) {
        console.log('Scraped URL:', result.items[0].url);
        console.log('Content Preview:', result.items[0].text ? result.items[0].text.substring(0, 50) : 'No text');
        passed++;
    } else {
        console.error('FAILED: No scrape results');
        failed++;
    }
  } catch (err) {
    console.error('Test 5 Error:', err);
    failed++;
  }
    
  // Test 6: Content Analysis
  try {
    console.log('\n--- Test 6: Content Analysis ---');
    const args = {
        content: [{
            title: "Example Domain",
            url: "https://example.com/",
            content: "This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission."
        }],
        analysis_type: "research"
    };
    const result = await contentAnalysisTool.execute(args, context);
    console.log('Analysis Summary:', result.analysis_summary ? JSON.stringify(result.analysis_summary).substring(0, 100) : 'No summary');
    if (result.analysis_summary) {
        console.log('PASSED: Analysis successful');
        passed++;
    } else {
        console.error('FAILED: Analysis failed');
        failed++;
    }
  } catch (err) {
    console.error('Test 6 Error:', err);
    failed++;
  }

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runExtraTests();
