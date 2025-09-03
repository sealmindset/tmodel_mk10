/**
 * Rate Limiting Middleware
 *
 * Implements token bucket algorithm for rate limiting API requests
 */

class RateLimiter {
    constructor(options = {}) {
        this.requestsPerWindow = options.requestsPerWindow || 10; // Requests per time window
        this.windowMs = options.windowMs || 60000; // Time window in milliseconds (1 minute)
        this.identifierFn = options.identifierFn || ((req) => req.ip); // Function to extract identifier from request

        // Storage for request timestamps per identifier
        this.requestHistory = new Map();

        console.log(`[RateLimiter] Initialized with ${this.requestsPerWindow} requests per ${this.windowMs}ms window`);
    }

    /**
     * Check if request should be allowed
     * @param {string} identifier - Request identifier (IP, user ID, etc.)
     * @returns {boolean} True if request is allowed
     */
    isAllowed(identifier) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create request history for this identifier
        if (!this.requestHistory.has(identifier)) {
            this.requestHistory.set(identifier, []);
        }

        const requests = this.requestHistory.get(identifier);

        // Remove requests outside the current window
        const validRequests = requests.filter(timestamp => timestamp > windowStart);

        // Check if under the limit
        const allowed = validRequests.length < this.requestsPerWindow;

        if (allowed) {
            // Add current request timestamp
            validRequests.push(now);
            this.requestHistory.set(identifier, validRequests);
        } else {
            console.warn(`[RateLimiter] Rate limit exceeded for ${identifier}: ${validRequests.length}/${this.requestsPerWindow} requests in window`);
        }

        // Clean up old entries periodically
        if (Math.random() < 0.01) { // 1% chance to clean up
            this.cleanup();
        }

        return allowed;
    }

    /**
     * Get remaining requests for an identifier
     * @param {string} identifier - Request identifier
     * @returns {number} Number of remaining requests
     */
    getRemainingRequests(identifier) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (!this.requestHistory.has(identifier)) {
            return this.requestsPerWindow;
        }

        const requests = this.requestHistory.get(identifier);
        const validRequests = requests.filter(timestamp => timestamp > windowStart);

        return Math.max(0, this.requestsPerWindow - validRequests.length);
    }

    /**
     * Get reset time for an identifier
     * @param {string} identifier - Request identifier
     * @returns {number} Timestamp when the window resets
     */
    getResetTime(identifier) {
        if (!this.requestHistory.has(identifier)) {
            return Date.now() + this.windowMs;
        }

        const requests = this.requestHistory.get(identifier);
        if (requests.length === 0) {
            return Date.now() + this.windowMs;
        }

        // Reset time is when the oldest request in the window expires
        return Math.min(...requests) + this.windowMs;
    }

    /**
     * Clean up old entries to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const cutoff = now - (this.windowMs * 2); // Keep entries for 2 windows

        for (const [identifier, requests] of this.requestHistory.entries()) {
            const validRequests = requests.filter(timestamp => timestamp > cutoff);
            if (validRequests.length === 0) {
                this.requestHistory.delete(identifier);
            } else {
                this.requestHistory.set(identifier, validRequests);
            }
        }

        console.log(`[RateLimiter] Cleanup completed. Tracking ${this.requestHistory.size} identifiers`);
    }

    /**
     * Create Express middleware function
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware function
     */
    middleware(options = {}) {
        const limiter = this;
        const skipSuccessfulRequests = options.skipSuccessfulRequests || false;
        const skipFailedRequests = options.skipFailedRequests || false;
        const keyGenerator = options.keyGenerator || this.identifierFn;

        return (req, res, next) => {
            const identifier = keyGenerator(req);

            if (!limiter.isAllowed(identifier)) {
                const resetTime = limiter.getResetTime(identifier);
                const resetIn = Math.ceil((resetTime - Date.now()) / 1000);

                res.set({
                    'X-RateLimit-Limit': limiter.requestsPerWindow,
                    'X-RateLimit-Remaining': 0,
                    'X-RateLimit-Reset': resetTime,
                    'Retry-After': resetIn
                });

                return res.status(429).json({
                    error: 'Too many requests',
                    message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
                    retryAfter: resetIn
                });
            }

            // Set rate limit headers
            const remaining = limiter.getRemainingRequests(identifier);
            const resetTime = limiter.getResetTime(identifier);

            res.set({
                'X-RateLimit-Limit': limiter.requestsPerWindow,
                'X-RateLimit-Remaining': remaining,
                'X-RateLimit-Reset': resetTime
            });

            // Track successful/failed requests if configured
            if (skipSuccessfulRequests || skipFailedRequests) {
                const originalSend = res.send;
                res.send = function(data) {
                    const statusCode = res.statusCode;

                    if (skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) {
                        // Don't count successful requests
                    } else if (skipFailedRequests && statusCode >= 400) {
                        // Don't count failed requests
                    } else {
                        // Count this request
                    }

                    originalSend.call(this, data);
                };
            }

            next();
        };
    }
}

// Create rate limiter instances for different use cases
const createReportLimiter = () => new RateLimiter({
    requestsPerWindow: 5, // 5 report generations per minute
    windowMs: 60000, // 1 minute
    identifierFn: (req) => {
        // Use IP + project ID to allow different projects but limit per IP
        const projectId = req.body?.filters?.projectUuid || req.body?.filters?.projectId || 'global';
        return `${req.ip || 'unknown'}:${projectId}`;
    }
});

const createGeneralLimiter = () => new RateLimiter({
    requestsPerWindow: 30, // 30 general requests per minute
    windowMs: 60000,
    identifierFn: (req) => req.ip || 'unknown'
});

module.exports = {
    RateLimiter,
    createReportLimiter,
    createGeneralLimiter
};
