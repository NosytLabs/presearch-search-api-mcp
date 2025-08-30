#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// MCP initialize message
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'health-check',
      version: '1.0.0'
    }
  }
};

const serverPath = path.join(__dirname, 'src/server/server_enhanced.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' }
});

let responseReceived = false;
let timeout = setTimeout(() => {
  if (!responseReceived) {
    console.error('Health check timeout');
    server.kill();
    process.exit(1);
  }
}, 10000);

// Send initialize message
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Listen for response
server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString().trim());
    if (response.id === 1 && response.result) {
      responseReceived = true;
      clearTimeout(timeout);
      console.log('MCP server health check passed');
      server.kill();
      process.exit(0);
    }
  } catch (e) {
    // Ignore parsing errors
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  if (!responseReceived) {
    console.error('Server closed without proper response');
    process.exit(1);
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});