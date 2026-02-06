import { spawn } from 'child_process';
import http from 'http';

const PORT = 3002;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('Starting server...');
  const server = spawn('node', ['src/index.js'], {
    env: { ...process.env, PORT: PORT.toString() },
    stdio: 'pipe'
  });

  server.stdout.on('data', data => console.log(`STDOUT: ${data.toString().trim()}`));
  server.stderr.on('data', data => console.error(`STDERR: ${data.toString().trim()}`));

  // Wait for server to start
  await sleep(3000);

  try {
    console.log('Connecting to SSE...');
    await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${PORT}/sse`, (res) => {
            console.log(`SSE Status: ${res.statusCode}`);
            if (res.statusCode !== 200) {
                reject(new Error(`SSE connection failed with status ${res.statusCode}`));
                return;
            }

            let sessionId = null;

            res.on('data', (chunk) => {
                const text = chunk.toString();
                console.log(`SSE Data: ${text.trim()}`);

                if (text.includes('event: endpoint')) {
                    // Extract sessionId from "data: /messages?sessionId=..."
                    const match = text.match(/sessionId=([a-f0-9-]+)/);
                    if (match) {
                        sessionId = match[1];
                        console.log(`Session ID: ${sessionId}`);

                        // Send POST message
                        sendPostMessage(sessionId).then(() => {
                           console.log('POST message success');
                           req.destroy(); // Close connection
                           resolve();
                        }).catch(reject);
                    }
                }
            });
        });

        req.on('error', reject);
    });

    console.log('Test Passed!');
    server.kill();
    process.exit(0);
  } catch (error) {
    console.error('Test Failed:', error);
    server.kill();
    process.exit(1);
  }
}

function sendPostMessage(sessionId) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            jsonrpc: "2.0",
            method: "ping",
            id: 1
        });

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: `/messages?sessionId=${sessionId}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = http.request(options, (res) => {
            console.log(`POST Status: ${res.statusCode}`);
            res.on('data', (d) => {
                console.log(`POST Response: ${d}`);
            });
            if (res.statusCode === 202) {
                resolve();
            } else {
                reject(new Error(`POST failed with ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

test();
