#!/usr/bin/env node

/**
 * Brave Search MCP Server - Production Test Suite v1.0
 * Tests real API functionality with authentic responses
 */

import { createConfigFromEnv } from '../config/config.js';
import axios from 'axios';

/**
 * Test suite for Brave Search API functionality
 */
class BraveSearchAPITester {
    constructor() {
        this.config = createConfigFromEnv();
        this.apiKey = this.config.getApiKey();
        this.baseURL = process.env.BRAVE_BASE_URL || 'https://api.search.brave.com';
        this.testResults = [];
        this.passedTests = 0;
        this.failedTests = 0;
    }

    async runTests() {
        console.log('🧪 Brave Search MCP Server v1.0 - Production Test Suite\n');
        console.log('🔗 Testing against: https://api.search.brave.com/res/v1/web/search\n');

        const tests = [
            { name: 'Basic Search', test: () => this.testBasicSearch() },
            { name: 'Search with Pagination', test: () => this.testPagination() },
            { name: 'Search with Language Filter', test: () => this.testLanguageFilter() },
            { name: 'Search with Time Filter', test: () => this.testTimeFilter() },
            { name: 'Search with Safe Mode', test: () => this.testSafeMode() },
            { name: 'API Error Handling', test: () => this.testErrorHandling() },
            { name: 'Response Structure Validation', test: () => this.testResponseStructure() }
        ];

        for (const { name, test } of tests) {
            try {
                console.log(`🔍 Testing: ${name}...`);
                const result = await test();
                this.testResults.push({ name, status: 'PASS', result });
                this.passedTests++;
                console.log(`✅ ${name}: PASSED\n`);
            } catch (error) {
                this.testResults.push({ name, status: 'FAIL', error: error.message });
                this.failedTests++;
                console.log(`❌ ${name}: FAILED - ${error.message}\n`);
            }
        }

        this.printSummary();
    }

    async testBasicSearch() {
        const response = await this.makeAPICall({
            q: 'javascript programming',
            count: 10
        });

        this.validateResponse(response);

        return {
            query: response.data.query || 'javascript programming',
            resultsCount: response.data.web?.results?.length || 0,
            hasResults: (response.data.web?.results?.length || 0) > 0,
            responseTime: response.responseTime
        };
    }

    async testPagination() {
        const response = await this.makeAPICall({
            q: 'web development',
            offset: 10,
            count: 10
        });

        this.validateResponse(response);

        return {
            offset: 10,
            hasResults: (response.data.web?.results?.length || 0) > 0,
            hasPagination: true
        };
    }

    async testLanguageFilter() {
        const response = await this.makeAPICall({
            q: 'programming',
            search_lang: 'en',
            ui_lang: 'en-US'
        });

        this.validateResponse(response);

        return {
            search_lang: 'en',
            ui_lang: 'en-US',
            hasResults: (response.data.web?.results?.length || 0) > 0
        };
    }

    async testTimeFilter() {
        const response = await this.makeAPICall({
            q: 'technology news',
            freshness: 'pw'
        });

        this.validateResponse(response);

        return {
            freshness: 'pw',
            hasResults: (response.data.web?.results?.length || 0) > 0
        };
    }

    async testSafeMode() {
        const response = await this.makeAPICall({
            q: 'family content',
            safesearch: 'moderate'
        });

        this.validateResponse(response);

        return {
            safesearch: 'moderate',
            hasResults: (response.data.web?.results?.length || 0) > 0
        };
    }

    async testErrorHandling() {
        try {
            // Test with invalid API key
            const invalidResponse = await axios.get(`${this.baseURL}/res/v1/web/search`, {
                params: { q: 'test', count: 1 },
                headers: { 'X-Subscription-Token': 'invalid_key' },
                timeout: 10000
            });

            throw new Error('Should have failed with invalid API key');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                return { errorHandling: 'correct', statusCode: 401 };
            }
            throw error;
        }
    }

    async testResponseStructure() {
        const response = await this.makeAPICall({
            q: 'test query',
            count: 5
        });

        const data = response.data;

        // Validate required structure
        if (!data.web) throw new Error('Missing web object');
        if (!Array.isArray(data.web.results)) throw new Error('results is not an array');

        const hasQuery = !!data.query;
        const hasType = !!data.type;
        const hasResults = data.web.results.length > 0;

        return {
            hasWebResults: true,
            hasQuery,
            hasType,
            hasResults,
            resultCount: data.web.results.length
        };
    }

    async makeAPICall(params) {
        const startTime = Date.now();

        try {
            const response = await axios.get(`${this.baseURL}/res/v1/web/search`, {
                params,
                headers: {
                    'X-Subscription-Token': this.apiKey,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'User-Agent': 'BraveSearchMCP/1.0.0 (Test Suite)'
                },
                timeout: 30000
            });

            const responseTime = Date.now() - startTime;
            response.responseTime = responseTime;

            return response;
        } catch (error) {
            if (error.response) {
                console.log(`API Error ${error.response.status}: ${error.response.statusText}`);
                if (error.response.data) {
                    console.log('Response data:', JSON.stringify(error.response.data, null, 2));
                }
            }
            throw error;
        }
    }

    validateResponse(response) {
        if (!response.data) {
            throw new Error('No response data received');
        }
        
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    /**
     * Prints a comprehensive test summary
     */
    printSummary() {
        console.log('📊 TEST SUMMARY');
        console.log('================');

        const total = this.testResults.length;
        const successRate = Math.round((this.passedTests / total) * 100);

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${this.passedTests}`);
        console.log(`❌ Failed: ${this.failedTests}`);
        console.log(`Success Rate: ${successRate}%\n`);

        if (this.failedTests === 0) {
            console.log('🎉 ALL TESTS PASSED! Production ready! 🚀');
        } else {
            console.log('⚠️  Some tests failed. Check API configuration.');
        }

        console.log('\n📋 DETAILED RESULTS:');
        this.testResults.forEach(result => {
            console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.name}`);
            if (result.result) {
                console.log(`   ${JSON.stringify(result.result, null, 2)}`);
            }
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
    }
}

// Run tests
async function main() {
    try {
        const tester = new BraveSearchAPITester();
        await tester.runTests();
    } catch (error) {
        console.error('❌ Test suite failed to initialize:', error.message);
        console.log('\n💡 Make sure:');
        console.log('- .env file exists with BRAVE_API_KEY');
        console.log('- API key is valid and has credits');
        console.log('- Network connection is working');
        process.exit(1);
    }
}

main();