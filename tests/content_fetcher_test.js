import sinon from 'sinon';
import puppeteer from 'puppeteer';
import { contentFetcher } from '../src/services/contentFetcher.js';
import assert from 'assert';
import { config } from '../src/core/config.js';

console.log('Testing ContentFetcher arguments...');

async function runTest() {
    // Stub puppeteer.launch
    const launchStub = sinon.stub(puppeteer, 'launch').resolves({
        newPage: async () => ({
            setUserAgent: async () => {},
            setRequestInterception: async () => {},
            on: () => {},
            goto: async () => {},
            evaluate: async () => 'mock content',
            title: async () => 'Mock Title',
            close: async () => {},
        }),
        close: async () => {},
    });

    try {
        // Setup config
        // Note: config is a singleton imported from a module, so it maintains state.
        // We can modify the object directly since it's exported as const but the object is mutable.
        config.puppeteer.args = ['--test-arg'];
        config.puppeteer.headless = true;

        await contentFetcher.initBrowser();

        assert(launchStub.calledOnce, 'puppeteer.launch should be called once');
        const args = launchStub.firstCall.args[0];

        assert.deepStrictEqual(args.args, ['--test-arg'], 'Should use configured args');
        assert.strictEqual(args.headless, true, 'Should use configured headless');

        console.log('✅ ContentFetcher uses configured args');
    } catch (e) {
        console.error('❌ Test failed:', e);
        process.exit(1);
    } finally {
        launchStub.restore();
        await contentFetcher.close();
    }
}

runTest();
