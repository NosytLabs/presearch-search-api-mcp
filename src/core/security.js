import ipaddr from 'ipaddr.js';
import dns from 'dns/promises';

/**
 * Validates a URL to ensure it uses a safe protocol and does not resolve to a private/local IP address.
 * @param {string} urlString - The URL to validate.
 * @throws {Error} If the URL is invalid, has an unsafe protocol, or resolves to a blocked IP.
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid protocol: Only http and https are allowed');
  }

  const hostname = url.hostname;

  // If hostname is an IP literal, validate it directly
  if (ipaddr.isValid(hostname)) {
    validateIp(hostname);
    return;
  }

  // Resolve hostname
  // We check both IPv4 and IPv6 to ensure safety
  const ips = [];
  try {
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    if (v4.status === 'fulfilled') ips.push(...v4.value);
    if (v6.status === 'fulfilled') ips.push(...v6.value);

    // If we have no IPs but no hard errors (e.g. both just empty or failed resolution due to ENODATA/ENOTFOUND),
    // we can assume the domain is not reachable, but to be safe we might want to block it or let it fail.
    // If both failed, it usually means the domain doesn't exist.
    if (ips.length === 0) {
         // If DNS resolution fails completely, we cannot validate.
         // In a security context, fail closed is safer, but if the domain doesn't exist, page.goto will fail anyway.
         // However, we want to prevent cases where internal DNS works but public doesn't?
         // We will throw if no IPs found.
         throw new Error(`Could not resolve hostname: ${hostname}`);
    }

  } catch (error) {
    throw new Error(`DNS resolution failed for ${hostname}: ${error.message}`);
  }

  for (const ip of ips) {
    validateIp(ip);
  }
}

function validateIp(ip) {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // Block private ranges
    const blockedRanges = [
      'unspecified',
      'loopback',
      'private',
      'linkLocal',
      'reserved',
      'broadcast',
      'multicast',
      'uniqueLocal',
      // 'carrierGradeNat' // 100.64.0.0/10, often used by ISPs, might be safe but usually not relevant for public web?
      // ipaddr.js might return 'private' for some of these.
    ];

    if (blockedRanges.includes(range)) {
      throw new Error(`Blocked IP range: ${range} (${ip})`);
    }

    // Check for IPv4 mapped IPv6 addresses which might hide private IPv4
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      const ipv4 = addr.toIPv4Address();
      if (blockedRanges.includes(ipv4.range())) {
        throw new Error(`Blocked IP range (mapped): ${ipv4.range()} (${ip})`);
      }
    }
  } catch (error) {
    // If validateIp logic throws (e.g. Blocked IP), rethrow.
    // If ipaddr.parse fails, it's invalid IP.
    throw error;
  }
}
