/**
 * Metrics and Monitoring System for Report Generation
 *
 * Collects performance metrics, tracks success rates, and provides monitoring capabilities
 * for the report generation system
 */

const EventEmitter = require('events');

class MetricsCollector extends EventEmitter {
    constructor(options = {}) {
        super();
        this.metrics = new Map();
        this.retentionPeriod = options.retentionPeriod || 24 * 60 * 60 * 1000; // 24 hours
        this.maxMetricsPerType = options.maxMetricsPerType || 1000;
        this.enabled = options.enabled !== false;
        this.cleanupInterval = null;

        if (this.enabled) {
            console.log('[MetricsCollector] Initialized with retention period:', this.retentionPeriod / (60 * 60 * 1000), 'hours');

            // In test environment, avoid creating background timers that keep Jest open
            const isTestEnv = !!(process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test');
            if (isTestEnv) {
                console.log('[MetricsCollector] Test environment detected; skipping cleanup interval to prevent Jest open handles');
            } else {
                // Periodic cleanup of old metrics
                this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Clean up hourly
            }
        }
    }

    /**
     * Record a metric
     * @param {string} name - Metric name
     * @param {number} value - Metric value
     * @param {Object} tags - Additional tags/labels
     * @param {number} timestamp - Timestamp (optional, defaults to now)
     */
    record(name, value, tags = {}, timestamp = null) {
        if (!this.enabled) return;

        const ts = timestamp || Date.now();

        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metricsArray = this.metrics.get(name);
        metricsArray.push({
            value,
            tags: { ...tags },
            timestamp: ts
        });

        // Maintain size limit per metric type
        if (metricsArray.length > this.maxMetricsPerType) {
            metricsArray.shift(); // Remove oldest
        }

        this.emit('metric-recorded', { name, value, tags, timestamp: ts });
    }

    /**
     * Record a counter metric (increments by 1)
     * @param {string} name - Counter name
     * @param {Object} tags - Additional tags/labels
     */
    increment(name, tags = {}) {
        this.record(name, 1, tags);
    }

    /**
     * Record timing metric
     * @param {string} name - Timing metric name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} tags - Additional tags/labels
     */
    timing(name, duration, tags = {}) {
        this.record(name, duration, tags);
    }

    /**
     * Start a timer for measuring duration
     * @param {string} name - Timer name
     * @param {Object} tags - Additional tags/labels
     * @returns {Function} Function to call when timer should stop
     */
    startTimer(name, tags = {}) {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.timing(name, duration, tags);
            return duration;
        };
    }

    /**
     * Get metrics for a specific name
     * @param {string} name - Metric name
     * @param {Object} filterTags - Optional tag filters
     * @param {number} since - Optional timestamp to filter from
     * @returns {Array} Array of matching metrics
     */
    getMetrics(name, filterTags = {}, since = null) {
        if (!this.metrics.has(name)) {
            return [];
        }

        let metrics = this.metrics.get(name);

        // Filter by timestamp
        if (since) {
            metrics = metrics.filter(m => m.timestamp >= since);
        }

        // Filter by tags
        if (Object.keys(filterTags).length > 0) {
            metrics = metrics.filter(m => {
                return Object.entries(filterTags).every(([key, value]) => m.tags[key] === value);
            });
        }

        return metrics;
    }

    /**
     * Calculate aggregate statistics for a metric
     * @param {string} name - Metric name
     * @param {Object} filterTags - Optional tag filters
     * @param {number} since - Optional timestamp to filter from
     * @returns {Object} Statistics object
     */
    getStats(name, filterTags = {}, since = null) {
        const metrics = this.getMetrics(name, filterTags, since);

        if (metrics.length === 0) {
            return {
                count: 0,
                min: 0,
                max: 0,
                avg: 0,
                p95: 0,
                p99: 0
            };
        }

        const values = metrics.map(m => m.value).sort((a, b) => a - b);

        return {
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            avg: values.reduce((sum, val) => sum + val, 0) / values.length,
            p95: values[Math.floor(values.length * 0.95)] || values[values.length - 1],
            p99: values[Math.floor(values.length * 0.99)] || values[values.length - 1]
        };
    }

    /**
     * Get overall system health metrics
     * @returns {Object} Health metrics
     */
    getHealthMetrics() {
        const now = Date.now();
        const lastHour = now - (60 * 60 * 1000);
        const last24Hours = now - (24 * 60 * 60 * 1000);

        const reportGenerationStats = this.getStats('report_generation_duration', {}, lastHour);
        const errorStats = this.getStats('report_generation_errors', {}, lastHour);
        const successRate = reportGenerationStats.count > 0 ?
            ((reportGenerationStats.count - errorStats.count) / reportGenerationStats.count) * 100 : 100;

        const cacheStats = this.getStats('cache_hit_ratio', {}, lastHour);

        return {
            timestamp: now,
            report_generation: {
                total_requests: reportGenerationStats.count,
                avg_duration_ms: Math.round(reportGenerationStats.avg),
                p95_duration_ms: Math.round(reportGenerationStats.p95),
                success_rate_percent: Math.round(successRate * 100) / 100,
                error_count: errorStats.count
            },
            cache_performance: {
                avg_hit_ratio: Math.round(cacheStats.avg * 100) / 100,
                p95_hit_ratio: Math.round(cacheStats.p95 * 100) / 100
            },
            system: {
                uptime_seconds: Math.floor(process.uptime()),
                memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                metrics_collected: Array.from(this.metrics.values()).reduce((sum, arr) => sum + arr.length, 0)
            }
        };
    }

    /**
     * Clean up old metrics based on retention period
     */
    cleanup() {
        if (!this.enabled) return;

        const cutoff = Date.now() - this.retentionPeriod;
        let cleanedCount = 0;

        for (const [name, metrics] of this.metrics.entries()) {
            const originalLength = metrics.length;
            const filtered = metrics.filter(m => m.timestamp >= cutoff);

            if (filtered.length !== originalLength) {
                this.metrics.set(name, filtered);
                cleanedCount += (originalLength - filtered.length);
            }
        }

        if (cleanedCount > 0) {
            console.log(`[MetricsCollector] Cleaned up ${cleanedCount} old metrics`);
        }
    }

    /**
     * Stop background timers (useful for tests/shutdown)
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[MetricsCollector] Cleanup interval cleared');
        }
    }

    /**
     * Export metrics in Prometheus format
     * @returns {string} Prometheus-formatted metrics
     */
    toPrometheusFormat() {
        let output = '# Report Generator Metrics\n';

        for (const [name, metrics] of this.metrics.entries()) {
            // Only export recent metrics (last hour)
            const recentMetrics = metrics.filter(m => m.timestamp > Date.now() - 3600000);

            if (recentMetrics.length === 0) continue;

            // Group by tags for Prometheus format
            const groupedMetrics = new Map();

            for (const metric of recentMetrics) {
                const tagString = Object.entries(metric.tags)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(',');

                const key = `${name}{${tagString}}`;
                if (!groupedMetrics.has(key)) {
                    groupedMetrics.set(key, []);
                }
                groupedMetrics.get(key).push(metric);
            }

            for (const [key, group] of groupedMetrics.entries()) {
                // For counters, sum the values
                if (name.includes('count') || name.includes('errors')) {
                    const total = group.reduce((sum, m) => sum + m.value, 0);
                    output += `${key} ${total}\n`;
                } else {
                    // For gauges/timers, use the most recent value
                    const latest = group.sort((a, b) => b.timestamp - a.timestamp)[0];
                    output += `${key} ${latest.value}\n`;
                }
            }
        }

        return output;
    }

    /**
     * Reset all metrics (useful for testing)
     */
    reset() {
        this.metrics.clear();
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        console.log('[MetricsCollector] All metrics reset');
    }
}

// Metric names constants
const METRICS = {
    REPORT_GENERATION_DURATION: 'report_generation_duration',
    REPORT_GENERATION_ERRORS: 'report_generation_errors',
    TEMPLATE_LOAD_DURATION: 'template_load_duration',
    DATA_FETCH_DURATION: 'data_fetch_duration',
    LLM_CALL_DURATION: 'llm_call_duration',
    CACHE_HIT_RATIO: 'cache_hit_ratio',
    RETRY_COUNT: 'retry_count',
    STREAM_CONNECTIONS: 'stream_connections'
};

// Create singleton metrics collector instance
let metricsCollector = null;

function getMetricsCollector(options = {}) {
    if (!metricsCollector) {
        metricsCollector = new MetricsCollector(options);
    }
    return metricsCollector;
}

module.exports = {
    MetricsCollector,
    getMetricsCollector,
    METRICS
};
