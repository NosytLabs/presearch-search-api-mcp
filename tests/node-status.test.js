import { test, describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Mock axios before importing the module under test
const mockGet = mock.fn(async () => ({
  data: { success: true, nodes: {} }
}));

mock.module('axios', {
  defaultExport: {
    get: mockGet,
    isAxiosError: () => false
  }
});

// Import the tool after mocking
const { default: tool } = await import('../src/tools/node-status.js');

describe('Node Status Tool', () => {
  it('should call the correct API endpoint with the provided key', async () => {
    const args = {
      node_api_key: 'test_key_123',
      stats: true
    };

    await tool.execute(args);

    // Check if axios.get was called correctly
    assert.equal(mockGet.mock.calls.length, 1);
    const call = mockGet.mock.calls[0];
    
    // First argument should be the URL
    assert.equal(call.arguments[0], 'https://nodes.presearch.com/api/nodes/status/test_key_123');
    
    // Second argument should be config object with params
    assert.deepEqual(call.arguments[1].params, {
      stats: true,
      connected: true,     // defaults
      disconnected: true,  // defaults
      include_inactive: false // defaults
    });
  });

  it('should return error response if node_api_key is missing', async () => {
    const result = await tool.execute({});
    
    // It should not throw, but return an error object
    assert.ok(result.error, 'Should return error object');
    assert.equal(result.error.code, -32602); // Validation error code
    assert.ok(result.error.message.includes('Invalid input parameters'), 'Should have correct error message');
  });
});
