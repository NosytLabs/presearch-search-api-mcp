import dns from 'node:dns/promises';
import { URL } from 'node:url';
import ipaddr from 'ipaddr.js';

/**
 * Validates a URL to ensure it's safe to request.
 * Enforces:
 * - http/https protocol
 * - DNS resolution
 * - No private/internal IP addresses
 *
 * @param {string} urlString - The URL to validate
 * @returns {Promise<string>} - The validated URL
 * @throws {Error} - If the URL is invalid or unsafe
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  // 1. Protocol Validation
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Blocked restricted protocol: ${url.protocol}`);
  }

  // 2. DNS Resolution & IP Validation
  // We resolve the hostname to ensure it doesn't point to a local/private IP.
  // Note: There is still a Time-of-Check to Time-of-Use (TOCTOU) race condition possible here,
  // preventing that completely requires network-level isolation or proxying,
  // but this blocks the vast majority of naive SSRF attempts.

  try {
    // lookup returns the first IP found.
    // For robust security, one might want to check all returned IPs, but standard practice usually checks the first resolved.
    const { address } = await dns.lookup(url.hostname);

    if (!address) {
        throw new Error(`Could not resolve hostname: ${url.hostname}`);
    }

    const ip = ipaddr.parse(address);
    const range = ip.range();

    // Block restricted ranges
    const restrictedRanges = [
      'private',
      'uniqueLocal',
      'loopback',
      'unspecified',
      'multicast',
      'linkLocal',
      'carrierGradeNat',
      'reserved'
    ];

    if (restrictedRanges.includes(range)) {
      throw new Error(`Blocked access to restricted IP range (${range}): ${address}`);
    }

    // Explicitly check for IPv4 mapped IPv6 addresses that might map to private ranges if not caught above
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address();
        if (restrictedRanges.includes(ipv4.range())) {
            throw new Error(`Blocked access to restricted IP range (IPv4-mapped ${ipv4.range()}): ${address}`);
        }
    }

  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error(`DNS lookup failed for ${url.hostname}`);
    }
    // Re-throw if it's our security error or other system error
    throw error;
  }

  return urlString;
}
