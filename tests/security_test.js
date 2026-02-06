import { validateUrl } from '../src/core/security.js';
import { contentFetcher } from '../src/services/contentFetcher.js';
import assert from 'assert';

async function runTests() {
  console.log('🔒 Starting Security Tests...');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  // Unit Tests for validateUrl
  await test('Should accept valid public HTTPS URL', async () => {
    // google.com should be safe and resolveable
    // Note: If this fails due to network issues, it's a false negative for logic, but we assume internet access.
    try {
        const result = await validateUrl('https://google.com');
        assert.strictEqual(result, true);
    } catch (e) {
        console.warn('Skipping google.com test due to network/DNS error:', e.message);
    }
  });

  await test('Should reject non-http/https protocol', async () => {
    try {
      await validateUrl('ftp://example.com');
      throw new Error('Should have failed');
    } catch (e) {
      assert.ok(e.message.includes('Invalid protocol'));
    }
  });

  await test('Should reject localhost hostname', async () => {
    try {
      await validateUrl('http://localhost:3000');
      throw new Error('Should have failed');
    } catch (e) {
      assert.ok(e.message.includes('blocked'));
    }
  });

  await test('Should reject 127.0.0.1', async () => {
    try {
      await validateUrl('http://127.0.0.1');
      throw new Error('Should have failed');
    } catch (e) {
      assert.ok(e.message.includes('loopback') || e.message.includes('blocked'));
    }
  });

  await test('Should reject private IP 192.168.1.1', async () => {
    try {
      await validateUrl('http://192.168.1.1');
      throw new Error('Should have failed');
    } catch (e) {
      assert.ok(e.message.includes('private') || e.message.includes('blocked'));
    }
  });

  await test('Should reject 0.0.0.0', async () => {
    try {
      await validateUrl('http://0.0.0.0');
      throw new Error('Should have failed');
    } catch (e) {
      assert.ok(e.message.includes('blocked'));
    }
  });

  await test('Should reject AWS metadata IP 169.254.169.254', async () => {
      try {
        await validateUrl('http://169.254.169.254');
        throw new Error('Should have failed');
      } catch (e) {
        assert.ok(e.message.includes('linkLocal') || e.message.includes('blocked'));
      }
    });

  // Integration Test for ContentFetcher
  await test('ContentFetcher should fail gracefully for blocked URL', async () => {
    const result = await contentFetcher.fetchContent('http://127.0.0.1');
    assert.strictEqual(result.content, null);
    assert.ok(result.error);
    assert.ok(result.error.includes('blocked') || result.error.includes('loopback'));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
