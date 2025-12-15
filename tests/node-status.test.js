import { test, describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nodeStatusTool } from '../src/tools/node-status.js';

// Mock presearchService
const mockGetNodeStatus = mock.fn(async (key) => ({
  status: "online",
  node_key: key ? `${key.substring(0, 4)}...` : "unknown",
  message: "Node status monitoring requires specific API access."
}));

// We can't easily mock the import inside the tool file in this environment without rewriting the tool file to accept dependency injection.
// However, since we are testing the tool logic which calls presearchService, and presearchService is imported directly...
// In a real unit test environment we would use loader hooks or dependency injection.
// For this "launch" test file, I will just test the integration or mock the execute method if needed.
// Actually, `presearchService` is a singleton. I can try to mock the method on the singleton if it's exported.

import { presearchService } from '../src/services/presearchService.js';
presearchService.getNodeStatus = mockGetNodeStatus;

describe('Node Status Tool', () => {
  it('should call the correct service method with the provided key', async () => {
    const args = {
      node_key: 'test_key_123',
    };

    await nodeStatusTool.execute(args);

    // Check if service was called correctly
    assert.equal(mockGetNodeStatus.mock.calls.length, 1);
    const call = mockGetNodeStatus.mock.calls[0];
    
    // First argument should be the key
    assert.equal(call.arguments[0], 'test_key_123');
  });

  // Note: Schema validation is handled by MCP SDK / Zod, so we test the logic here.
});
