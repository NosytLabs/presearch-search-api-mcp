import { RateLimiter } from '../src/utils/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(5, 1000);
  });

  afterEach(() => {
  });

  test('should allow requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.checkLimit()).toBe(true);
    }
  });

  test('should block requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.checkLimit();
    }
    expect(limiter.checkLimit()).toBe(false);
  });

  test('should reset after window', () => {
    jest.useFakeTimers();
    for (let i = 0; i < 5; i++) {
      limiter.checkLimit();
    }
    expect(limiter.checkLimit()).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(limiter.checkLimit()).toBe(true);
    jest.useRealTimers();
  });

  test('should handle retry-after', () => {
    limiter.handleRateLimitResponse({ 'retry-after': '2' });
    expect(limiter.checkLimitWithRetryAfter().allowed).toBe(false);
    expect(limiter.getRetryAfterWaitTime()).toBeGreaterThan(0);
  });
});