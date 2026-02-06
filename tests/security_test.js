import assert from 'node:assert';
import { validateUrl } from '../src/core/security.js';

async function runTests() {
  console.log('🛡️ Starting Security Tests...');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name} Passed`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name} Failed: ${error.message}`);
      failed++;
    }
  }

  // Allowed URLs
  await test('Valid Public URL (Google)', async () => {
    const valid = await validateUrl('https://google.com');
    assert.strictEqual(valid, true);
  });

  await test('Valid Public URL (Example.com)', async () => {
    const valid = await validateUrl('http://example.com');
    assert.strictEqual(valid, true);
  });

  // Blocked Local IPs
  await test('Block Localhost (Hostname)', async () => {
    await assert.rejects(
      () => validateUrl('http://localhost:3000'),
      (err) => err.message.includes('loopback')
    );
  });

  await test('Block Localhost (IPv4)', async () => {
    await assert.rejects(
      () => validateUrl('http://127.0.0.1'),
      (err) => err.message.includes('loopback')
    );
  });

  await test('Block Localhost (IPv6)', async () => {
    await assert.rejects(
      () => validateUrl('http://[::1]'),
      (err) => err.message.includes('loopback')
    );
  });

  await test('Block Localhost (Short IPv4)', async () => {
    // 127.1 expands to 127.0.0.1 in many resolvers, or is invalid.
    // If it resolves, it should be blocked.
    try {
        await validateUrl('http://127.1');
        throw new Error('Should have failed');
    } catch (err) {
        if (!err.message.includes('loopback') && !err.message.includes('DNS lookup failed')) {
            throw new Error(`Unexpected error: ${err.message}`);
        }
    }
  });

  // Block Private Ranges
  await test('Block Private 10.x.x.x', async () => {
    await assert.rejects(
      () => validateUrl('http://10.0.0.1'),
      (err) => err.message.includes('private')
    );
  });

  await test('Block Private 192.168.x.x', async () => {
    await assert.rejects(
      () => validateUrl('http://192.168.1.1'),
      (err) => err.message.includes('private')
    );
  });

  await test('Block Private 172.16.x.x', async () => {
    await assert.rejects(
      () => validateUrl('http://172.16.0.1'),
      (err) => err.message.includes('private')
    );
  });

  // Block AWS Metadata
  await test('Block AWS Metadata', async () => {
    await assert.rejects(
      () => validateUrl('http://169.254.169.254'),
      (err) => err.message.includes('linkLocal')
    );
  });

  // Block 0.0.0.0
  await test('Block 0.0.0.0', async () => {
    await assert.rejects(
      () => validateUrl('http://0.0.0.0'),
      (err) => err.message.includes('unspecified')
    );
  });

  // Protocol Checks
  await test('Block file:// protocol', async () => {
    await assert.rejects(
      () => validateUrl('file:///etc/passwd'),
      (err) => err.message.includes('protocol')
    );
  });

  await test('Block ftp:// protocol', async () => {
    await assert.rejects(
      () => validateUrl('ftp://example.com'),
      (err) => err.message.includes('protocol')
    );
  });

  // IPv6 Checks
  await test('Block IPv6 Unique Local', async () => {
    await assert.rejects(
      () => validateUrl('http://[fc00::1]'),
      (err) => err.message.includes('uniqueLocal')
    );
  });

  await test('Block IPv4 Mapped IPv6 (Loopback)', async () => {
    await assert.rejects(
      () => validateUrl('http://[::ffff:127.0.0.1]'),
      (err) => err.message.includes('loopback')
    );
  });

  await test('Block IPv4 Mapped IPv6 (Private)', async () => {
    await assert.rejects(
      () => validateUrl('http://[::ffff:10.0.0.1]'),
      (err) => err.message.includes('private')
    );
  });

  console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests();
