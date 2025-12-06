
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

// Start the server
const serverProcess = spawn('node', ['src/index.js', '--port', '3007'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3007' }
});

console.log('Starting server on port 3007...');

// Wait for server to start
setTimeout(() => {
  console.log('Sending test request...');
  
  const postData = JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    },
    id: 1
  });

  const options = {
    hostname: 'localhost',
    port: 3007,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`BODY: ${data}`);
      serverProcess.kill();
      if (res.statusCode === 200) {
        console.log('TEST PASSED');
        fs.writeFileSync('test_result.txt', 'PASSED\n' + data);
        process.exit(0);
      } else {
        console.log('TEST FAILED');
        fs.writeFileSync('test_result.txt', 'FAILED: ' + res.statusCode + '\n' + data);
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    fs.writeFileSync('test_result.txt', 'ERROR: ' + e.message);
    serverProcess.kill();
    process.exit(1);
  });

  req.write(postData);
  req.end();

}, 5000);
