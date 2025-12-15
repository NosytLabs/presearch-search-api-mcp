#!/usr/bin/env node

// Quick test to see what invalid URL returns
import { tools } from './src/tools/index.js';

async function testInvalidUrl() {
  const scrapeTool = tools.find(t => t.name === 'scrape_url');
  
  console.log('Testing invalid URL...');
  try {
    const result = await scrapeTool.execute({ 
      url: 'not-a-valid-url',
      format: 'text'
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('Success:', result.success);
    console.log('Error present:', !!result.error);
    
  } catch (error) {
    console.log('Caught error:', error.message);
  }
}

testInvalidUrl();