import { validateUrl } from "../src/core/security.js";
import { contentFetcher } from "../src/services/contentFetcher.js";
import assert from "assert";

async function runTests() {
  console.log("🔒 Starting Security Tests...");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing ${name}... `);
      await fn();
      console.log("✅ Passed");
      passed++;
    } catch (error) {
      console.log("❌ Failed");
      console.error("  " + error.message);
      failed++;
    }
  }

  // Unit tests for validateUrl
  await test("valid public URL (google.com)", async () => {
    await validateUrl("https://www.google.com");
  });

  await test("block localhost", async () => {
    try {
      await validateUrl("http://localhost");
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("restricted IP")) throw e;
    }
  });

  await test("block 127.0.0.1", async () => {
    try {
      await validateUrl("http://127.0.0.1");
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("restricted IP")) throw e;
    }
  });

  await test("block private IP (192.168.1.1)", async () => {
    try {
      await validateUrl("http://192.168.1.1");
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("restricted IP")) throw e;
    }
  });

  await test("block private IP (10.0.0.1)", async () => {
    try {
      await validateUrl("http://10.0.0.1");
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("restricted IP")) throw e;
    }
  });

  await test("block file protocol", async () => {
    try {
      await validateUrl("file:///etc/passwd");
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid protocol")) throw e;
    }
  });

  await test("block 0.0.0.0", async () => {
      try {
        await validateUrl("http://0.0.0.0");
        throw new Error("Should have thrown");
      } catch (e) {
        if (!e.message.includes("restricted IP")) throw e;
      }
    });

  // Integration test with contentFetcher
  await test("contentFetcher handles security error", async () => {
    // We expect contentFetcher to return an object with error property
    // We don't want to actually launch a browser if we can avoid it, but fetchContent calls initBrowser first.
    // If browser launch fails, this test will fail, but that's a separate issue.
    // Assuming the environment can run puppeteer (it was installed).

    // Using a timeout to prevent hanging if browser launch hangs
    const resultPromise = contentFetcher.fetchContent("http://127.0.0.1");

    // We race against a timeout
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

    try {
        const result = await Promise.race([resultPromise, timeout]);
        assert.strictEqual(result.url, "http://127.0.0.1");
        assert.ok(result.error, "Result should have an error property");
        assert.ok(result.error.includes("restricted IP"), `Error message should mention restricted IP, got: ${result.error}`);
        assert.strictEqual(result.content, null);
    } finally {
        // Ensure browser is closed
        await contentFetcher.close();
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
