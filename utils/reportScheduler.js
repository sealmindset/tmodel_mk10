/**
 * Scheduled Report Generation
 *
 * Provides cron-like scheduling for automated report generation
 * with configurable intervals, conditions, and delivery options
 */

const { ReportRunner } = require('../reporting/reportRunner');
const { BatchReportGenerator } = require('../utils/batchReportGenerator');
const { getMetricsCollector, METRICS } = require('../utils/metrics');

class ReportScheduler {
    constructor(options = {}) {
        this.schedules = new Map();
        this.runningJobs = new Map();
        this.metrics = getMetricsCollector();
        this.maxConcurrentJobs = options.maxConcurrentJobs || 5;
        this.enabled = options.enabled !== false;

        if (this.enabled) {
            console.log(`[ReportScheduler] Initialized with maxConcurrentJobs=${this.maxConcurrentJobs}`);
            this.startScheduler();
        }
    }

    /**
     * Schedule a report generation job
     * @param {Object} config - Schedule configuration
     * @param {string} config.id - Unique schedule ID
     * @param {string} config.name - Human-readable schedule name
     * @param {string} config.cronExpression - Cron expression (e.g., '0 9 * * 1' for Monday 9 AM)
     * @param {string} config.reportType - Type of report to generate
     * @param {string|number} config.templateId - Template ID to use
     * @param {Array} config.projectIds - Array of project UUIDs (optional, for batch reports)
     * @param {Object} config.filters - Report filters
     * @param {Object} config.delivery - Delivery configuration
     * @param {boolean} config.enabled - Whether the schedule is enabled
     * @param {Object} config.conditions - Execution conditions
     * @returns {string} Schedule ID
     */
    scheduleReport(config) {
        const scheduleId = config.id || `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const schedule = {
            id: scheduleId,
            name: config.name || `Scheduled Report ${scheduleId}`,
            cronExpression: config.cronExpression,
            reportType: config.reportType,
            templateId: config.templateId,
            projectIds: config.projectIds || [],
            filters: config.filters || {},
            delivery: config.delivery || {},
            enabled: config.enabled !== false,
            conditions: config.conditions || {},
            createdAt: new Date(),
            lastRun: null,
            nextRun: this.calculateNextRun(config.cronExpression),
            runCount: 0,
            successCount: 0,
            failureCount: 0,
            lastError: null
        };

        this.schedules.set(scheduleId, schedule);
        console.log(`[ReportScheduler] Scheduled report: ${schedule.name} (${scheduleId})`);

        return scheduleId;
    }

    /**
     * Update an existing schedule
     * @param {string} scheduleId - Schedule ID to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateSchedule(scheduleId, updates) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            return false;
        }

        Object.assign(schedule, updates);

        if (updates.cronExpression) {
            schedule.nextRun = this.calculateNextRun(updates.cronExpression);
        }

        console.log(`[ReportScheduler] Updated schedule: ${schedule.name} (${scheduleId})`);
        return true;
    }

    /**
     * Remove a schedule
     * @param {string} scheduleId - Schedule ID to remove
     * @returns {boolean} Success status
     */
    removeSchedule(scheduleId) {
        const removed = this.schedules.delete(scheduleId);
        if (removed) {
            console.log(`[ReportScheduler] Removed schedule: ${scheduleId}`);
        }
        return removed;
    }

    /**
     * Get all schedules
     * @returns {Array} Array of schedule objects
     */
    getSchedules() {
        return Array.from(this.schedules.values()).map(schedule => ({
            ...schedule,
            isRunning: this.runningJobs.has(schedule.id)
        }));
    }

    /**
     * Get a specific schedule
     * @param {string} scheduleId - Schedule ID
     * @returns {Object} Schedule object or null
     */
    getSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (schedule) {
            return {
                ...schedule,
                isRunning: this.runningJobs.has(scheduleId)
            };
        }
        return null;
    }

    /**
     * Manually trigger a scheduled report
     * @param {string} scheduleId - Schedule ID to trigger
     * @returns {Promise<Object>} Execution result
     */
    async triggerSchedule(scheduleId) {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule not found: ${scheduleId}`);
        }

        if (this.runningJobs.has(scheduleId)) {
            throw new Error(`Schedule already running: ${scheduleId}`);
        }

        return this.executeSchedule(schedule);
    }

    /**
     * Start the scheduler loop
     */
    startScheduler() {
        if (!this.enabled) return;

        console.log('[ReportScheduler] Starting scheduler loop');

        // Check for due schedules every minute
        this.schedulerInterval = setInterval(() => {
            this.checkSchedules();
        }, 60000); // Check every minute

        // Also check immediately
        this.checkSchedules();
    }

    /**
     * Stop the scheduler
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        console.log('[ReportScheduler] Scheduler stopped');
    }

    /**
     * Check for schedules that are due to run
     */
    async checkSchedules() {
        if (!this.enabled) return;

        const now = new Date();

        for (const schedule of this.schedules.values()) {
            if (!schedule.enabled) continue;
            if (this.runningJobs.has(schedule.id)) continue;
            if (!schedule.nextRun || schedule.nextRun > now) continue;

            // Check execution conditions
            if (!this.checkConditions(schedule)) continue;

            // Execute the schedule
            try {
                await this.executeSchedule(schedule);
            } catch (error) {
                console.error(`[ReportScheduler] Failed to execute schedule ${schedule.id}:`, error);
            }
        }
    }

    /**
     * Check if schedule conditions are met
     * @param {Object} schedule - Schedule to check
     * @returns {boolean} Whether conditions are met
     */
    checkConditions(schedule) {
        const conditions = schedule.conditions;

        // Check business hours
        if (conditions.businessHoursOnly) {
            const hour = new Date().getHours();
            if (hour < 9 || hour > 17) return false; // 9 AM to 5 PM
        }

        // Check weekdays only
        if (conditions.weekdaysOnly) {
            const day = new Date().getDay();
            if (day === 0 || day === 6) return false; // Not Saturday or Sunday
        }

        // Check custom condition function
        if (conditions.customCondition && typeof conditions.customCondition === 'function') {
            try {
                return conditions.customCondition();
            } catch (error) {
                console.warn(`[ReportScheduler] Custom condition error for ${schedule.id}:`, error);
                return false;
            }
        }

        return true;
    }

    /**
     * Execute a scheduled report
     * @param {Object} schedule - Schedule to execute
     * @returns {Promise<Object>} Execution result
     */
    async executeSchedule(schedule) {
        const startTime = Date.now();
        this.runningJobs.set(schedule.id, startTime);

        try {
            console.log(`[ReportScheduler] Executing schedule: ${schedule.name} (${schedule.id})`);

            let result;

            // Determine if this is a batch report or single report
            if (schedule.projectIds && schedule.projectIds.length > 0) {
                // Batch report
                const batchGenerator = new BatchReportGenerator();
                result = await batchGenerator.generateBatchReports(
                    schedule.projectIds,
                    schedule.reportType,
                    schedule.templateId,
                    schedule.filters
                );
            } else {
                // Single report (use filters to specify project)
                result = await ReportRunner.generateReport(
                    schedule.reportType,
                    schedule.templateId,
                    schedule.filters
                );
            }

            // Update schedule metadata
            schedule.lastRun = new Date();
            schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
            schedule.runCount++;
            schedule.successCount++;
            schedule.lastError = null;

            // Record metrics
            this.metrics.timing(METRICS.REPORT_GENERATION_DURATION,
                Date.now() - startTime,
                {
                    schedule_id: schedule.id,
                    report_type: schedule.reportType,
                    is_batch: !!(schedule.projectIds && schedule.projectIds.length > 0)
                }
            );

            // Handle delivery
            if (schedule.delivery && Object.keys(schedule.delivery).length > 0) {
                await this.deliverReport(schedule, result);
            }

            console.log(`[ReportScheduler] Schedule completed: ${schedule.name} (${schedule.id}) in ${Date.now() - startTime}ms`);

            return {
                scheduleId: schedule.id,
                success: true,
                executionTime: Date.now() - startTime,
                result,
                delivered: !!(schedule.delivery && Object.keys(schedule.delivery).length > 0)
            };

        } catch (error) {
            // Update schedule metadata for failure
            schedule.lastRun = new Date();
            schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
            schedule.runCount++;
            schedule.failureCount++;
            schedule.lastError = error.message;

            // Record error metrics
            this.metrics.increment(METRICS.REPORT_GENERATION_ERRORS, {
                schedule_id: schedule.id,
                report_type: schedule.reportType,
                error_type: error.name || 'Unknown'
            });

            console.error(`[ReportScheduler] Schedule failed: ${schedule.name} (${schedule.id}):`, error);

            throw error;

        } finally {
            this.runningJobs.delete(schedule.id);
        }
    }

    /**
     * Deliver report based on delivery configuration
     * @param {Object} schedule - Schedule configuration
     * @param {Object} result - Report generation result
     */
    async deliverReport(schedule, result) {
        const delivery = schedule.delivery;

        try {
            // Email delivery
            if (delivery.email && delivery.email.enabled) {
                await this.deliverByEmail(schedule, result, delivery.email);
            }

            // Webhook delivery
            if (delivery.webhook && delivery.webhook.enabled) {
                await this.deliverByWebhook(schedule, result, delivery.webhook);
            }

            // File system delivery
            if (delivery.filesystem && delivery.filesystem.enabled) {
                await this.deliverToFilesystem(schedule, result, delivery.filesystem);
            }

            console.log(`[ReportScheduler] Delivered report for schedule: ${schedule.name}`);
        } catch (error) {
            console.error(`[ReportScheduler] Delivery failed for schedule ${schedule.id}:`, error);
        }
    }

    /**
     * Deliver report by email
     * @param {Object} schedule - Schedule configuration
     * @param {Object} result - Report result
     * @param {Object} config - Email configuration
     */
    async deliverByEmail(schedule, result, config) {
        // This would integrate with an email service like SendGrid, SES, etc.
        console.log(`[ReportScheduler] Would send email for ${schedule.name} to: ${config.recipients?.join(', ')}`);

        // Placeholder for email integration
        // const emailService = require('../services/emailService');
        // await emailService.sendReport(schedule, result, config);
    }

    /**
     * Deliver report by webhook
     * @param {Object} schedule - Schedule configuration
     * @param {Object} result - Report result
     * @param {Object} config - Webhook configuration
     */
    async deliverByWebhook(schedule, result, config) {
        try {
            const payload = {
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                timestamp: new Date().toISOString(),
                result: result
            };

            const response = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
            }

            console.log(`[ReportScheduler] Webhook delivered for ${schedule.name} to ${config.url}`);
        } catch (error) {
            console.error(`[ReportScheduler] Webhook delivery failed for ${schedule.name}:`, error);
            throw error;
        }
    }

    /**
     * Deliver report to filesystem
     * @param {Object} schedule - Schedule configuration
     * @param {Object} result - Report result
     * @param {Object} config - Filesystem configuration
     */
    async deliverToFilesystem(schedule, result, config) {
        const fs = require('fs').promises;
        const path = require('path');

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${schedule.id}_${timestamp}.json`;
            const filepath = path.join(config.directory || './reports', filename);

            // Ensure directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            // Write report to file
            await fs.writeFile(filepath, JSON.stringify({
                schedule: {
                    id: schedule.id,
                    name: schedule.name,
                    reportType: schedule.reportType
                },
                timestamp: new Date().toISOString(),
                result: result
            }, null, 2));

            console.log(`[ReportScheduler] Report saved to filesystem: ${filepath}`);
        } catch (error) {
            console.error(`[ReportScheduler] Filesystem delivery failed for ${schedule.name}:`, error);
            throw error;
        }
    }

    /**
     * Calculate next run time from cron expression
     * @param {string} cronExpression - Cron expression
     * @returns {Date} Next run time
     */
    calculateNextRun(cronExpression) {
        // Simple cron parser for common patterns
        // This is a basic implementation - for production, consider using a library like 'node-cron' or 'cron-parser'

        try {
            const parts = cronExpression.split(' ');
            if (parts.length !== 5) {
                throw new Error('Invalid cron expression');
            }

            const [minute, hour, day, month, dayOfWeek] = parts;
            const now = new Date();

            // Handle simple patterns
            if (minute === '*' && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
                // Every minute
                return new Date(now.getTime() + 60000);
            }

            if (minute === '0' && hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
                // Hourly at specific minute
                const nextHour = new Date(now);
                nextHour.setHours(parseInt(hour), parseInt(minute), 0, 0);

                if (nextHour <= now) {
                    nextHour.setDate(nextHour.getDate() + 1);
                }

                return nextHour;
            }

            // Default to every hour for unsupported patterns
            const nextHour = new Date(now);
            nextHour.setHours(now.getHours() + 1, 0, 0, 0);
            return nextHour;

        } catch (error) {
            console.warn(`[ReportScheduler] Error parsing cron expression "${cronExpression}":`, error);
            // Default to every hour
            const nextHour = new Date(Date.now() + 3600000);
            return nextHour;
        }
    }

    /**
     * Get scheduler statistics
     * @returns {Object} Scheduler statistics
     */
    getStats() {
        const schedules = Array.from(this.schedules.values());
        const running = Array.from(this.runningJobs.keys());

        return {
            totalSchedules: schedules.length,
            enabledSchedules: schedules.filter(s => s.enabled).length,
            disabledSchedules: schedules.filter(s => !s.enabled).length,
            runningJobs: running.length,
            completedRuns: schedules.reduce((sum, s) => sum + s.runCount, 0),
            successfulRuns: schedules.reduce((sum, s) => sum + s.successCount, 0),
            failedRuns: schedules.reduce((sum, s) => sum + s.failureCount, 0),
            nextRuns: schedules
                .filter(s => s.enabled && s.nextRun)
                .sort((a, b) => a.nextRun - b.nextRun)
                .slice(0, 5)
                .map(s => ({
                    id: s.id,
                    name: s.name,
                    nextRun: s.nextRun
                }))
        };
    }

    /**
     * Gracefully shutdown scheduler
     */
    async shutdown() {
        console.log('[ReportScheduler] Shutting down...');

        this.stopScheduler();

        // Wait for running jobs to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const shutdownPromise = new Promise(resolve => {
            const checkRunning = () => {
                if (this.runningJobs.size === 0) {
                    resolve();
                } else {
                    setTimeout(checkRunning, 1000);
                }
            };
            checkRunning();
        });

        try {
            await Promise.race([
                shutdownPromise,
                new Promise(resolve => setTimeout(resolve, shutdownTimeout))
            ]);
        } catch (error) {
            console.warn('[ReportScheduler] Shutdown timeout exceeded, forcing shutdown');
        }

        console.log('[ReportScheduler] Shutdown complete');
    }
}

// Create singleton scheduler instance
let reportScheduler = null;

function getReportScheduler(options = {}) {
    if (!reportScheduler) {
        reportScheduler = new ReportScheduler(options);
    }
    return reportScheduler;
}

module.exports = {
    ReportScheduler,
    getReportScheduler
};
