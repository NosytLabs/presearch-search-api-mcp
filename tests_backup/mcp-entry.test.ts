/**
 * Tests for MCP Entry Point
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Entry Point', () => {
  let mcpProcess: ChildProcess;
  const timeout = 10000;

  afterEach(() => {
    if (mcpProcess && !mcpProcess.killed) {
      mcpProcess.kill('SIGTERM');
    }
  });

  describe('Process Startup', () => {
    it('should start MCP server process successfully', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_API_KEY: 'test-api-key',
          PRESEARCH_BASE_URL: 'https://api.presearch.io',
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let startupMessageReceived = false;

      mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('Presearch MCP Server started successfully')) {
          startupMessageReceived = true;
          done();
        }
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      mcpProcess.on('exit', (code) => {
        if (!startupMessageReceived) {
          done(new Error(`Process exited with code ${code} before startup message`));
        }
      });

      setTimeout(() => {
        if (!startupMessageReceived) {
          done(new Error('Startup timeout'));
        }
      }, timeout);
    }, timeout);

    it('should handle SIGINT gracefully', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_API_KEY: 'test-api-key',
          PRESEARCH_BASE_URL: 'https://api.presearch.io',
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let shutdownMessageReceived = false;

      mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started successfully')) {
          // Send SIGINT after startup
          mcpProcess.kill('SIGINT');
        }
        if (message.includes('shutting down gracefully')) {
          shutdownMessageReceived = true;
        }
      });

      mcpProcess.on('exit', (code) => {
        expect(code).toBe(0);
        expect(shutdownMessageReceived).toBe(true);
        done();
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        if (!shutdownMessageReceived) {
          done(new Error('Shutdown timeout'));
        }
      }, timeout);
    }, timeout);

    it('should handle missing API key gracefully', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_API_KEY: '', // Empty API key
          PRESEARCH_BASE_URL: 'https://api.presearch.io',
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let startupMessageReceived = false;

      mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started successfully')) {
          startupMessageReceived = true;
          done();
        }
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      mcpProcess.on('exit', (code) => {
        if (!startupMessageReceived && code !== 0) {
          done(new Error(`Process exited with code ${code}`));
        }
      });

      setTimeout(() => {
        if (!startupMessageReceived) {
          done(new Error('Startup timeout'));
        }
      }, timeout);
    }, timeout);
  });

  describe('MCP Protocol Communication', () => {
    it('should respond to MCP initialize request', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_API_KEY: 'test-api-key',
          PRESEARCH_BASE_URL: 'https://api.presearch.io',
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let serverReady = false;

      mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started successfully')) {
          serverReady = true;
          
          // Send MCP initialize request
          const initRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'test-client',
                version: '1.0.0',
              },
            },
          };
          
          mcpProcess.stdin?.write(JSON.stringify(initRequest) + '\n');
        }
      });

      mcpProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          try {
            const response = JSON.parse(message);
            if (response.id === 1 && response.result) {
              expect(response.result).toHaveProperty('protocolVersion');
              expect(response.result).toHaveProperty('capabilities');
              expect(response.result).toHaveProperty('serverInfo');
              done();
            }
          } catch (error) {
            // Ignore non-JSON messages
          }
        }
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        if (!serverReady) {
          done(new Error('Server startup timeout'));
        } else {
          done(new Error('MCP response timeout'));
        }
      }, timeout);
    }, timeout);

    it('should respond to tools/list request', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_API_KEY: 'test-api-key',
          PRESEARCH_BASE_URL: 'https://api.presearch.io',
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let serverReady = false;
      let initialized = false;

      mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('started successfully')) {
          serverReady = true;
          
          // Send MCP initialize request first
          const initRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'test-client',
                version: '1.0.0',
              },
            },
          };
          
          mcpProcess.stdin?.write(JSON.stringify(initRequest) + '\n');
        }
      });

      mcpProcess.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          try {
            const response = JSON.parse(message);
            
            if (response.id === 1 && !initialized) {
              initialized = true;
              
              // Send tools/list request
              const toolsRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
              };
              
              mcpProcess.stdin?.write(JSON.stringify(toolsRequest) + '\n');
            } else if (response.id === 2) {
              expect(response.result).toHaveProperty('tools');
              expect(response.result.tools).toBeArray();
              expect(response.result.tools.length).toBeGreaterThan(0);
              
              // Check for expected tools
              const toolNames = response.result.tools.map((tool: any) => tool.name);
              expect(toolNames).toContain('presearch_search');
              done();
            }
          } catch (error) {
            // Ignore non-JSON messages
          }
        }
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        done(new Error('Test timeout'));
      }, timeout);
    }, timeout);
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration and exit with error code', (done) => {
      const entryPath = path.resolve(__dirname, '../dist/mcp-entry.js');
      
      mcpProcess = spawn('node', [entryPath], {
        env: {
          ...process.env,
          PRESEARCH_BASE_URL: 'invalid-url', // Invalid URL
          LOG_LEVEL: 'error',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      mcpProcess.on('exit', (code) => {
        expect(code).toBe(1);
        done();
      });

      mcpProcess.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        done(new Error('Process should have exited with error'));
      }, timeout);
    }, timeout);
  });
});