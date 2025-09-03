/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily stopping requests to failing services
 */

class CircuitBreakerError extends Error {
    constructor(message, state) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.state = state;
    }
}

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5; // Number of failures before opening
        this.recoveryTimeout = options.recoveryTimeout || 60000; // Time in ms to wait before trying again
        this.monitoringPeriod = options.monitoringPeriod || 10000; // Time window in ms to count failures
        this.expectedException = options.expectedException || Error;

        // State management
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        // Request tracking
        this.requestCount = 0;
        this.failureTimestamps = [];

        console.log(`[CircuitBreaker] Initialized with failureThreshold=${this.failureThreshold}, recoveryTimeout=${this.recoveryTimeout}ms`);
    }

    /**
     * Execute a function with circuit breaker protection
     * @param {Function} fn - Function to execute
     * @returns {Promise} Result of the function
     */
    async execute(fn) {
        this.requestCount++;

        // Check if circuit should be opened
        this.updateState();

        if (this.state === 'OPEN') {
            throw new CircuitBreakerError(`Circuit breaker is OPEN. Next retry at ${new Date(this.nextAttemptTime).toISOString()}`, this.state);
        }

        try {
            const result = await fn();

            // Success: reset failure count and close circuit if in half-open state
            if (this.state === 'HALF_OPEN') {
                console.log(`[CircuitBreaker] HALF_OPEN -> CLOSED after successful call`);
                this.state = 'CLOSED';
                this.failureCount = 0;
                this.failureTimestamps = [];
            }

            return result;

        } catch (error) {
            this.recordFailure(error);

            // If we're in half-open state, any failure should reopen the circuit
            if (this.state === 'HALF_OPEN') {
                console.warn(`[CircuitBreaker] HALF_OPEN -> OPEN after failure`);
                this.state = 'OPEN';
                this.nextAttemptTime = Date.now() + this.recoveryTimeout;
            }

            throw error;
        }
    }

    /**
     * Record a failure and potentially open the circuit
     * @param {Error} error - The error that occurred
     */
    recordFailure(error) {
        const now = Date.now();
        this.lastFailureTime = now;
        this.failureTimestamps.push(now);

        // Clean up old timestamps outside monitoring window
        const cutoff = now - this.monitoringPeriod;
        this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);

        this.failureCount = this.failureTimestamps.length;

        // Check if we should open the circuit
        if (this.failureCount >= this.failureThreshold && this.state === 'CLOSED') {
            console.warn(`[CircuitBreaker] CLOSED -> OPEN after ${this.failureCount} failures in ${this.monitoringPeriod}ms`);
            this.state = 'OPEN';
            this.nextAttemptTime = now + this.recoveryTimeout;
        }
    }

    /**
     * Update circuit state based on time and failure patterns
     */
    updateState() {
        const now = Date.now();

        if (this.state === 'OPEN' && now >= this.nextAttemptTime) {
            console.log(`[CircuitBreaker] OPEN -> HALF_OPEN (recovery timeout elapsed)`);
            this.state = 'HALF_OPEN';
            this.failureCount = 0;
        }
    }

    /**
     * Get current circuit breaker status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            requestCount: this.requestCount,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
            failureRate: this.requestCount > 0 ? (this.failureCount / this.requestCount) : 0
        };
    }
}

// Circuit breaker instances for different providers
const circuitBreakers = new Map();

function getCircuitBreaker(provider, options = {}) {
    if (!circuitBreakers.has(provider)) {
        // Provider-specific defaults
        const defaults = {
            openai: {
                failureThreshold: 3,
                recoveryTimeout: 30000, // 30 seconds
                monitoringPeriod: 60000 // 1 minute
            },
            ollama: {
                failureThreshold: 2,
                recoveryTimeout: 60000, // 1 minute (local service)
                monitoringPeriod: 30000 // 30 seconds
            }
        };

        const config = { ...defaults[provider], ...options };
        circuitBreakers.set(provider, new CircuitBreaker(config));
    }

    return circuitBreakers.get(provider);
}

module.exports = {
    CircuitBreaker,
    CircuitBreakerError,
    getCircuitBreaker
};
