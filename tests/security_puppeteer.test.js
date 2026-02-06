import { expect } from "chai";
import sinon from "sinon";
import puppeteer from "puppeteer";
import { ContentFetcher } from "../src/services/contentFetcher.js";
import { config } from "../src/core/config.js";

describe("Security: Puppeteer Configuration", () => {
  let launchStub;
  let contentFetcher;
  let originalConfigArgs;

  beforeEach(() => {
    launchStub = sinon.stub(puppeteer, "launch").resolves({
      newPage: sinon.stub(),
      close: sinon.stub(),
    });
    contentFetcher = new ContentFetcher();
    // Save original config
    originalConfigArgs = [...config.puppeteer.args];
  });

  afterEach(async () => {
    // Restore config
    config.puppeteer.args = originalConfigArgs;
    // Close browser if open
    await contentFetcher.close();
    sinon.restore();
  });

  it("should not use insecure flags by default", async () => {
    // Ensure default args are empty for this test
    config.puppeteer.args = [];

    await contentFetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const launchArgs = launchStub.firstCall.args[0];

    expect(launchArgs.args).to.deep.equal([]);
    expect(launchArgs.args).to.not.include("--no-sandbox");
    expect(launchArgs.args).to.not.include("--disable-setuid-sandbox");
  });

  it("should use configured arguments", async () => {
    // Set custom args
    const customArgs = ["--disable-dev-shm-usage"];
    config.puppeteer.args = customArgs;

    await contentFetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const launchArgs = launchStub.firstCall.args[0];

    expect(launchArgs.args).to.deep.equal(customArgs);
  });

  it("should allow insecure flags if explicitly configured (but presumably warn)", async () => {
     config.puppeteer.args = ["--no-sandbox"];

     await contentFetcher.initBrowser();

     expect(launchStub.calledOnce).to.be.true;
     const launchArgs = launchStub.firstCall.args[0];
     expect(launchArgs.args).to.include("--no-sandbox");
  });
});
