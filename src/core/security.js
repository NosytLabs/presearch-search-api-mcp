import dns from "dns/promises";
import ipaddr from "ipaddr.js";
import { URL } from "url";
import logger from "./logger.js";

/**
 * Validates a URL to prevent SSRF attacks.
 * Checks protocol and ensures the hostname does not resolve to a private IP.
 * @param {string} urlString The URL to validate.
 * @throws {Error} If the URL is invalid or unsafe.
 */
export async function validateUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);

    // 1. Validate Protocol
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
    }

    // 2. Resolve Hostname
    const hostname = parsedUrl.hostname;
    let addresses;
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch (e) {
      throw new Error(`Failed to resolve hostname: ${hostname}`);
    }

    // 3. Validate IPs
    for (const addr of addresses) {
      const ip = addr.address;
      if (!ipaddr.isValid(ip)) {
        throw new Error(`Invalid IP address resolved: ${ip}`);
      }

      const parsedIp = ipaddr.parse(ip);
      const range = parsedIp.range();

      // Block private, loopback, linkLocal, uniqueLocal, etc.
      if (
        range === "private" ||
        range === "loopback" ||
        range === "linkLocal" ||
        range === "uniqueLocal" ||
        range === "carrierGradeNat" || // 100.64.0.0/10
        // ipaddr.js might not catch all reserved ranges by default depending on version,
        // but "private" covers 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        // "loopback" covers 127.0.0.0/8 and ::1
        ip === "0.0.0.0" || ip === "::"
      ) {
         throw new Error(`URL resolves to a restricted IP address: ${ip} (${range})`);
      }

      // Explicitly check for IPv4 mapped IPv6 addresses that might mask private IPs
      if (parsedIp.kind() === 'ipv6' && parsedIp.isIPv4MappedAddress()) {
         const ipv4 = parsedIp.toIPv4Address();
         const ipv4Range = ipv4.range();
         if (
            ipv4Range === "private" ||
            ipv4Range === "loopback" ||
            ipv4Range === "linkLocal" ||
             ipv4.toString() === "0.0.0.0"
          ) {
            throw new Error(`URL resolves to a restricted IP address (IPv4 mapped): ${ipv4.toString()} (${ipv4Range})`);
          }
      }
    }

    return true;
  } catch (error) {
    logger.error(`Security validation failed for URL ${urlString}: ${error.message}`);
    throw error;
  }
}
