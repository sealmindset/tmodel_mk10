/**
 * Batch Report Generation
 *
 * Enables generating reports for multiple projects simultaneously
 * with progress tracking and error handling
 */

const ReportRunner = require('../reporting/reportRunner');
const { getMetricsCollector, METRICS } = require('../utils/metrics');

class BatchReportGenerator {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 3; // Max concurrent report generations
        this.timeoutMs = options.timeoutMs || 300000; // 5 minutes per report
        this.metrics = getMetricsCollector();
    }

    /**
     * Generate reports for multiple projects
     * @param {Array} projectIds - Array of project UUIDs
     * @param {string} reportType - Type of report to generate
     * @param {string|number} templateId - Template ID to use
     * @param {Object} baseFilters - Base filters to apply to all reports
     * @param {Object} options - Batch processing options
     * @returns {Promise<Object>} Batch results
     */
    async generateBatchReports(projectIds, reportType, templateId, baseFilters = {}, options = {}) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        console.log(`[BatchGenerator] Starting batch ${batchId} with ${projectIds.length} projects`);

        // Initialize batch results
        const results = {
            batchId,
            totalProjects: projectIds.length,
            completed: 0,
            failed: 0,
            results: [],
            errors: [],
            startTime,
            endTime: null,
            duration: null
        };

        // Create semaphore for concurrency control
        const semaphore = new Semaphore(this.maxConcurrent);

        // Process projects in batches
        const promises = projectIds.map(async (projectId, index) => {
            return semaphore.acquire().then(async (release) => {
                try {
                    const projectFilters = {
                        ...baseFilters,
                        projectUuid: projectId,
                        project_id: projectId
                    };

                    const reportOptions = {
                        timeoutMs: this.timeoutMs,
                        ...options
                    };

                    console.log(`[BatchGenerator] Processing project ${index + 1}/${projectIds.length}: ${projectId}`);

                    const reportResult = await ReportRunner.generateReport(
                        reportType,
                        templateId,
                        projectFilters,
                        reportOptions
                    );

                    results.completed++;
                    results.results.push({
                        projectId,
                        status: 'completed',
                        reportContent: reportResult,
                        generatedAt: new Date().toISOString()
                    });

                    // Record success metrics
                    this.metrics.increment(METRICS.REPORT_GENERATION_SUCCESS, {
                        batch_id: batchId,
                        report_type: reportType,
                        project_id: projectId
                    });

                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        projectId,
                        error: error.message,
                        stack: error.stack,
                        failedAt: new Date().toISOString()
                    });

                    console.error(`[BatchGenerator] Failed to generate report for project ${projectId}:`, error);

                    // Record error metrics
                    this.metrics.increment(METRICS.REPORT_GENERATION_ERRORS, {
                        batch_id: batchId,
                        report_type: reportType,
                        project_id: projectId,
                        error_type: error.name || 'Unknown'
                    });

                } finally {
                    release();
                }
            });
        });

        // Wait for all reports to complete
        await Promise.allSettled(promises);

        // Finalize batch results
        results.endTime = Date.now();
        results.duration = results.endTime - startTime;

        console.log(`[BatchGenerator] Completed batch ${batchId}: ${results.completed} successful, ${results.failed} failed, duration: ${results.duration}ms`);

        // Record batch metrics
        this.metrics.timing('batch_generation_duration', results.duration, {
            batch_id: batchId,
            total_projects: projectIds.length,
            success_count: results.completed,
            failure_count: results.failed
        });

        return results;
    }

    /**
     * Generate reports with streaming progress for UI
     * @param {Array} projectIds - Array of project UUIDs
     * @param {string} reportType - Type of report to generate
     * @param {string|number} templateId - Template ID to use
     * @param {Object} baseFilters - Base filters
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<Object>} Batch results
     */
    async generateBatchReportsWithProgress(projectIds, reportType, templateId, baseFilters, progressCallback) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        progressCallback({
            event: 'batch_started',
            batchId,
            totalProjects: projectIds.length,
            message: `Starting batch generation for ${projectIds.length} projects`,
            progress: 0
        });

        const results = {
            batchId,
            totalProjects: projectIds.length,
            completed: 0,
            failed: 0,
            results: [],
            errors: []
        };

        // Create semaphore for concurrency control
        const semaphore = new Semaphore(this.maxConcurrent);

        // Process projects
        const promises = projectIds.map(async (projectId, index) => {
            return semaphore.acquire().then(async (release) => {
                try {
                    const projectFilters = {
                        ...baseFilters,
                        projectUuid: projectId,
                        project_id: projectId
                    };

                    progressCallback({
                        event: 'project_started',
                        batchId,
                        projectId,
                        projectIndex: index + 1,
                        totalProjects: projectIds.length,
                        message: `Processing project ${index + 1}/${projectIds.length}: ${projectId.substring(0, 8)}...`,
                        progress: (index / projectIds.length) * 100
                    });

                    const reportResult = await ReportRunner.generateReport(
                        reportType,
                        templateId,
                        projectFilters,
                        { timeoutMs: this.timeoutMs }
                    );

                    results.completed++;
                    results.results.push({
                        projectId,
                        status: 'completed',
                        reportContent: reportResult
                    });

                    progressCallback({
                        event: 'project_completed',
                        batchId,
                        projectId,
                        projectIndex: index + 1,
                        totalProjects: projectIds.length,
                        completed: results.completed,
                        failed: results.failed,
                        message: `Completed project ${index + 1}/${projectIds.length}`,
                        progress: ((index + 1) / projectIds.length) * 100
                    });

                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        projectId,
                        error: error.message
                    });

                    progressCallback({
                        event: 'project_failed',
                        batchId,
                        projectId,
                        projectIndex: index + 1,
                        totalProjects: projectIds.length,
                        completed: results.completed,
                        failed: results.failed,
                        error: error.message,
                        message: `Failed project ${index + 1}/${projectIds.length}: ${error.message}`,
                        progress: ((index + 1) / projectIds.length) * 100
                    });

                } finally {
                    release();
                }
            });
        });

        await Promise.allSettled(promises);

        progressCallback({
            event: 'batch_completed',
            batchId,
            results,
            message: `Batch completed: ${results.completed} successful, ${results.failed} failed`,
            progress: 100
        });

        return results;
    }

    /**
     * Validate project IDs before batch processing
     * @param {Array} projectIds - Array of project IDs to validate
     * @returns {Promise<Array>} Array of valid project IDs
     */
    async validateProjectIds(projectIds) {
        if (!Array.isArray(projectIds) || projectIds.length === 0) {
            throw new Error('Project IDs must be a non-empty array');
        }

        // Remove duplicates and invalid UUIDs
        const uniqueIds = [...new Set(projectIds)];
        const validIds = uniqueIds.filter(id => {
            return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        });

        if (validIds.length === 0) {
            throw new Error('No valid project UUIDs provided');
        }

        if (validIds.length !== uniqueIds.length) {
            console.warn(`[BatchGenerator] Filtered ${uniqueIds.length - validIds.length} invalid project IDs`);
        }

        return validIds;
    }

    /**
     * Estimate batch processing time
     * @param {number} projectCount - Number of projects
     * @param {number} avgReportTime - Average time per report in ms
     * @returns {Object} Time estimates
     */
    estimateBatchTime(projectCount, avgReportTime = 30000) {
        const serialTime = projectCount * avgReportTime;
        const parallelTime = Math.ceil(projectCount / this.maxConcurrent) * avgReportTime;

        return {
            serial: {
                totalMs: serialTime,
                totalMinutes: Math.round(serialTime / 60000)
            },
            parallel: {
                totalMs: parallelTime,
                totalMinutes: Math.round(parallelTime / 60000)
            },
            concurrency: this.maxConcurrent,
            avgReportTimeMs: avgReportTime
        };
    }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.currentCount = 0;
        this.waitQueue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.currentCount < this.maxConcurrent) {
                this.currentCount++;
                resolve(this.release.bind(this));
            } else {
                this.waitQueue.push(resolve);
            }
        });
    }

    release() {
        this.currentCount--;
        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift();
            this.currentCount++;
            resolve(this.release.bind(this));
        }
    }
}

module.exports = {
    BatchReportGenerator
};
