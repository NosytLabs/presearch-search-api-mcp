import { URL } from "url";
import dns from "dns";
import ipaddr from "ipaddr.js";

/**
 * Validates a URL to ensure it's safe to request.
 * Checks for:
 * - Valid protocol (http/https)
 * - Valid hostname
 * - Non-private/restricted IP addresses (SSRF protection)
 *
 * @param {string} urlString - The URL to validate
 * @returns {Promise<string>} - The validated URL
 * @throws {Error} - If the URL is invalid or unsafe
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  // 1. Protocol validation
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(
      `Invalid protocol: ${url.protocol}. Only http and https are allowed.`,
    );
  }

  // 2. Hostname validation
  const hostname = url.hostname;
  if (!hostname) {
    throw new Error("Missing hostname");
  }

  // 3. DNS resolution and IP validation
  try {
    // Resolve hostname to IP address
    // Use dns.promises if available or promisify, but dns.promises is standard in modern Node.
    const { address } = await dns.promises.lookup(hostname);

    if (!address) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }

    if (!ipaddr.isValid(address)) {
        throw new Error(`Invalid IP address resolved: ${address}`);
    }

    const addr = ipaddr.parse(address);
    const range = addr.range();

    const restrictedRanges = [
      "loopback",
      "private",
      "linkLocal",
      "multicast",
      "broadcast",
      "reserved",
      "carrierGradeNat",
      "uniqueLocal", // IPv6 private
      "unspecified", // 0.0.0.0 or ::
    ];

    if (restrictedRanges.includes(range)) {
      throw new Error(`Restricted IP address: ${address} (${range})`);
    }

    // Handle IPv4-mapped IPv6 addresses
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      const ipv4 = addr.toIPv4Address();
      const range4 = ipv4.range();
      if (restrictedRanges.includes(range4)) {
        throw new Error(
          `Restricted IP address: ${address} -> ${ipv4.toString()} (${range4})`,
        );
      }
    }
  } catch (error) {
    // Propagate our own errors
    if (error.message.startsWith("Restricted") || error.message.startsWith("Invalid")) {
      throw error;
    }
    // Handle DNS errors
    if (error.code === "ENOTFOUND") {
      throw new Error(`Hostname not found: ${hostname}`);
    }
    throw error;
  }

  return urlString;
}
