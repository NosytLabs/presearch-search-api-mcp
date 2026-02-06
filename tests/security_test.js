import { expect } from 'chai';
import { validateUrl } from '../src/core/security.js';

describe('Security: URL Validation', function() {
  this.timeout(10000); // DNS lookups might take time

  it('should allow valid public URLs', async () => {
    await validateUrl('https://www.google.com');
    await validateUrl('http://example.com');
  });

  it('should reject non-http/https protocols', async () => {
    try {
      await validateUrl('ftp://example.com');
      throw new Error('Should have failed');
    } catch (e) {
      expect(e.message).to.include('Invalid protocol');
    }

    try {
      await validateUrl('file:///etc/passwd');
      throw new Error('Should have failed');
    } catch (e) {
      expect(e.message).to.include('Invalid protocol');
    }
  });

  it('should reject private IPv4 addresses', async () => {
    const privateIps = [
      'http://127.0.0.1',
      'http://10.0.0.1',
      'http://192.168.1.1',
      'http://172.16.0.1',
      'http://169.254.169.254'
    ];

    for (const url of privateIps) {
      try {
        await validateUrl(url);
        throw new Error(`Should have failed for ${url}`);
      } catch (e) {
        expect(e.message).to.include('Access to private IP address');
      }
    }
  });

  it('should reject private IPv6 addresses', async () => {
    const privateIps = [
      'http://[::1]',
      'http://[fc00::1]',
      'http://[fe80::1]'
    ];

    for (const url of privateIps) {
      try {
        await validateUrl(url);
        throw new Error(`Should have failed for ${url}`);
      } catch (e) {
        expect(e.message).to.include('Access to private IP address');
      }
    }
  });

  it('should reject localhost', async () => {
    try {
      await validateUrl('http://localhost');
      throw new Error('Should have failed for localhost');
    } catch (e) {
      // Could be "Access to private IP" (if 127.0.0.1 parsed directly?) No, localhost needs resolution.
      // So it should be "resolved to private IP"
      expect(e.message).to.match(/resolved to private IP|Access to private IP/);
    }
  });

  it('should reject domains resolving to private IPs (DNS Rebinding protection check)', async () => {
    // Using nip.io to resolve to loopback
    const url = 'http://127.0.0.1.nip.io';
    try {
      await validateUrl(url);
      throw new Error(`Should have failed for ${url}`);
    } catch (e) {
      expect(e.message).to.include('resolved to private IP');
    }
  });
});
