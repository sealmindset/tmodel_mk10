/**
 * Analytics Dashboard for Report Generation
 *
 * Provides comprehensive analytics and insights for the report generation system
 * including performance metrics, usage patterns, and system health monitoring
 */

const { getMetricsCollector, METRICS } = require('../utils/metrics');
const { getCacheManager } = require('../utils/cacheManager');

class AnalyticsDashboard {
    constructor() {
        this.metrics = getMetricsCollector();
        this.cache = getCacheManager();
    }

    /**
     * Get comprehensive dashboard data
     * @param {Object} options - Query options
     * @param {number} options.hours - Hours of data to analyze (default: 24)
     * @param {string} options.groupBy - Group metrics by 'hour', 'day', or 'week'
     * @returns {Object} Dashboard data
     */
    async getDashboardData(options = {}) {
        const hours = options.hours || 24;
        const groupBy = options.groupBy || 'hour';
        const now = Date.now();
        const since = now - (hours * 60 * 60 * 1000);

        console.log(`[Analytics] Generating dashboard for last ${hours} hours, grouped by ${groupBy}`);

        const dashboard = {
            timestamp: now,
            period: { hours, since, until: now },
            summary: await this.getSummaryMetrics(since),
            performance: await this.getPerformanceMetrics(since, groupBy),
            usage: await this.getUsageMetrics(since, groupBy),
            health: await this.getHealthMetrics(),
            recommendations: await this.generateRecommendations()
        };

        return dashboard;
    }

    /**
     * Get summary metrics for the dashboard
     * @param {number} since - Timestamp to analyze from
     * @returns {Object} Summary metrics
     */
    async getSummaryMetrics(since) {
        const reportStats = this.metrics.getStats(METRICS.REPORT_GENERATION_DURATION, {}, since);
        const errorStats = this.metrics.getStats(METRICS.REPORT_GENERATION_ERRORS, {}, since);
        const cacheStats = this.metrics.getStats(METRICS.CACHE_HIT_RATIO, {}, since);

        // Calculate success rate
        const totalAttempts = reportStats.count;
        const failures = errorStats.count;
        const successRate = totalAttempts > 0 ? ((totalAttempts - failures) / totalAttempts) * 100 : 100;

        return {
            totalReportsGenerated: reportStats.count,
            averageGenerationTime: Math.round(reportStats.avg),
            medianGenerationTime: Math.round(reportStats.p95),
            p95GenerationTime: Math.round(reportStats.p95),
            p99GenerationTime: Math.round(reportStats.p99),
            successRate: Math.round(successRate * 100) / 100,
            totalErrors: failures,
            cacheHitRatio: Math.round(cacheStats.avg * 100) / 100,
            cacheEfficiency: cacheStats.avg > 0.8 ? 'Excellent' :
                           cacheStats.avg > 0.6 ? 'Good' :
                           cacheStats.avg > 0.4 ? 'Fair' : 'Poor'
        };
    }

    /**
     * Get performance metrics with time series data
     * @param {number} since - Timestamp to analyze from
     * @param {string} groupBy - Grouping interval
     * @returns {Object} Performance metrics
     */
    async getPerformanceMetrics(since, groupBy) {
        const intervals = this.generateTimeIntervals(since, Date.now(), groupBy);

        const performance = {
            responseTimeTrend: [],
            throughputTrend: [],
            errorRateTrend: [],
            cachePerformanceTrend: []
        };

        for (const interval of intervals) {
            const intervalStart = interval.start;
            const intervalEnd = interval.end;

            // Response time metrics for this interval
            const responseTimeStats = this.metrics.getStats(
                METRICS.REPORT_GENERATION_DURATION,
                {},
                intervalStart
            );

            // Error rate for this interval
            const errorStats = this.metrics.getStats(
                METRICS.REPORT_GENERATION_ERRORS,
                {},
                intervalStart
            );

            // Cache performance for this interval
            const cacheStats = this.metrics.getStats(
                METRICS.CACHE_HIT_RATIO,
                {},
                intervalStart
            );

            performance.responseTimeTrend.push({
                timestamp: intervalEnd,
                avg: Math.round(responseTimeStats.avg),
                p95: Math.round(responseTimeStats.p95),
                count: responseTimeStats.count
            });

            performance.errorRateTrend.push({
                timestamp: intervalEnd,
                count: errorStats.count,
                rate: responseTimeStats.count > 0 ? (errorStats.count / responseTimeStats.count) * 100 : 0
            });

            performance.cachePerformanceTrend.push({
                timestamp: intervalEnd,
                hitRatio: Math.round(cacheStats.avg * 100) / 100,
                count: cacheStats.count
            });
        }

        return performance;
    }

    /**
     * Get usage metrics and patterns
     * @param {number} since - Timestamp to analyze from
     * @param {string} groupBy - Grouping interval
     * @returns {Object} Usage metrics
     */
    async getUsageMetrics(since, groupBy) {
        const usage = {
            reportTypes: {},
            templates: {},
            providers: {},
            peakHours: [],
            userActivity: {}
        };

        // Analyze report type usage
        const reportTypeMetrics = this.metrics.getMetrics(METRICS.REPORT_GENERATION_DURATION, {}, since);
        for (const metric of reportTypeMetrics) {
            const reportType = metric.tags.report_type || 'unknown';
            usage.reportTypes[reportType] = (usage.reportTypes[reportType] || 0) + 1;
        }

        // Analyze template usage
        for (const metric of reportTypeMetrics) {
            const templateId = metric.tags.template_id || 'unknown';
            usage.templates[templateId] = (usage.templates[templateId] || 0) + 1;
        }

        // Analyze LLM provider usage (if available)
        const llmMetrics = this.metrics.getMetrics(METRICS.LLM_CALL_DURATION, {}, since);
        for (const metric of llmMetrics) {
            const provider = metric.tags.provider || 'unknown';
            usage.providers[provider] = (usage.providers[provider] || 0) + 1;
        }

        // Find peak hours
        const hourlyStats = this.generateHourlyStats(since, reportTypeMetrics);
        usage.peakHours = hourlyStats
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(stat => ({
                hour: stat.hour,
                count: stat.count,
                avgResponseTime: Math.round(stat.avgResponseTime)
            }));

        return usage;
    }

    /**
     * Get system health metrics
     * @returns {Object} Health metrics
     */
    async getHealthMetrics() {
        const health = this.metrics.getHealthMetrics();

        // Add cache health
        const cacheStats = this.cache.getStats();
        health.cache = {
            memoryItems: cacheStats.memory.size,
            memoryMaxSize: cacheStats.memory.maxSize,
            redisConnected: cacheStats.redis.connected,
            memoryUtilization: Math.round((cacheStats.memory.size / cacheStats.memory.maxSize) * 100)
        };

        // Add system recommendations based on health
        health.status = this.calculateHealthStatus(health);

        return health;
    }

    /**
     * Generate AI-powered recommendations based on analytics
     * @returns {Array} Array of recommendations
     */
    async generateRecommendations() {
        const recommendations = [];
        const recentHealth = this.metrics.getHealthMetrics();

        // Performance recommendations
        if (recentHealth.report_generation.avg_duration_ms > 30000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'High Average Response Time',
                description: `Average report generation time is ${recentHealth.report_generation.avg_duration_ms}ms. Consider optimizing LLM calls or increasing cache hit ratios.`,
                suggestion: 'Review cache configuration and consider upgrading LLM provider tier.'
            });
        }

        // Cache recommendations
        if (recentHealth.cache && recentHealth.cache.memoryUtilization > 90) {
            recommendations.push({
                type: 'cache',
                priority: 'medium',
                title: 'High Memory Cache Utilization',
                description: `Memory cache is ${recentHealth.cache.memoryUtilization}% full. Consider increasing cache size or enabling Redis.`,
                suggestion: 'Increase memory cache size or configure Redis for better performance.'
            });
        }

        // Reliability recommendations
        if (recentHealth.report_generation.success_rate_percent < 95) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: 'Low Success Rate',
                description: `Report generation success rate is ${recentHealth.report_generation.success_rate_percent}%. This indicates reliability issues.`,
                suggestion: 'Check LLM provider status, review error logs, and consider implementing additional retry mechanisms.'
            });
        }

        // Usage pattern recommendations
        const usage = await this.getUsageMetrics(Date.now() - (24 * 60 * 60 * 1000));
        if (usage.peakHours && usage.peakHours.length > 0) {
            const peakHour = usage.peakHours[0];
            if (peakHour.count > 10) {
                recommendations.push({
                    type: 'scaling',
                    priority: 'medium',
                    title: 'High Peak Hour Usage',
                    description: `Peak usage hour shows ${peakHour.count} reports. Consider implementing load balancing or batch processing.`,
                    suggestion: 'Consider implementing batch report generation or scheduling reports during off-peak hours.'
                });
            }
        }

        return recommendations;
    }

    /**
     * Generate time intervals for trend analysis
     * @param {number} start - Start timestamp
     * @param {number} end - End timestamp
     * @param {string} groupBy - Grouping interval ('hour', 'day', 'week')
     * @returns {Array} Array of time intervals
     */
    generateTimeIntervals(start, end, groupBy) {
        const intervals = [];
        const intervalMs = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000
        };

        const step = intervalMs[groupBy] || intervalMs.hour;

        for (let current = start; current < end; current += step) {
            intervals.push({
                start: current,
                end: Math.min(current + step, end)
            });
        }

        return intervals;
    }

    /**
     * Generate hourly statistics for peak analysis
     * @param {number} since - Timestamp to analyze from
     * @param {Array} metrics - Metrics array
     * @returns {Array} Hourly statistics
     */
    generateHourlyStats(since, metrics) {
        const hourlyStats = new Map();

        for (const metric of metrics) {
            const hour = new Date(metric.timestamp).getHours();
            if (!hourlyStats.has(hour)) {
                hourlyStats.set(hour, { hour, count: 0, totalResponseTime: 0 });
            }
            const stat = hourlyStats.get(hour);
            stat.count++;
            stat.totalResponseTime += metric.value;
        }

        return Array.from(hourlyStats.values()).map(stat => ({
            hour: stat.hour,
            count: stat.count,
            avgResponseTime: stat.totalResponseTime / stat.count
        }));
    }

    /**
     * Calculate overall health status
     * @param {Object} health - Health metrics
     * @returns {string} Health status
     */
    calculateHealthStatus(health) {
        let score = 100;

        // Deduct points for poor performance
        if (health.report_generation.avg_duration_ms > 60000) score -= 30;
        else if (health.report_generation.avg_duration_ms > 30000) score -= 15;

        // Deduct points for low success rate
        if (health.report_generation.success_rate_percent < 90) score -= 25;
        else if (health.report_generation.success_rate_percent < 95) score -= 10;

        // Deduct points for high memory usage
        if (health.cache && health.cache.memoryUtilization > 90) score -= 10;

        // Determine status
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'fair';
        return 'poor';
    }

    /**
     * Export metrics in Prometheus format
     * @returns {string} Prometheus-formatted metrics
     */
    exportPrometheusMetrics() {
        return this.metrics.toPrometheusFormat();
    }

    /**
     * Get real-time metrics for monitoring dashboards
     * @returns {Object} Real-time metrics
     */
    getRealTimeMetrics() {
        const lastHour = Date.now() - (60 * 60 * 1000);
        const last5Minutes = Date.now() - (5 * 60 * 1000);

        return {
            lastHour: this.getSummaryMetrics(lastHour),
            last5Minutes: this.getSummaryMetrics(last5Minutes),
            cacheStats: this.cache.getStats(),
            activeConnections: 0, // Could be populated from connection tracking
            queueLength: 0 // Could be populated from batch processing queue
        };
    }
}

// Create singleton analytics dashboard instance
let analyticsDashboard = null;

function getAnalyticsDashboard() {
    if (!analyticsDashboard) {
        analyticsDashboard = new AnalyticsDashboard();
    }
    return analyticsDashboard;
}

module.exports = {
    AnalyticsDashboard,
    getAnalyticsDashboard
};
