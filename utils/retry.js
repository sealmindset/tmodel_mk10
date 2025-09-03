/**
 * Retry Utility
 *
 * Provides exponential backoff retry logic for handling transient failures
 */

class RetryError extends Error {
    constructor(message, lastError, attempts) {
        super(message);
        this.name = 'RetryError';
        this.lastError = lastError;
        this.attempts = attempts;
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.backoffFactor - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should trigger retry (default: retries network/rate limit errors)
 * @param {Function} options.onRetry - Callback called before each retry attempt
 * @returns {Promise} Result of the function call
 */
async function withRetry(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        backoffFactor = 2,
        shouldRetry = defaultShouldRetry,
        onRetry = null
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on last attempt
            if (attempt === maxAttempts) {
                break;
            }

            // Check if we should retry this error
            if (!shouldRetry(error)) {
                throw error;
            }

            // Calculate delay with exponential backoff + jitter
            const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
            const jitter = Math.random() * 0.1 * delay; // Add up to 10% jitter
            const totalDelay = delay + jitter;

            if (onRetry) {
                onRetry(attempt, totalDelay, error);
            }

            await sleep(totalDelay);
        }
    }

    // All attempts failed
    throw new RetryError(
        `Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`,
        lastError,
        maxAttempts
    );
}

/**
 * Default function to determine if an error should trigger a retry
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error should trigger a retry
 */
function defaultShouldRetry(error) {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const code = error.code || error.status || '';

    // Retry on network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return true;
    }

    // Retry on HTTP errors that might be transient
    if (typeof code === 'number' && (code === 429 || code === 502 || code === 503 || code === 504)) {
        return true;
    }

    // Retry on OpenAI specific errors
    if (message.includes('rate limit') || message.includes('server error') || message.includes('internal error')) {
        return true;
    }

    // Retry on Ollama connection issues
    if (message.includes('ollama') && (message.includes('connection') || message.includes('unavailable'))) {
        return true;
    }

    // Don't retry on authentication, validation, or other permanent errors
    return false;
}

module.exports = {
    withRetry,
    RetryError,
    defaultShouldRetry
};
