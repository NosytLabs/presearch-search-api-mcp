import { expect } from "chai";
import sinon from "sinon";
import puppeteer from "puppeteer";
import { ContentFetcher } from "../src/services/contentFetcher.js";
import { config } from "../src/core/config.js";
import logger from "../src/core/logger.js";

describe("Security: Puppeteer Configuration", () => {
  let launchStub;
  let warnSpy;
  let originalArgs;

  beforeEach(() => {
    launchStub = sinon.stub(puppeteer, "launch").resolves({
      newPage: sinon.stub().resolves({
        setUserAgent: sinon.stub(),
        setRequestInterception: sinon.stub(),
        on: sinon.stub(),
        goto: sinon.stub(),
        evaluate: sinon.stub(),
        title: sinon.stub().resolves("Test Title"),
        close: sinon.stub(),
      }),
      close: sinon.stub(),
    });
    warnSpy = sinon.spy(logger, "warn");
    originalArgs = [...config.puppeteer.args];
  });

  afterEach(() => {
    launchStub.restore();
    warnSpy.restore();
    config.puppeteer.args.length = 0;
    config.puppeteer.args.push(...originalArgs);
  });

  it("should launch puppeteer with default secure arguments (empty list)", async () => {
    // Ensure config is empty
    config.puppeteer.args.length = 0;

    const fetcher = new ContentFetcher();
    await fetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const args = launchStub.firstCall.args[0].args;
    expect(args).to.deep.equal([]);
    expect(warnSpy.called).to.be.false;
  });

  it("should launch puppeteer with configured arguments", async () => {
    config.puppeteer.args.length = 0;
    config.puppeteer.args.push("--some-secure-flag");

    const fetcher = new ContentFetcher();
    await fetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const args = launchStub.firstCall.args[0].args;
    expect(args).to.include("--some-secure-flag");
    expect(warnSpy.called).to.be.false;
  });

  it("should warn when insecure flags are used", async () => {
    config.puppeteer.args.length = 0;
    config.puppeteer.args.push("--no-sandbox");

    const fetcher = new ContentFetcher();
    await fetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const args = launchStub.firstCall.args[0].args;
    expect(args).to.include("--no-sandbox");
    expect(warnSpy.called).to.be.true;
    expect(warnSpy.firstCall.args[0]).to.include("Security Warning");
  });
});
