import ipaddr from "ipaddr.js";
import dns from "dns";
import { promisify } from "util";
import { URL } from "url";

const lookup = promisify(dns.lookup);

export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  // Protocol validation
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid protocol: must be http or https");
  }

  // Hostname validation
  let hostname = url.hostname;

  // Remove brackets from IPv6 for ipaddr.js if present
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  let ip = null;

  // Check if hostname is an IP address
  if (ipaddr.isValid(hostname)) {
    ip = ipaddr.parse(hostname);
    if (isPrivateIp(ip)) {
      throw new Error(`Access to private IP address ${hostname} is denied`);
    }
  } else {
    // Resolve hostname to IP
    try {
      // dns.lookup uses the OS resolver (like getaddrinfo)
      const { address } = await lookup(hostname);
      if (ipaddr.isValid(address)) {
        ip = ipaddr.parse(address);
        // Check if the resolved IP is private
        if (isPrivateIp(ip)) {
           throw new Error(`Hostname ${hostname} resolved to private IP ${address}`);
        }
      }
    } catch (e) {
        // If specific error about private IP, rethrow
        if (e.message.includes("resolved to private IP")) throw e;

        // If DNS lookup fails, we can't verify safety.
        // It's safer to block if we can't resolve, or just let it fail naturally?
        // If we block, we might block flaky DNS.
        // But preventing SSRF usually requires being strict.
        // However, standard fetcher behavior usually is "try to fetch".
        // If I throw here, I change behavior for non-existent domains from "browser error" to "validation error".
        // This is acceptable for security.
        throw new Error(`DNS lookup failed for ${hostname}: ${e.message}`);
    }
  }

  return true;
}

function isPrivateIp(ip) {
  const range = ip.range();

  // Ranges to block
  const blockedRanges = [
    "private",
    "loopback",
    "linkLocal",
    "uniqueLocal",
    "unspecified",
    "reserved",
    "broadcast",
    "multicast"
  ];

  // IPv4 Mapped IPv6 addresses (::ffff:127.0.0.1) need to be unmapped and checked
  if (range === "ipv4Mapped") {
      const ipv4 = ip.toIPv4Address();
      return isPrivateIp(ipv4);
  }

  return blockedRanges.includes(range);
}
