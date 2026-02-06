import { URL } from 'url';
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

export class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Validates a URL to prevent SSRF attacks.
 * Checks protocol, resolves hostname, and validates IP against private ranges.
 *
 * @param {string} urlString - The URL to validate
 * @returns {Promise<string>} - The validated URL
 * @throws {SecurityError} - If the URL is invalid or points to a forbidden IP
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new SecurityError('Invalid URL format');
  }

  // 1. Protocol Check
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SecurityError('Invalid protocol. Only http and https are allowed.');
  }

  // 2. DNS Resolution
  const hostname = url.hostname;

  // If hostname is already an IP, we can skip lookup or validate directly.
  // ipaddr.isValid can check if it is a valid IP string.
  if (ipaddr.isValid(hostname)) {
    if (isIpBlocked(hostname)) {
      throw new SecurityError(`Access denied to restricted IP: ${hostname}`);
    }
    return urlString;
  }

  let addresses;
  try {
    // Resolve all IPv4 and IPv6 addresses
    // Add 5s timeout to prevent hanging
    addresses = await Promise.race([
      dns.lookup(hostname, { all: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 5000))
    ]);
  } catch {
    // If DNS resolution fails, we can't visit it anyway, but it might be safe to let Puppeteer try and fail.
    // However, blocking here is safer if the error is due to some local resolution issue.
    // But legitimate sites might fail lookup if network is flaky.
    // For SSRF protection, we assume if we can't resolve it, we shouldn't allow it,
    // OR we rely on the fact that if we can't resolve it, we don't know the IP so we can't block it.
    // BUT, if we can't resolve it, Puppeteer might fetch it if it resolves differently?
    // Safer to throw.
    throw new SecurityError(`DNS resolution failed for ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new SecurityError(`No IP addresses found for ${hostname}`);
  }

  // 3. IP Validation
  for (const addr of addresses) {
    const ip = addr.address;
    if (isIpBlocked(ip)) {
      throw new SecurityError(`Access denied to restricted IP: ${ip}`);
    }
  }

  return urlString;
}

/**
 * Checks if an IP address is blocked (private, reserved, etc.)
 * @param {string} ip - The IP address to check
 * @returns {boolean} - True if blocked, false otherwise
 */
function isIpBlocked(ip) {
  try {
    const parsedIp = ipaddr.parse(ip);

    // Check if it's a private IP (IPv4 or IPv6)
    const range = parsedIp.range();

    if (range === 'private' ||
        range === 'loopback' ||
        range === 'uniqueLocal' ||
        range === 'linkLocal' ||
        range === 'reserved' ||
        range === 'broadcast' ||
        range === 'carrierGradeNat' ||
        range === 'unspecified' ||
        range === 'multicast') {
      return true;
    }

    // Special checks for IPv4 mapped IPv6 addresses
    if (parsedIp.kind() === 'ipv6' && parsedIp.isIPv4MappedAddress()) {
      const ipv4 = parsedIp.toIPv4Address();
      const ipv4Range = ipv4.range();
      if (ipv4Range === 'private' ||
          ipv4Range === 'loopback' ||
          ipv4Range === 'linkLocal' ||
          ipv4Range === 'reserved' ||
          ipv4Range === 'broadcast' ||
          ipv4Range === 'carrierGradeNat' ||
          ipv4Range === 'unspecified' ||
          ipv4Range === 'multicast') {
        return true;
      }
    }

    return false;
  } catch {
    // If IP cannot be parsed, block it for safety
    return true;
  }
}
