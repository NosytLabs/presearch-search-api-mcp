import { loadConfig } from "../src/core/config.js";
import assert from "assert";

console.log("Testing config parsing...");

// Test default
delete process.env.PUPPETEER_ARGS;
let config = loadConfig();
assert.deepStrictEqual(config.puppeteer.args, [], "Default args should be empty array");

// Test with args
process.env.PUPPETEER_ARGS = "--no-sandbox,--disable-setuid-sandbox";
config = loadConfig();
assert.deepStrictEqual(config.puppeteer.args, ["--no-sandbox", "--disable-setuid-sandbox"], "Should parse args correctly");

// Test with whitespace and empty parts
process.env.PUPPETEER_ARGS = " --no-sandbox ,  , --disable-setuid-sandbox ";
config = loadConfig();
assert.deepStrictEqual(config.puppeteer.args, ["--no-sandbox", "--disable-setuid-sandbox"], "Should handle whitespace and empty parts");

console.log("✅ Config test passed!");
