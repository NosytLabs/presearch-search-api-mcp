#!/usr/bin/env node

/**
 * Test script to verify Presearch API functionality
 */

import { PresearchApiClient } from './src/api/api-client.js';
import { PresearchServerConfig } from './src/config/presearch-server-config.js';
import { config } from './src/config/configuration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPresearchAPI() {
  console.log('🔍 Testing Presearch API...\n');

  try {
    // Test 1: Check environment variables
    console.log('📋 Environment Variables:');
    console.log(`PRESEARCH_API_KEY: ${process.env.PRESEARCH_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`PRESEARCH_BASE_URL: ${process.env.PRESEARCH_BASE_URL || 'https://api.presearch.io'}`);
    console.log();

    // Test 2: Check configuration loading
    console.log('⚙️ Configuration:');
    const config = new PresearchServerConfig();
    console.log(`Base URL: ${config.getBaseURL()}`);
    console.log(`API Key: ${config.getApiKey() ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`Timeout: ${config.getTimeout()}ms`);
    console.log(`Rate Limit: ${config.getRateLimitRequests()} requests / ${config.getRateLimitWindow()}ms`);
    console.log();

    // Test 3: Validate API key
    if (config.getApiKey()) {
      console.log('🔑 Validating API key...');
      const isValid = await config.validateApiKey();
      console.log(`API Key Validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log();
    } else {
      console.log('⚠️  No API key provided - skipping validation\n');
      return;
    }

    // Test 4: Test API client
    console.log('🔗 Testing API client...');
    const apiClient = new PresearchApiClient(config);
    
    console.log('📊 Health Status:');
    const health = apiClient.getHealthStatus();
    console.log(JSON.stringify(health, null, 2));
    console.log();

    // Test 5: Perform actual search
    console.log('🔍 Performing test search...');
    const searchParams = {
      q: 'test search',
      page: 1,
      resultsPerPage: 5,
      lang: 'en'
    };

    const response = await apiClient.search(searchParams);
    console.log('✅ Search successful!');
    console.log(`Found ${response.results?.length || 0} results`);
    console.log('Sample response structure:');
    console.log(JSON.stringify(response, null, 2).substring(0, 500) + '...');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 To fix this:');
      console.log('1. Create a .env file in the project root');
      console.log('2. Add: PRESEARCH_API_KEY=your_api_key_here');
      console.log('3. Get your API key from: https://presearch.com/developers');
    }
  }
}

// Run the test
testPresearchAPI().catch(console.error);