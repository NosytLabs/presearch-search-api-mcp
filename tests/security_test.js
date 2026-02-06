import { test } from 'node:test';
import assert from 'node:assert';
import { validateUrl } from '../src/core/security.js';

test('Security: validateUrl', async (t) => {
  await t.test('should pass for valid public URLs', async () => {
    // Attempt to validate a known public domain.
    try {
        await validateUrl('https://example.com');
        assert.ok(true, 'Should accept public URL');
    } catch (e) {
        // Network errors are possible in sandbox, but we shouldn't get "Access denied"
        if (e.message.includes('Access denied')) {
            assert.fail(`Blocked public IP: ${e.message}`);
        }
    }
  });

  await t.test('should fail for localhost', async () => {
    await assert.rejects(
      async () => validateUrl('http://localhost:3000'),
      (err) => err.message.includes('Access denied') || err.message.includes('restricted IP')
    );
  });

  await t.test('should fail for 127.0.0.1', async () => {
    await assert.rejects(
      async () => validateUrl('http://127.0.0.1'),
      (err) => err.message.includes('Access denied') || err.message.includes('restricted IP')
    );
  });

  await t.test('should fail for 0.0.0.0', async () => {
    await assert.rejects(
      async () => validateUrl('http://0.0.0.0'),
      (err) => err.message.includes('Access denied') || err.message.includes('restricted IP')
    );
  });

  await t.test('should fail for private IPv4', async () => {
    await assert.rejects(
      async () => validateUrl('http://192.168.1.1'),
      (err) => err.message.includes('Access denied') || err.message.includes('restricted IP')
    );
    await assert.rejects(
      async () => validateUrl('http://10.0.0.1'),
      (err) => err.message.includes('Access denied') || err.message.includes('restricted IP')
    );
  });

  await t.test('should fail for invalid protocol', async () => {
    await assert.rejects(
      async () => validateUrl('ftp://example.com'),
      (err) => err.message.includes('Invalid protocol')
    );
    await assert.rejects(
      async () => validateUrl('file:///etc/passwd'),
      (err) => err.message.includes('Invalid protocol')
    );
  });

  // Note: IPv4-mapped IPv6 [::ffff:127.0.0.1] handling depends on OS/Node support in dns.lookup
  // But our isIpBlocked logic handles it if parsed correctly.
});
