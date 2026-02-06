import ipaddr from "ipaddr.js";
import dns from "dns";
import { promisify } from "util";

const lookup = promisify(dns.lookup);

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF).
 * Checks protocol, resolves hostname, and verifies IP is not in restricted ranges.
 * @param {string} url - The URL to validate.
 * @returns {Promise<boolean>} - Resolves to true if valid. Throws error if invalid.
 */
export async function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // 1. Validate Protocol
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
    }

    // 2. Resolve Hostname
    // If hostname is an IP, lookup returns it.
    const { address } = await lookup(parsedUrl.hostname);

    if (!address) {
      throw new Error(`Could not resolve hostname: ${parsedUrl.hostname}`);
    }

    // 3. Validate IP
    if (!ipaddr.isValid(address)) {
      throw new Error(`Invalid IP address resolved: ${address}`);
    }

    const addr = ipaddr.parse(address);
    const range = addr.range();

    // Block private and reserved ranges
    const blockedRanges = [
      "private",
      "loopback",
      "linkLocal",
      "uniqueLocal", // IPv6 private
      "reserved",
      "unspecified", // 0.0.0.0
      "broadcast",
      "carrierGradeNat",
    ];

    if (blockedRanges.includes(range)) {
      throw new Error(`Restricted IP range detected: ${range} (${address})`);
    }

    // Additional check for IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      const ipv4 = addr.toIPv4Address();
      const ipv4Range = ipv4.range();
      if (blockedRanges.includes(ipv4Range)) {
        throw new Error(
          `Restricted IP range detected (IPv4 mapped): ${ipv4Range} (${ipv4.toString()})`,
        );
      }
    }

    return true;
  } catch (error) {
    throw new Error(`Security validation failed: ${error.message}`);
  }
}
