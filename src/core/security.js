import ipaddr from 'ipaddr.js';
import dns from 'node:dns/promises';
import { URL } from 'node:url';
import logger from './logger.js';

/**
 * Validates a URL to ensure it is safe to visit.
 * Checks for:
 * 1. Valid protocol (http/https)
 * 2. Valid IP address (not private, loopback, or reserved)
 *
 * @param {string} urlString - The URL to validate
 * @returns {Promise<boolean>} - True if valid, throws error if invalid
 */
export async function validateUrl(urlString) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  // 1. Protocol Validation
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
  }

  let hostname = parsedUrl.hostname;

  // Remove brackets from IPv6 literals for validation
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // 2. IP Address Validation (SSRF Protection)
  let ipAddresses = [];

  // Check if hostname is already an IP
  if (ipaddr.isValid(hostname)) {
    ipAddresses.push(hostname);
  } else {
    try {
      // Resolve DNS
      // We resolve all addresses to check them all
      const addresses = await dns.lookup(hostname, { all: true });
      ipAddresses = addresses.map(addr => addr.address);
    } catch (error) {
       throw new Error(`DNS lookup failed for ${hostname}: ${error.message}`);
    }
  }

  if (ipAddresses.length === 0) {
     throw new Error(`No IP addresses resolved for ${hostname}`);
  }

  for (const ip of ipAddresses) {
    if (!ipaddr.isValid(ip)) {
        continue;
    }

    let addr = ipaddr.parse(ip);

    // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    const range = addr.range();

    const blockedRanges = [
      'loopback',        // 127.0.0.0/8, ::1
      'private',         // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      'uniqueLocal',     // fc00::/7 (IPv6 private)
      'linkLocal',       // 169.254.0.0/16, fe80::/10
      'reserved',        // 240.0.0.0/4 etc
      'multicast',       // 224.0.0.0/4, ff00::/8
      'broadcast',       // 255.255.255.255
      'carrierGradeNat', // 100.64.0.0/10
      'unspecified'      // 0.0.0.0, ::
    ];

    if (blockedRanges.includes(range)) {
       logger.warn(`Blocked SSRF attempt to ${range} IP: ${ip} for URL: ${urlString}`);
       throw new Error(`Access to ${range} IP address ${ip} is forbidden.`);
    }
  }

  return true;
}
