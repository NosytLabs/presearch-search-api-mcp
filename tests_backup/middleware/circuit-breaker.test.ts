/**
 * Tests for Circuit Breaker
 */

import { CircuitBreaker } from '../../src/middleware/circuit-breaker.js';
import { Configuration } from '../../src/config/configuration.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockConfig: Configuration;

  beforeEach(() => {
    mockConfig = new Configuration({
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        resetTimeout: 1000, // 1 second
      },
    });
    
    circuitBreaker = new CircuitBreaker(mockConfig);
  });

  afterEach(() => {
    circuitBreaker.reset();
  });

  describe('Constructor', () => {
    it('should create circuit breaker with configuration', () => {
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should handle disabled circuit breaker', () => {
      const disabledConfig = new Configuration({
        circuitBreaker: {
          enabled: false,
          failureThreshold: 3,
          resetTimeout: 1000,
        },
      });
      
      const disabledBreaker = new CircuitBreaker(disabledConfig);
      expect(disabledBreaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('Circuit States', () => {
    it('should start in CLOSED state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeNull();
    });

    it('should transition to OPEN state after threshold failures', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Record failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(3);
      expect(state.lastFailureTime).not.toBeNull();
    });

    it('should reject requests immediately when OPEN', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next request should be rejected immediately
      const successOperation = async () => 'success';
      
      await expect(circuitBreaker.execute(successOperation))
        .rejects
        .toThrow('Circuit breaker is open');
    });

    it('should transition to HALF_OPEN after reset timeout', (done) => {
      const shortResetConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          resetTimeout: 100, // 100ms
        },
      });
      
      const shortResetBreaker = new CircuitBreaker(shortResetConfig);
      
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Trip the circuit breaker
      Promise.resolve()
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => {
          expect(shortResetBreaker.getState().state).toBe('OPEN');
          
          // Wait for reset timeout
          setTimeout(() => {
            const state = shortResetBreaker.getState();
            expect(state.state).toBe('HALF_OPEN');
            done();
          }, 150);
        });
    });

    it('should transition to CLOSED on successful HALF_OPEN request', (done) => {
      const shortResetConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          resetTimeout: 100,
        },
      });
      
      const shortResetBreaker = new CircuitBreaker(shortResetConfig);
      
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };
      
      const successOperation = async () => 'success';

      // Trip the circuit breaker
      Promise.resolve()
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => {
          expect(shortResetBreaker.getState().state).toBe('OPEN');
          
          // Wait for reset timeout
          setTimeout(() => {
            expect(shortResetBreaker.getState().state).toBe('HALF_OPEN');
            
            // Execute successful operation
            shortResetBreaker.execute(successOperation)
              .then((result) => {
                expect(result).toBe('success');
                expect(shortResetBreaker.getState().state).toBe('CLOSED');
                expect(shortResetBreaker.getState().failureCount).toBe(0);
                done();
              });
          }, 150);
        });
    });

    it('should transition back to OPEN on failed HALF_OPEN request', (done) => {
      const shortResetConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          resetTimeout: 100,
        },
      });
      
      const shortResetBreaker = new CircuitBreaker(shortResetConfig);
      
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Trip the circuit breaker
      Promise.resolve()
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => shortResetBreaker.execute(failingOperation).catch(() => {}))
        .then(() => {
          expect(shortResetBreaker.getState().state).toBe('OPEN');
          
          // Wait for reset timeout
          setTimeout(() => {
            expect(shortResetBreaker.getState().state).toBe('HALF_OPEN');
            
            // Execute failing operation
            shortResetBreaker.execute(failingOperation)
              .catch(() => {
                expect(shortResetBreaker.getState().state).toBe('OPEN');
                done();
              });
          }, 150);
        });
    });
  });

  describe('Operation Execution', () => {
    it('should execute successful operations normally', async () => {
      const successOperation = async () => 'success result';
      
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe('success result');
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should handle operation failures', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      await expect(circuitBreaker.execute(failingOperation))
        .rejects
        .toThrow('Operation failed');
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED'); // Still closed after single failure
      expect(state.failureCount).toBe(1);
    });

    it('should handle async operations with promises', async () => {
      const asyncOperation = async () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('async result'), 10);
        });
      };
      
      const result = await circuitBreaker.execute(asyncOperation);
      expect(result).toBe('async result');
    });

    it('should handle operations that return different types', async () => {
      const numberOperation = async () => 42;
      const objectOperation = async () => ({ key: 'value' });
      const arrayOperation = async () => [1, 2, 3];
      
      expect(await circuitBreaker.execute(numberOperation)).toBe(42);
      expect(await circuitBreaker.execute(objectOperation)).toEqual({ key: 'value' });
      expect(await circuitBreaker.execute(arrayOperation)).toEqual([1, 2, 3]);
    });
  });

  describe('Disabled Circuit Breaker', () => {
    let disabledBreaker: CircuitBreaker;

    beforeEach(() => {
      const disabledConfig = new Configuration({
        circuitBreaker: {
          enabled: false,
          failureThreshold: 3,
          resetTimeout: 1000,
        },
      });
      
      disabledBreaker = new CircuitBreaker(disabledConfig);
    });

    it('should always execute operations when disabled', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Even after many failures, should still execute
      for (let i = 0; i < 10; i++) {
        try {
          await disabledBreaker.execute(failingOperation);
        } catch (error) {
          expect(error.message).toBe('Operation failed');
        }
      }

      const state = disabledBreaker.getState();
      expect(state.state).toBe('DISABLED');
    });

    it('should not track failure statistics when disabled', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      try {
        await disabledBreaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }

      const stats = disabledBreaker.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.failures).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', async () => {
      const successOperation = async () => 'success';
      const failingOperation = async () => {
        throw new Error('failure');
      };

      // Execute some operations
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.rejections).toBe(0);
      expect(stats.successRate).toBeCloseTo(0.67, 2);
      expect(stats.failureRate).toBeCloseTo(0.33, 2);
    });

    it('should track rejections when circuit is open', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };
      
      const successOperation = async () => 'success';

      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      // Try to execute when circuit is open
      try {
        await circuitBreaker.execute(successOperation);
      } catch (error) {
        // Expected rejection
      }

      const stats = circuitBreaker.getStats();
      expect(stats.rejections).toBe(1);
    });

    it('should calculate rates correctly', async () => {
      const successOperation = async () => 'success';
      const failingOperation = async () => {
        throw new Error('failure');
      };

      // 7 successes, 3 failures
      for (let i = 0; i < 7; i++) {
        await circuitBreaker.execute(successOperation);
      }
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.successRate).toBeCloseTo(0.7, 1);
      expect(stats.failureRate).toBeCloseTo(0.3, 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle null/undefined operations', async () => {
      await expect(circuitBreaker.execute(null as any))
        .rejects
        .toThrow();
      
      await expect(circuitBreaker.execute(undefined as any))
        .rejects
        .toThrow();
    });

    it('should handle operations that throw non-Error objects', async () => {
      const stringThrowOperation = async () => {
        throw 'string error';
      };
      
      const numberThrowOperation = async () => {
        throw 404;
      };
      
      const objectThrowOperation = async () => {
        throw { code: 'ERROR', message: 'Something went wrong' };
      };

      await expect(circuitBreaker.execute(stringThrowOperation))
        .rejects
        .toBe('string error');
      
      await expect(circuitBreaker.execute(numberThrowOperation))
        .rejects
        .toBe(404);
      
      await expect(circuitBreaker.execute(objectThrowOperation))
        .rejects
        .toEqual({ code: 'ERROR', message: 'Something went wrong' });
    });

    it('should handle operations that never resolve', (done) => {
      const hangingOperation = async () => {
        return new Promise(() => {
          // Never resolves
        });
      };

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), 100);
      });

      Promise.race([
        circuitBreaker.execute(hangingOperation),
        timeoutPromise
      ]).catch((error) => {
        expect(error.message).toBe('Test timeout');
        done();
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent successful operations', async () => {
      const successOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(circuitBreaker.execute(successOperation));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(r => r === 'success')).toBe(true);

      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(10);
    });

    it('should handle concurrent failing operations', async () => {
      const failingOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Operation failed');
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          circuitBreaker.execute(failingOperation).catch(e => e.message)
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r === 'Operation failed')).toBe(true);

      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(5);
    });

    it('should handle mixed concurrent operations', async () => {
      const successOperation = async () => 'success';
      const failingOperation = async () => {
        throw new Error('failure');
      };

      const promises = [
        circuitBreaker.execute(successOperation),
        circuitBreaker.execute(failingOperation).catch(e => e.message),
        circuitBreaker.execute(successOperation),
        circuitBreaker.execute(failingOperation).catch(e => e.message),
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual(['success', 'failure', 'success', 'failure']);

      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(2);
    });
  });

  describe('Integration with API Calls', () => {
    it('should protect API calls from cascading failures', async () => {
      const mockApiCall = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('API Error: Service Unavailable');
        }
        return { data: 'API response' };
      };

      // Simulate API failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockApiCall(true));
        } catch (error) {
          // Expected
        }
      }

      // Circuit should be open now
      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Further API calls should be rejected immediately
      await expect(circuitBreaker.execute(() => mockApiCall(false)))
        .rejects
        .toThrow('Circuit breaker is open');
    });

    it('should allow API recovery after reset timeout', (done) => {
      const shortResetConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          resetTimeout: 100,
        },
      });
      
      const recoveryBreaker = new CircuitBreaker(shortResetConfig);
      
      const mockApiCall = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('API Error');
        }
        return { data: 'API response' };
      };

      // Trip the circuit
      Promise.resolve()
        .then(() => recoveryBreaker.execute(() => mockApiCall(true)).catch(() => {}))
        .then(() => recoveryBreaker.execute(() => mockApiCall(true)).catch(() => {}))
        .then(() => {
          expect(recoveryBreaker.getState().state).toBe('OPEN');
          
          // Wait for recovery
          setTimeout(() => {
            recoveryBreaker.execute(() => mockApiCall(false))
              .then((result) => {
                expect(result).toEqual({ data: 'API response' });
                expect(recoveryBreaker.getState().state).toBe('CLOSED');
                done();
              });
          }, 150);
        });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle zero failure threshold', () => {
      const zeroThresholdConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 0,
          resetTimeout: 1000,
        },
      });
      
      const zeroThresholdBreaker = new CircuitBreaker(zeroThresholdConfig);
      
      // Should always be open with zero threshold
      expect(zeroThresholdBreaker.getState().state).toBe('OPEN');
    });

    it('should handle very large failure threshold', async () => {
      const largeThresholdConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 1000000,
          resetTimeout: 1000,
        },
      });
      
      const largeThresholdBreaker = new CircuitBreaker(largeThresholdConfig);
      
      const failingOperation = async () => {
        throw new Error('failure');
      };

      // Many failures should not trip the circuit
      for (let i = 0; i < 100; i++) {
        try {
          await largeThresholdBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(largeThresholdBreaker.getState().state).toBe('CLOSED');
    });

    it('should handle very short reset timeout', (done) => {
      const shortTimeoutConfig = new Configuration({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 1,
          resetTimeout: 1, // 1ms
        },
      });
      
      const shortTimeoutBreaker = new CircuitBreaker(shortTimeoutConfig);
      
      const failingOperation = async () => {
        throw new Error('failure');
      };

      shortTimeoutBreaker.execute(failingOperation)
        .catch(() => {
          expect(shortTimeoutBreaker.getState().state).toBe('OPEN');
          
          // Should reset very quickly
          setTimeout(() => {
            expect(shortTimeoutBreaker.getState().state).toBe('HALF_OPEN');
            done();
          }, 10);
        });
    });
  });

  describe('State Management', () => {
    it('should reset circuit breaker state', async () => {
      const failingOperation = async () => {
        throw new Error('failure');
      };

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Reset the circuit
      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeNull();

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.failures).toBe(0);
    });
  });
});