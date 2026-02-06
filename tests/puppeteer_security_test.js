
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import puppeteer from 'puppeteer';
import { ContentFetcher } from '../src/services/contentFetcher.js';
import { config } from '../src/core/config.js';

describe('ContentFetcher Security', () => {
  let launchStub;

  beforeEach(() => {
    launchStub = sinon.stub(puppeteer, 'launch').resolves({
      close: () => Promise.resolve(),
      newPage: () => Promise.resolve({
        setUserAgent: () => Promise.resolve(),
        setRequestInterception: () => Promise.resolve(),
        on: () => {},
        goto: () => Promise.resolve(),
        evaluate: () => Promise.resolve('content'),
        title: () => Promise.resolve('title'),
        close: () => Promise.resolve()
      })
    });
    // Reset config args before each test
    config.puppeteer.args = [];
  });

  afterEach(() => {
    launchStub.restore();
  });

  it('should not use insecure flags by default', async () => {
    const fetcher = new ContentFetcher();
    await fetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const args = launchStub.firstCall.args[0].args;

    const insecureFlags = ["--no-sandbox", "--disable-setuid-sandbox"];
    const hasInsecureFlags = args.some(arg => insecureFlags.includes(arg));

    expect(hasInsecureFlags).to.be.false;
  });

  it('should use configured args', async () => {
    config.puppeteer.args = ["--custom-arg"];
    const fetcher = new ContentFetcher();
    await fetcher.initBrowser();

    expect(launchStub.calledOnce).to.be.true;
    const args = launchStub.firstCall.args[0].args;
    expect(args).to.include("--custom-arg");
  });
});
