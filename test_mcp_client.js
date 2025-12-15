import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMcpClient() {
  console.log('🤖 Testing MCP Client Access to Presearch Server...');
  
  try {
    // Start the MCP server process
    const serverProcess = spawn('node', ['src/index.js', '--stdio'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env }
    });

    // Create client transport
    const transport = new StdioClientTransport({
      input: serverProcess.stdout,
      output: serverProcess.stdin
    });

    // Initialize connection
    await transport.connect();
    
    console.log('✅ Connected to MCP server');
    
    // Test 1: List available tools
    console.log('\n🔧 Available Tools:');
    const toolsRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    };
    
    transport.send(toolsRequest);
    
    // Listen for response
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for response')), 5000);
      
      transport.on('message', (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
    });
    
    console.log('Tools Response:', JSON.stringify(response, null, 2));
    
    // Test 2: Execute a search
    console.log('\n🔍 Testing Search Tool:');
    const searchRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'presearch_ai_search',
        arguments: {
          query: 'latest AI news',
          limit: 3
        }
      },
      id: 2
    };
    
    transport.send(searchRequest);
    
    const searchResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for search response')), 10000);
      
      transport.on('message', (message) => {
        if (message.id === 2) {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });
    
    console.log('Search Response:', JSON.stringify(searchResponse, null, 2));
    
    // Cleanup
    transport.close();
    serverProcess.kill();
    
    console.log('\n✅ MCP Client Test Completed');
    
  } catch (error) {
    console.error('❌ MCP Client Test Failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMcpClient().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});