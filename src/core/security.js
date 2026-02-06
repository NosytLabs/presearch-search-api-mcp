import dns from 'dns';
import ipaddr from 'ipaddr.js';
import { URL } from 'url';

/**
 * Validates a URL for security compliance (SSRF protection).
 * checks protocol and ensures the resolved IP is not in a restricted range.
 *
 * @param {string} urlString - The URL to validate.
 * @returns {Promise<boolean>} - Resolves to true if valid, throws error otherwise.
 */
export async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid protocol: only http and https are allowed');
  }

  const hostname = url.hostname;

  // Basic hostname check to fail fast on localhost (though DNS would catch it too usually)
  // This helps catch explicit "localhost" which might resolve differently depending on /etc/hosts
  if (hostname === 'localhost') {
       throw new Error('Access to localhost is blocked');
  }

  // Resolve hostname with timeout
  let lookupResult;
  let timer;
  try {
    const lookupPromise = dns.promises.lookup(hostname);
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('DNS lookup timeout')), 5000);
    });
    lookupResult = await Promise.race([lookupPromise, timeoutPromise]);
  } catch (err) {
    throw new Error(`DNS lookup failed for ${hostname}: ${err.message}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  const ip = lookupResult.address;

  if (!ip) {
      throw new Error('Could not resolve IP address');
  }

  try {
      if (ipaddr.IPv4.isValid(ip)) {
          const addr = ipaddr.IPv4.parse(ip);
          const range = addr.range();

          // Block private, loopback, linkLocal, etc.
          // 'private' covers 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
          // 'loopback' covers 127.0.0.0/8
          // 'linkLocal' covers 169.254.0.0/16
          // 'carrierGradeNat' covers 100.64.0.0/10
          if (['private', 'loopback', 'linkLocal', 'carrierGradeNat', 'broadcast', 'reserved'].includes(range)) {
               throw new Error(`Access to ${range} IP address ${ip} is blocked`);
          }

           // Explicitly check for 0.0.0.0/8 as 'unspecified' or similar might not cover it fully in all contexts
           // 0.0.0.0/8 is "Current network", creating valid sockets on Linux
           if (addr.match(ipaddr.IPv4.parseCIDR("0.0.0.0/8"))) {
              throw new Error(`Access to 0.0.0.0/8 IP address ${ip} is blocked`);
          }

      } else if (ipaddr.IPv6.isValid(ip)) {
          const addr = ipaddr.IPv6.parse(ip);
          const range = addr.range();
           // 'uniqueLocal' is fc00::/7 (private IPv6)
           // 'loopback' is ::1
           // 'linkLocal' is fe80::/10
           // 'unspecified' is ::
           if (['uniqueLocal', 'loopback', 'linkLocal', 'reserved', 'unspecified'].includes(range)) {
               throw new Error(`Access to ${range} IPv6 address ${ip} is blocked`);
          }

          // Block IPv4 mapped IPv6 addresses if they map to private IPv4
          if (addr.isIPv4MappedAddress()) {
              const ipv4 = addr.toIPv4Address();
               const rangev4 = ipv4.range();
                if (['private', 'loopback', 'linkLocal', 'carrierGradeNat', 'broadcast', 'reserved'].includes(rangev4)) {
                   throw new Error(`Access to mapped ${rangev4} IP address ${ip} is blocked`);
              }
          }
      } else {
          throw new Error('Invalid IP address format returned from DNS lookup');
      }
  } catch (parseError) {
      throw new Error(`IP validation failed: ${parseError.message}`);
  }

  return true;
}
