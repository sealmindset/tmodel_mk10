/**
 * Scheduled Reports API Routes
 *
 * Provides endpoints for managing scheduled report generation
 */

const express = require('express');
const { getReportScheduler } = require('../utils/reportScheduler');
const { createValidationMiddleware } = require('../middleware/validation');
const router = express.Router();

// Initialize scheduler
const scheduler = getReportScheduler({
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 5
});

// Validation schemas
const scheduleValidation = {
    createSchedule: {
        name: { type: 'string', required: true, maxLength: 100 },
        cronExpression: { type: 'string', required: true, maxLength: 50 },
        reportType: { type: 'string', required: true, maxLength: 50 },
        templateId: { type: 'string', required: true, maxLength: 100 },
        projectIds: { type: 'array', required: false, maxLength: 50 },
        filters: { type: 'object', required: false },
        delivery: { type: 'object', required: false },
        enabled: { type: 'boolean', required: false },
        conditions: { type: 'object', required: false }
    },
    updateSchedule: {
        name: { type: 'string', required: false, maxLength: 100 },
        cronExpression: { type: 'string', required: false, maxLength: 50 },
        reportType: { type: 'string', required: false, maxLength: 50 },
        templateId: { type: 'string', required: false, maxLength: 100 },
        projectIds: { type: 'array', required: false, maxLength: 50 },
        filters: { type: 'object', required: false },
        delivery: { type: 'object', required: false },
        enabled: { type: 'boolean', required: false },
        conditions: { type: 'object', required: false }
    }
};

// GET /api/scheduler/schedules - Get all schedules
router.get('/schedules', async (req, res) => {
    try {
        const schedules = scheduler.getSchedules();
        res.json({
            success: true,
            data: schedules
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error getting schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedules',
            details: error.message
        });
    }
});

// GET /api/scheduler/schedules/:id - Get specific schedule
router.get('/schedules/:id', async (req, res) => {
    try {
        const schedule = scheduler.getSchedule(req.params.id);

        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error getting schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedule',
            details: error.message
        });
    }
});

// POST /api/scheduler/schedules - Create new schedule
router.post('/schedules', createValidationMiddleware('createSchedule'), async (req, res) => {
    try {
        const config = req.body;

        // Add server-side defaults
        config.enabled = config.enabled !== false;
        config.conditions = config.conditions || {};

        const scheduleId = scheduler.scheduleReport(config);

        res.status(201).json({
            success: true,
            data: {
                scheduleId,
                message: 'Schedule created successfully'
            }
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error creating schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create schedule',
            details: error.message
        });
    }
});

// PUT /api/scheduler/schedules/:id - Update schedule
router.put('/schedules/:id', createValidationMiddleware('updateSchedule'), async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const updates = req.body;

        const success = scheduler.updateSchedule(scheduleId, updates);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.json({
            success: true,
            data: {
                scheduleId,
                message: 'Schedule updated successfully'
            }
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error updating schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update schedule',
            details: error.message
        });
    }
});

// DELETE /api/scheduler/schedules/:id - Delete schedule
router.delete('/schedules/:id', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const success = scheduler.removeSchedule(scheduleId);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.json({
            success: true,
            data: {
                scheduleId,
                message: 'Schedule deleted successfully'
            }
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error deleting schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete schedule',
            details: error.message
        });
    }
});

// POST /api/scheduler/schedules/:id/trigger - Manually trigger schedule
router.post('/schedules/:id/trigger', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const result = await scheduler.triggerSchedule(scheduleId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error triggering schedule:', error);

        if (error.message.includes('already running')) {
            return res.status(409).json({
                success: false,
                error: 'Schedule is already running',
                details: error.message
            });
        }

        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found',
                details: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to trigger schedule',
            details: error.message
        });
    }
});

// GET /api/scheduler/stats - Get scheduler statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = scheduler.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduler statistics',
            details: error.message
        });
    }
});

// POST /api/scheduler/shutdown - Gracefully shutdown scheduler
router.post('/shutdown', async (req, res) => {
    try {
        await scheduler.shutdown();
        res.json({
            success: true,
            data: {
                message: 'Scheduler shutdown initiated'
            }
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error shutting down scheduler:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to shutdown scheduler',
            details: error.message
        });
    }
});

// GET /api/scheduler/examples - Get example schedule configurations
router.get('/examples', async (req, res) => {
    try {
        const examples = {
            daily_report: {
                name: 'Daily Project Summary',
                cronExpression: '0 9 * * *', // 9 AM daily
                reportType: 'project_portfolio',
                templateId: 'daily-summary-template',
                projectIds: [], // Will be populated based on user projects
                filters: {},
                delivery: {
                    email: {
                        enabled: true,
                        recipients: ['team@example.com'],
                        subject: 'Daily Project Summary Report'
                    }
                },
                conditions: {
                    businessHoursOnly: false,
                    weekdaysOnly: true
                }
            },
            weekly_vulnerability_scan: {
                name: 'Weekly Vulnerability Assessment',
                cronExpression: '0 10 * * 1', // 10 AM every Monday
                reportType: 'safeguard_status',
                templateId: 'vulnerability-template',
                projectIds: [], // All projects
                filters: {
                    severity: 'High,Medium'
                },
                delivery: {
                    webhook: {
                        enabled: true,
                        url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
                        headers: {}
                    }
                },
                conditions: {
                    weekdaysOnly: true
                }
            },
            monthly_compliance: {
                name: 'Monthly Compliance Report',
                cronExpression: '0 8 1 * *', // 8 AM on the 1st of every month
                reportType: 'component_inventory',
                templateId: 'compliance-template',
                projectIds: [], // All projects
                filters: {
                    compliance_required: true
                },
                delivery: {
                    filesystem: {
                        enabled: true,
                        directory: './monthly-reports'
                    },
                    email: {
                        enabled: true,
                        recipients: ['compliance@example.com'],
                        subject: 'Monthly Compliance Report'
                    }
                }
            }
        };

        res.json({
            success: true,
            data: examples
        });
    } catch (error) {
        console.error('[SchedulerAPI] Error getting examples:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get examples',
            details: error.message
        });
    }
});

module.exports = router;
