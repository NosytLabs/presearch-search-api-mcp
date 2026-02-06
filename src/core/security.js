import ipaddr from 'ipaddr.js';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

/**
 * Validates a URL to prevent SSRF attacks.
 * Checks protocol and resolves hostname to ensure it doesn't point to private/reserved IPs.
 *
 * @param {string} url - The URL to validate
 * @returns {Promise<boolean>} - Returns true if valid, throws error if invalid
 */
export async function validateUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // 1. Protocol Validation
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid protocol: only http and https are allowed');
  }

  const hostname = parsedUrl.hostname;

  // 2. DNS Resolution
  let address;
  try {
    // dns.lookup uses the OS resolver (like ping/curl do)
    const result = await lookup(hostname);
    address = result.address;
  } catch (e) {
    throw new Error(`DNS lookup failed for ${hostname}`);
  }

  if (!ipaddr.isValid(address)) {
    throw new Error(`Invalid IP address resolved: ${address}`);
  }

  const addr = ipaddr.parse(address);

  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  let checkAddr = addr;
  if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
    checkAddr = addr.toIPv4Address();
  }

  // 3. IP Range Validation
  const range = checkAddr.range();

  // Block private and reserved ranges
  const blockedRanges = [
    'private',
    'loopback',
    'linkLocal',
    'uniqueLocal',
    'reserved',
    'broadcast',
    'carrierGradeNat',
    // 'unspecified' (0.0.0.0) is usually 'unspecified' in ipaddr.js,
    // but sometimes falls into other categories depending on implementation.
    // We explicitly check for 0.0.0.0 if range doesn't cover it.
  ];

  if (blockedRanges.includes(range)) {
    throw new Error(`Access to ${range} IP address ${address} is forbidden`);
  }

  // Explicitly block 0.0.0.0 and ::
  if (checkAddr.toNormalizedString() === '0.0.0.0' || checkAddr.toNormalizedString() === '::') {
     throw new Error(`Access to unspecified IP address ${address} is forbidden`);
  }

  return true;
}
