import assert from "assert";
import dns from "dns";
import { validateUrl } from "../src/core/security.js";
import { contentFetcher } from "../src/services/contentFetcher.js";

// Mock dns.promises.lookup
const originalLookup = dns.promises.lookup;

const mockLookup = async (hostname) => {
  if (hostname === "localhost") return { address: "127.0.0.1" };
  if (hostname === "private.local") return { address: "192.168.1.1" };
  if (hostname === "public.com") return { address: "8.8.8.8" };
  if (hostname === "metadata.local") return { address: "169.254.169.254" };
  if (hostname === "ipv6.private") return { address: "fd00::1" };
  if (hostname === "ipv6.public") return { address: "2001:4860:4860::8888" };
  if (hostname === "0.0.0.0") return { address: "0.0.0.0" };
  throw new Error(`Hostname not found: ${hostname}`);
};

dns.promises.lookup = mockLookup;

async function runTests() {
  console.log("Running Security Tests...");

  try {
    // 1. Valid Public URL
    await validateUrl("http://public.com/something");
    console.log("PASS: Public URL allowed");

    // 2. Invalid Protocol
    try {
      await validateUrl("ftp://public.com/file");
      console.error("FAIL: FTP should be blocked");
      process.exit(1);
    } catch (e) {
      assert(e.message.includes("Invalid protocol"), "Wrong error for protocol");
      console.log("PASS: FTP blocked");
    }

    // 3. Localhost
    try {
      await validateUrl("http://localhost");
      console.error("FAIL: Localhost should be blocked");
      process.exit(1);
    } catch (e) {
      assert(e.message.includes("Restricted IP"), "Wrong error for localhost");
      console.log("PASS: Localhost blocked");
    }

    // 4. Private IP (192.168.x.x)
    try {
      await validateUrl("http://private.local");
      console.error("FAIL: Private IP should be blocked");
      process.exit(1);
    } catch (e) {
      assert(e.message.includes("Restricted IP"), "Wrong error for private IP");
      console.log("PASS: Private IP blocked");
    }

    // 5. Link Local (Metadata service)
    try {
      await validateUrl("http://metadata.local");
      console.error("FAIL: Metadata IP should be blocked");
      process.exit(1);
    } catch (e) {
      assert(e.message.includes("Restricted IP"), "Wrong error for link-local");
      console.log("PASS: Link-local blocked");
    }

    // 6. IPv6 Private
    try {
      await validateUrl("http://ipv6.private");
      console.error("FAIL: IPv6 Private IP should be blocked");
      process.exit(1);
    } catch (e) {
      assert(e.message.includes("Restricted IP"), "Wrong error for IPv6 private");
      console.log("PASS: IPv6 Private blocked");
    }

    // 7. IPv6 Public
    await validateUrl("http://ipv6.public");
    console.log("PASS: IPv6 Public allowed");

    // 8. Unspecified 0.0.0.0
    try {
       await validateUrl("http://0.0.0.0");
       console.error("FAIL: 0.0.0.0 should be blocked");
       process.exit(1);
    } catch (e) {
        assert(e.message.includes("Restricted IP"), "Wrong error for 0.0.0.0");
        console.log("PASS: 0.0.0.0 blocked");
    }

    // 9. Integration Test with ContentFetcher
    console.log("Testing ContentFetcher integration...");
    // We don't need to mock puppeteer launch because fetchContent calls validateUrl first.
    // However, if validateUrl succeeds, it proceeds to initBrowser which launches puppeteer.
    // We want to test FAILURE case, so puppeteer won't be launched.

    const result = await contentFetcher.fetchContent("http://localhost");
    assert(result.error, "ContentFetcher should return error");
    assert(result.error.includes("Restricted IP"), "Error message should mention restricted IP");
    assert(result.content === null, "Content should be null");
    console.log("PASS: ContentFetcher blocked invalid URL");

    console.log("All Security Tests Passed!");
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    // Restore mock (not strictly necessary for this script but good practice)
    dns.promises.lookup = originalLookup;
  }
}

runTests();
