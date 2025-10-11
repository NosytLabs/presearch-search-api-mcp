let circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
let circuitBreakerFailureCount = 0;
let circuitBreakerLastFailureTime = null;

export const getCircuitBreakerState = () => circuitBreakerState;
export const getCircuitBreakerFailureCount = () => circuitBreakerFailureCount;

export const isCircuitBreakerOpen = (config, logger) => {
    if (circuitBreakerState === 'OPEN') {
        const timeSinceLastFailure = Date.now() - circuitBreakerLastFailureTime;
        if (timeSinceLastFailure > config.errorHandling.circuitBreakerResetTimeout) {
            circuitBreakerState = 'HALF_OPEN';
            logger.info('Circuit breaker: Moving to HALF_OPEN state', {
                timeSinceLastFailure: `${timeSinceLastFailure}ms`
            });
            return false;
        }
        return true;
    }
    return false;
};

export const recordCircuitBreakerSuccess = (logger) => {
    if (circuitBreakerState === 'HALF_OPEN') {
        circuitBreakerState = 'CLOSED';
        circuitBreakerFailureCount = 0;
        logger.info('Circuit breaker: Reset to CLOSED state after successful request');
    }
};

export const recordCircuitBreakerFailure = (config, logger) => {
    circuitBreakerFailureCount++;
    circuitBreakerLastFailureTime = Date.now();

    if (circuitBreakerFailureCount >= config.errorHandling.circuitBreakerThreshold) {
        circuitBreakerState = 'OPEN';
        logger.warn('Circuit breaker: Opened due to consecutive failures', {
            failureCount: circuitBreakerFailureCount,
            threshold: config.errorHandling.circuitBreakerThreshold
        });
    }
};
