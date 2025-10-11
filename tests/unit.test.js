import sinon from 'sinon';
import { expect } from 'chai';
import { createSearchTool } from '../src/server/tools/search.js';

describe('Search Tool', () => {
    let dependencies;
    let searchTool;

    beforeEach(() => {
        dependencies = {
            presearchApi: {
                get: sinon.stub(),
            },
            config: {
                performance: {
                    enableMetrics: true,
                    slowQueryThreshold: 1000,
                },
                errorHandling: {
                    maxRetries: 3,
                    retryDelay: 100,
                },
            },
            logger: {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
            },
            performanceLogger: {
                start: sinon.stub().returns('op123'),
                end: sinon.stub(),
            },
            ErrorHandler: {
                createError: sinon.stub().returns(new Error('Circuit breaker is open')),
                handleError: sinon.stub().returns({ message: 'API error' }),
                isRetryableError: sinon.stub().returns(true),
                ERROR_CODES: {
                    API_REQUEST_FAILED: 'API_REQUEST_FAILED',
                },
            },
            isCircuitBreakerOpen: sinon.stub().returns(false),
            getCacheKey: sinon.stub().returns('cacheKey'),
            getCachedResult: sinon.stub().returns(null),
            setCachedResult: sinon.stub(),
            circuitBreakerState: 'CLOSED',
        };
        searchTool = createSearchTool(dependencies);
    });

    it('should return cached result if available', async () => {
        const cachedResult = { data: 'cached data' };
        dependencies.getCachedResult.returns(cachedResult);

        const result = await searchTool.handler({ query: 'test', ip: '127.0.0.1' });

        expect(dependencies.getCachedResult.calledOnce).to.be.true;
        expect(result.content[0].text).to.include(JSON.stringify(cachedResult, null, 2));
        expect(dependencies.presearchApi.get.called).to.be.false;
    });

    it('should make an API call if no cached result is available', async () => {
        const apiResponse = { data: { standardResults: [] } };
        dependencies.presearchApi.get.resolves({ data: apiResponse });

        await searchTool.handler({ query: 'test', ip: '127.0.0.1' });

        expect(dependencies.presearchApi.get.calledOnce).to.be.true;
    });

    it('should retry on retryable API errors', async () => {
        dependencies.presearchApi.get.rejects(new Error('API error'));
        dependencies.ErrorHandler.isRetryableError.returns(true);

        try {
            await searchTool.handler({ query: 'test', ip: '127.0.0.1' });
        } catch (error) {
            // Expected to fail
        }

        expect(dependencies.presearchApi.get.callCount).to.equal(dependencies.config.errorHandling.maxRetries);
    });

    it('should not retry on non-retryable API errors', async () => {
        dependencies.presearchApi.get.rejects(new Error('API error'));
        dependencies.ErrorHandler.isRetryableError.returns(false);

        try {
            await searchTool.handler({ query: 'test', ip: '127.0.0.1' });
        } catch (error) {
            // Expected to fail
        }

        expect(dependencies.presearchApi.get.callCount).to.equal(1);
    });

    it('should throw an error if the circuit breaker is open', async () => {
        dependencies.isCircuitBreakerOpen.returns(true);
        const circuitBreakerError = new Error('Circuit breaker is OPEN - service temporarily unavailable');
        dependencies.ErrorHandler.createError.returns(circuitBreakerError);

        dependencies.ErrorHandler.handleError.callsFake((error, context, metadata) => {
            return { message: error.message };
        });

        try {
            await searchTool.handler({ query: 'test', ip: '127.0.0.1' });
            expect.fail('Expected an error to be thrown');
        } catch (error) {
            expect(error.message).to.include('Circuit breaker is OPEN - service temporarily unavailable');
        }
    });
});
