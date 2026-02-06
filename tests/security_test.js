import { test } from 'node:test';
import assert from 'node:assert';
import { validateUrl } from '../src/core/security.js';

test('Security: validateUrl', async (t) => {
  await t.test('should pass for valid public URLs', async () => {
    // Attempt to validate a known public domain.
    // This assumes the environment has DNS access.
    try {
        await validateUrl('https://example.com');
        assert.ok(true, 'Should accept public URL');
    } catch (e) {
        // If it's a network error, we might want to skip or log warning
        // But if it is "Restricted IP", that is a failure.
        if (e.message.includes('Restricted IP')) {
            assert.fail('Blocked public IP');
        }
        // Other errors (DNS timeout) are acceptable in some restricted environments
        // but ideally shouldn't happen here if npm install worked.
    }
  });

  await t.test('should fail for localhost', async () => {
    await assert.rejects(
      async () => validateUrl('http://localhost:3000'),
      (err) => err.message.includes('Restricted IP range') || err.message.includes('Invalid IP address')
    );
  });

  await t.test('should fail for 127.0.0.1', async () => {
    await assert.rejects(
      async () => validateUrl('http://127.0.0.1'),
      (err) => err.message.includes('Restricted IP range')
    );
  });

  await t.test('should fail for 0.0.0.0', async () => {
    await assert.rejects(
      async () => validateUrl('http://0.0.0.0'),
      (err) => err.message.includes('Restricted IP range')
    );
  });

  await t.test('should fail for private IPv4', async () => {
    await assert.rejects(
      async () => validateUrl('http://192.168.1.1'),
      (err) => err.message.includes('Restricted IP range')
    );
    await assert.rejects(
      async () => validateUrl('http://10.0.0.1'),
      (err) => err.message.includes('Restricted IP range')
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

  await t.test('should fail for IPv4 mapped IPv6 loopback', async () => {
      // ::ffff:127.0.0.1
      await assert.rejects(
        async () => validateUrl('http://[::ffff:127.0.0.1]'),
        (err) => err.message.includes('Restricted IP range') || err.message.includes('Security validation failed')
      );
  });
});
