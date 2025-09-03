/**
 * Caching Layer for Report Generation
 *
 * Provides multi-level caching (memory + Redis) for templates, project data, and components
 * to reduce database load and improve performance
 */

const redis = require('redis');

class CacheManager {
    constructor(options = {}) {
        this.ttl = options.ttl || 300; // 5 minutes default TTL
        this.memoryCache = new Map();
        this.memoryMaxSize = options.memoryMaxSize || 100; // Max items in memory cache
        this.redisClient = null;
        this.redisEnabled = options.redisEnabled !== false;

        // Initialize Redis if enabled
        if (this.redisEnabled) {
            this.initializeRedis(options.redisUrl);
        }

        console.log(`[CacheManager] Initialized with TTL=${this.ttl}s, memoryMaxSize=${this.memoryMaxSize}, redis=${this.redisEnabled ? 'enabled' : 'disabled'}`);
    }

    async initializeRedis(redisUrl) {
        try {
            this.redisClient = redis.createClient({
                url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.warn('[CacheManager] Redis connection refused, falling back to memory-only caching');
                        this.redisEnabled = false;
                        return false;
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.warn('[CacheManager] Redis retry timeout, falling back to memory-only caching');
                        this.redisEnabled = false;
                        return false;
                    }
                    if (options.attempt > 10) {
                        console.warn('[CacheManager] Redis max retries exceeded, falling back to memory-only caching');
                        this.redisEnabled = false;
                        return false;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            await this.redisClient.connect();
            console.log('[CacheManager] Redis connection established');
        } catch (error) {
            console.warn('[CacheManager] Redis initialization failed, using memory-only caching:', error.message);
            this.redisEnabled = false;
        }
    }

    /**
     * Generate cache key with namespace
     * @param {string} namespace - Cache namespace (e.g., 'template', 'project')
     * @param {string} key - Primary key
     * @param {Object} context - Additional context for key generation
     * @returns {string} Cache key
     */
    generateKey(namespace, key, context = {}) {
        const parts = [namespace, key];
        if (context.projectId) parts.push(`project:${context.projectId}`);
        if (context.filters) parts.push(`filters:${JSON.stringify(context.filters)}`);
        return parts.join(':');
    }

    /**
     * Get value from cache
     * @param {string} namespace - Cache namespace
     * @param {string} key - Cache key
     * @param {Object} context - Context for key generation
     * @returns {Promise<any>} Cached value or null
     */
    async get(namespace, key, context = {}) {
        const cacheKey = this.generateKey(namespace, key, context);

        // Try memory cache first
        if (this.memoryCache.has(cacheKey)) {
            const cached = this.memoryCache.get(cacheKey);
            if (cached.expiry > Date.now()) {
                console.log(`[CacheManager] Memory cache hit for ${cacheKey}`);
                return cached.value;
            } else {
                this.memoryCache.delete(cacheKey);
            }
        }

        // Try Redis cache if available
        if (this.redisEnabled && this.redisClient) {
            try {
                const redisData = await this.redisClient.get(cacheKey);
                if (redisData) {
                    const parsed = JSON.parse(redisData);
                    console.log(`[CacheManager] Redis cache hit for ${cacheKey}`);
                    // Also store in memory for faster subsequent access
                    this.memoryCache.set(cacheKey, {
                        value: parsed,
                        expiry: Date.now() + (this.ttl * 1000)
                    });
                    return parsed;
                }
            } catch (error) {
                console.warn(`[CacheManager] Redis get error for ${cacheKey}:`, error.message);
            }
        }

        console.log(`[CacheManager] Cache miss for ${cacheKey}`);
        return null;
    }

    /**
     * Set value in cache
     * @param {string} namespace - Cache namespace
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {Object} context - Context for key generation
     * @param {number} customTtl - Custom TTL in seconds
     * @returns {Promise<void>}
     */
    async set(namespace, key, value, context = {}, customTtl = null) {
        const cacheKey = this.generateKey(namespace, key, context);
        const ttl = customTtl || this.ttl;
        const expiry = Date.now() + (ttl * 1000);

        // Store in memory cache
        if (this.memoryCache.size >= this.memoryMaxSize) {
            // Remove oldest entries (simple LRU approximation)
            const entries = Array.from(this.memoryCache.entries());
            entries.sort((a, b) => a[1].expiry - b[1].expiry);
            const toRemove = entries.slice(0, Math.ceil(this.memoryMaxSize * 0.1));
            toRemove.forEach(([key]) => this.memoryCache.delete(key));
        }

        this.memoryCache.set(cacheKey, { value, expiry });

        // Store in Redis if available
        if (this.redisEnabled && this.redisClient) {
            try {
                await this.redisClient.setEx(cacheKey, ttl, JSON.stringify(value));
                console.log(`[CacheManager] Cached in Redis: ${cacheKey} (TTL: ${ttl}s)`);
            } catch (error) {
                console.warn(`[CacheManager] Redis set error for ${cacheKey}:`, error.message);
            }
        }

        console.log(`[CacheManager] Cached in memory: ${cacheKey}`);
    }

    /**
     * Delete value from cache
     * @param {string} namespace - Cache namespace
     * @param {string} key - Cache key
     * @param {Object} context - Context for key generation
     * @returns {Promise<void>}
     */
    async delete(namespace, key, context = {}) {
        const cacheKey = this.generateKey(namespace, key, context);

        // Remove from memory cache
        this.memoryCache.delete(cacheKey);

        // Remove from Redis if available
        if (this.redisEnabled && this.redisClient) {
            try {
                await this.redisClient.del(cacheKey);
                console.log(`[CacheManager] Deleted from Redis: ${cacheKey}`);
            } catch (error) {
                console.warn(`[CacheManager] Redis delete error for ${cacheKey}:`, error.message);
            }
        }
    }

    /**
     * Clear entire cache or specific namespace
     * @param {string} namespace - Optional namespace to clear
     * @returns {Promise<void>}
     */
    async clear(namespace = null) {
        if (namespace) {
            // Clear specific namespace
            const keysToDelete = [];
            for (const key of this.memoryCache.keys()) {
                if (key.startsWith(`${namespace}:`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.memoryCache.delete(key));

            if (this.redisEnabled && this.redisClient) {
                try {
                    const pattern = `${namespace}:*`;
                    const keys = await this.redisClient.keys(pattern);
                    if (keys.length > 0) {
                        await this.redisClient.del(keys);
                        console.log(`[CacheManager] Cleared Redis namespace ${namespace}: ${keys.length} keys`);
                    }
                } catch (error) {
                    console.warn(`[CacheManager] Redis clear namespace error for ${namespace}:`, error.message);
                }
            }
        } else {
            // Clear all caches
            this.memoryCache.clear();

            if (this.redisEnabled && this.redisClient) {
                try {
                    await this.redisClient.flushAll();
                    console.log('[CacheManager] Cleared all Redis cache');
                } catch (error) {
                    console.warn('[CacheManager] Redis flush error:', error.message);
                }
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const memoryStats = {
            size: this.memoryCache.size,
            maxSize: this.memoryMaxSize,
            hitRate: 0 // Would need to track hits/misses for accurate rate
        };

        return {
            memory: memoryStats,
            redis: {
                enabled: this.redisEnabled,
                connected: this.redisEnabled && this.redisClient && this.redisClient.isOpen
            }
        };
    }

    /**
     * Gracefully close connections
     * @returns {Promise<void>}
     */
    async close() {
        if (this.redisEnabled && this.redisClient) {
            try {
                await this.redisClient.quit();
                console.log('[CacheManager] Redis connection closed');
            } catch (error) {
                console.warn('[CacheManager] Error closing Redis connection:', error.message);
            }
        }
    }
}

// Create singleton cache manager instance
let cacheManager = null;

function getCacheManager(options = {}) {
    if (!cacheManager) {
        cacheManager = new CacheManager(options);
    }
    return cacheManager;
}

// Cache namespaces for different data types
const CACHE_NAMESPACES = {
    TEMPLATE: 'template',
    PROJECT: 'project',
    COMPONENTS: 'components',
    THREATS: 'threats',
    VULNERABILITIES: 'vulnerabilities',
    SAFEGUARDS: 'safeguards',
    STATISTICS: 'statistics'
};

module.exports = {
    CacheManager,
    getCacheManager,
    CACHE_NAMESPACES
};
