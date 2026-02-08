
import { spawn } from 'child_process';
import http from 'http';
import { setTimeout } from 'timers/promises';

async function run() {
  const PORT = 3005;
  console.log(`Starting server on port ${PORT}...`);
  const serverProcess = spawn('node', ['src/index.js', `--port=${PORT}`], {
    stdio: 'pipe',
    env: { ...process.env, LOG_LEVEL: 'debug' }
  });

  serverProcess.stdout.on('data', (data) => console.log(`[SERVER] ${data.toString().trim()}`));
  serverProcess.stderr.on('data', (data) => console.error(`[SERVER ERR] ${data.toString().trim()}`));

  // Wait for server to start
  await setTimeout(3000);

  try {
    console.log("Connecting client 1...");
    const session1 = await connectSSE(PORT);
    console.log("Client 1 connected, sessionId:", session1.sessionId);

    console.log("Connecting client 2...");
    const session2 = await connectSSE(PORT);
    console.log("Client 2 connected, sessionId:", session2.sessionId);

    // Verify session IDs are different
    if (session1.sessionId === session2.sessionId) {
      throw new Error("Session IDs should be different!");
    }

    // Send a message to client 1
    await sendRPC(PORT, session1.sessionId, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" }
      }
    });
    console.log("Sent initialize to client 1");

    // Close connections
    console.log("Closing connections...");
    session1.req.destroy();
    session2.req.destroy();

    await setTimeout(1000); // Allow cleanup

    console.log("Test Passed!");
  } catch (error) {
    console.error("Test Failed:", error);
    process.exitCode = 1;
  } finally {
    serverProcess.kill();
  }
}

function connectSSE(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/sse`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status code: ${res.statusCode}`));
        return;
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        // Look for endpoint event
        // event: endpoint
        // data: /messages?sessionId=...
        const match = buffer.match(/event: endpoint\n.*data: .*sessionId=([a-zA-Z0-9-]+)/s);
        if (match) {
          resolve({ sessionId: match[1], req, res });
        }
      });
    });

    req.on('error', reject);
  });
}

async function sendRPC(port, sessionId, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: `/messages?sessionId=${sessionId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        res.pipe(process.stderr);
        reject(new Error(`POST failed with ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

run();
