import dns from 'dns/promises';
import { URL } from 'url';
import ipaddr from 'ipaddr.js';

/**
 * Validates a URL to ensure it is safe to request.
 * Checks protocol and resolves DNS to ensure the IP is not private/restricted.
 *
 * @param {string} urlString The URL to validate
 * @returns {Promise<boolean>} True if valid, throws Error if invalid
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  // 1. Protocol Check
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid protocol: ${url.protocol}. Only http and https are allowed.`);
  }

  // 2. DNS Resolution & IP Check
  let address;
  try {
    // Resolve hostname to IP
    // Use a timeout to prevent hanging lookups
    const lookupPromise = dns.lookup(url.hostname);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DNS lookup timeout')), 5000)
    );

    const result = await Promise.race([lookupPromise, timeoutPromise]);
    address = result.address;
  } catch (error) {
    throw new Error(`DNS lookup failed for ${url.hostname}: ${error.message}`);
  }

  // 3. IP Validation
  if (!isValidIp(address)) {
    throw new Error(`Access denied to restricted IP: ${address} (${url.hostname})`);
  }

  return true;
}

/**
 * Checks if an IP address is valid and not in a restricted range.
 * @param {string} ip The IP address to check
 * @returns {boolean} True if the IP is public/safe
 */
function isValidIp(ip) {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // Block private, loopback, and other restricted ranges
    const restrictedRanges = [
      'private',
      'loopback',
      'uniqueLocal',
      'linkLocal',
      'unspecified',
      'multicast',
      'broadcast',
      'reserved'
    ];

    if (restrictedRanges.includes(range)) {
      return false;
    }

    // Additional check for IPv4 mapped IPv6 addresses if needed,
    // but ipaddr.js handles conversion or we can check the underlying IPv4.
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      const ipv4 = addr.toIPv4Address();
      const ipv4Range = ipv4.range();
      if (restrictedRanges.includes(ipv4Range)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // If IP parsing fails, consider it invalid for safety
    return false;
  }
}
