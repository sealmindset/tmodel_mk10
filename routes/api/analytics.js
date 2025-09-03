/**
 * Analytics API Routes
 *
 * Provides endpoints for analytics dashboard, metrics export, and system monitoring
 */

const express = require('express');
const { getAnalyticsDashboard } = require('../utils/analyticsDashboard');
const { getMetricsCollector } = require('../utils/metrics');
const router = express.Router();

// Initialize analytics dashboard
const analyticsDashboard = getAnalyticsDashboard();

// GET /api/analytics/dashboard - Get comprehensive analytics dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const groupBy = req.query.groupBy || 'hour';

        console.log(`[AnalyticsAPI] Generating dashboard for ${hours} hours, grouped by ${groupBy}`);

        const dashboard = await analyticsDashboard.getDashboardData({
            hours,
            groupBy
        });

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate analytics dashboard',
            details: error.message
        });
    }
});

// GET /api/analytics/health - Get system health metrics
router.get('/health', async (req, res) => {
    try {
        const health = await analyticsDashboard.getHealthMetrics();

        res.json({
            success: true,
            data: health
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get health metrics',
            details: error.message
        });
    }
});

// GET /api/analytics/realtime - Get real-time metrics for monitoring
router.get('/realtime', async (req, res) => {
    try {
        const realTimeMetrics = analyticsDashboard.getRealTimeMetrics();

        res.json({
            success: true,
            data: realTimeMetrics
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Real-time metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get real-time metrics',
            details: error.message
        });
    }
});

// GET /api/analytics/metrics - Export metrics in Prometheus format
router.get('/metrics', async (req, res) => {
    try {
        const prometheusMetrics = analyticsDashboard.exportPrometheusMetrics();

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(prometheusMetrics);

    } catch (error) {
        console.error('[AnalyticsAPI] Metrics export error:', error);
        res.status(500).send('# Error exporting metrics\n');
    }
});

// GET /api/analytics/summary - Get summary statistics
router.get('/summary', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const since = Date.now() - (hours * 60 * 60 * 1000);

        const summary = await analyticsDashboard.getSummaryMetrics(since);

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get summary metrics',
            details: error.message
        });
    }
});

// GET /api/analytics/usage - Get usage patterns and trends
router.get('/usage', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const since = Date.now() - (hours * 60 * 60 * 1000);
        const groupBy = req.query.groupBy || 'hour';

        const usage = await analyticsDashboard.getUsageMetrics(since, groupBy);

        res.json({
            success: true,
            data: usage
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Usage analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get usage analytics',
            details: error.message
        });
    }
});

// GET /api/analytics/performance - Get performance metrics and trends
router.get('/performance', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const since = Date.now() - (hours * 60 * 60 * 1000);
        const groupBy = req.query.groupBy || 'hour';

        const performance = await analyticsDashboard.getPerformanceMetrics(since, groupBy);

        res.json({
            success: true,
            data: performance
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Performance analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance analytics',
            details: error.message
        });
    }
});

// POST /api/analytics/alerts - Check for alerts and recommendations
router.post('/alerts', async (req, res) => {
    try {
        const recommendations = await analyticsDashboard.generateRecommendations();
        const alerts = recommendations.filter(rec => rec.priority === 'high');

        res.json({
            success: true,
            data: {
                alerts,
                recommendations,
                alertCount: alerts.length,
                recommendationCount: recommendations.length
            }
        });

    } catch (error) {
        console.error('[AnalyticsAPI] Alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get alerts and recommendations',
            details: error.message
        });
    }
});

module.exports = router;
