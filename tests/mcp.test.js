/**
 * MCP integration tests for Presearch MCP server
 *
 * This test suite verifies:
 * - tools/list returns expected tool registrations
 * - tools/call health_check succeeds (API key configured on the server)
 * - tools/call export_results returns data for query "smithery"
 * - tools/call cache_stats returns statistics (non-auth-dependent)
 *
 * Defaults to localhost:8088 (current consolidated container mapping).
 * Override with MCP_PORT or MCP_BASE_URL if needed.
 * For Smithery.ai compatibility, set MCP_PORT=8081 when your server listens on 8081.
 */

import assert from 'node:assert';

const DEFAULT_PORT = 8088; // current consolidated container uses 8088->8081
const PORT = Number(process.env.MCP_PORT || process.env.PORT || DEFAULT_PORT);
const BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;

async function runJsonRpc(method, params = {}, id = Math.random().toString(36).slice(2)) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

  const res = await fetch(`${BASE_URL}/mcp`, { method: 'POST', headers, body });
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  if (ct.includes('application/json')) {
    try {
      const json = JSON.parse(raw);
      return { transport: 'json', json, raw };
    } catch (e) {
      throw new Error(`Failed to parse JSON response: ${e.message}\nRaw: ${raw}`);
    }
  }

  // Handle SSE (Server-Sent Events) responses
  if (ct.includes('text/event-stream') || raw.startsWith('event:')) {
    const messages = parseSSE(raw);
    const last = messages[messages.length - 1] || null;
    return { transport: 'sse', messages, last, raw };
  }

  // Fallback: try JSON parse, then SSE parse
  try {
    const json = JSON.parse(raw);
    return { transport: 'json', json, raw };
  } catch (_) {
    const messages = parseSSE(raw);
    const last = messages[messages.length - 1] || null;
    return { transport: 'sse', messages, last, raw };
  }
}

function parseSSE(text) {
  const chunks = text.split('\n\n').filter(Boolean);
  const messages = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const dataLines = lines
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    for (const dl of dataLines) {
      try {
        messages.push(JSON.parse(dl));
      } catch (_) {
        // ignore non-JSON data lines
      }
    }
  }
  return messages;
}

function extractResultEnvelope(resp) {
  if (resp.transport === 'json') return resp.json;
  if (resp.transport === 'sse') return resp.last || {};
  return {};
}

async function assertToolsList() {
  const resp = await runJsonRpc('tools/list', {} , 'tools-list');
  const env = extractResultEnvelope(resp);
  const tools = env?.result?.tools;

  assert(tools && Array.isArray(tools), 'tools/list should return an array of tools');
  const names = tools.map((t) => t.name);
  const expected = ['health_check', 'export_results', 'scrape_content', 'cache_stats', 'cache_clear', 'search'];
  for (const name of expected) {
    assert(
      names.includes(name),
      `tools/list missing expected tool: ${name}. Got: ${names.join(', ')}`
    );
  }
  console.log('✓ tools/list returned expected tools:', names.join(', '));
}

async function assertHealthCheck() {
  const resp = await runJsonRpc('tools/call', { name: 'health_check', arguments: {} }, 'health-check');
  const env = extractResultEnvelope(resp);
  const text = env?.result?.content?.[0]?.text || '';

  assert(text.length > 0, 'health_check response should contain text content');
  assert(/Health Check/i.test(text), 'health_check should include "Health Check"');
  assert(!/Failed/i.test(text), `health_check indicates failure: ${text}`);
  console.log('✓ health_check passed');
}

async function assertExportResults() {
  const args = {
    query: 'smithery',
    ip: '8.8.8.8',
    format: 'json',
    count: 3,
    country: 'US',
  };
  const resp = await runJsonRpc('tools/call', { name: 'export_results', arguments: args }, 'export-results');
  const env = extractResultEnvelope(resp);
  const text = env?.result?.content?.[0]?.text || '';

  assert(text.length > 0, 'export_results response should contain text content');
  assert(/Exported/i.test(text), 'export_results should include "Exported"');
  assert(/JSON/i.test(text), 'export_results should indicate JSON format');
  console.log('✓ export_results returned JSON export for query "smithery"');
}

async function assertCacheStats() {
  const resp = await runJsonRpc('tools/call', { name: 'cache_stats', arguments: {} }, 'cache-stats');
  const env = extractResultEnvelope(resp);
  const text = env?.result?.content?.[0]?.text || '';

  assert(text.length > 0, 'cache_stats response should contain text content');
  assert(/Cache Statistics/i.test(text), 'cache_stats should include "Cache Statistics"');
  console.log('✓ cache_stats returned statistics');
}

async function main() {
  console.log(`MCP base: ${BASE_URL}`);
  await assertToolsList();
  await assertHealthCheck();
  await assertExportResults();
  await assertCacheStats();
  console.log('\nAll MCP tests passed.');
}

main().catch((err) => {
  console.error('MCP test failure:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});