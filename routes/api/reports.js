/**
 * API Routes for Report Generation
 */
const express = require('express');
const ReportRunner = require('../../reporting/reportRunner'); // Correct path to reportRunner
const { createReportLimiter } = require('../../middleware/rateLimiter');
const { createValidationMiddleware } = require('../../middleware/validation');
const { BatchReportGenerator } = require('../../utils/batchReportGenerator');
const router = express.Router();

// Apply rate limiting to report generation
const reportLimiter = createReportLimiter();

// Apply validation middleware
const reportValidation = createValidationMiddleware('reportsGenerate');

// Initialize batch report generator
const batchGenerator = new BatchReportGenerator({
    maxConcurrent: 3,
    timeoutMs: 120000 // 2 minutes per report
});

// POST /api/reports/generate - Generate a report
router.post('/generate', reportLimiter.middleware(), reportValidation, async (req, res) => {
    // Check if client requested streaming response
    const acceptHeader = req.headers.accept || '';
    const wantsStreaming = acceptHeader.includes('text/event-stream') ||
                          (req.query && req.query.stream === 'true');

    if (wantsStreaming) {
        return handleStreamingReport(req, res);
    }

    // Standard non-streaming response (existing logic)
    return handleStandardReport(req, res);
});

async function handleStreamingReport(req, res) {
    console.log('[API] /api/reports/generate streaming request');

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        // Prevent proxy buffering (e.g., nginx) which breaks SSE streaming
        'X-Accel-Buffering': 'no'
    });

    // Send initial connection event
    res.write('event: connected\n');
    res.write('data: {"status": "connected", "message": "Starting report generation"}\n\n');

    // Backward compatibility: allow promptId as alias
    let { reportType, templateId, promptId, filters } = req.body;
    if (templateId == null && promptId != null) {
        templateId = promptId;
    }

    if (!reportType || templateId == null || templateId === '') {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({
            error: 'Missing required fields: reportType and templateId.'
        })}\n\n`);
        res.end();
        return;
    }

    // Create route-level AbortController and timeout safety net
    const controller = new AbortController();
    const { signal } = controller;
    const ROUTE_TIMEOUT_MS = 120000; // 2 minutes for streaming
    let routeTimer = null;

    const cleanup = () => {
        try { if (routeTimer) clearTimeout(routeTimer); } catch (_) {}
        // Remove listeners
        try { req.off('aborted', onAborted); } catch (_) {}
        try { req.off('close', onClose); } catch (_) {}
        try { res.off('close', onClose); } catch (_) {}
    };

    const onAborted = () => {
        console.warn('[API] Streaming /api/reports/generate request aborted by client');
        try { controller.abort(); } catch (_) {}
        cleanup();
    };
    const onClose = () => {
        // Only abort if response hasn't finished
        if (!res.writableEnded) {
            console.warn('[API] Streaming /api/reports/generate connection closed before response finished');
            try { controller.abort(); } catch (_) {}
        }
        cleanup();
    };

    req.on('aborted', onAborted);
    req.on('close', onClose);
    res.on('close', onClose);

    routeTimer = setTimeout(() => {
        console.warn(`[API] Streaming /api/reports/generate exceeded ${ROUTE_TIMEOUT_MS}ms, aborting`);
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({
            error: 'Request timeout',
            message: 'Report generation took too long'
        })}\n\n`);
        try { controller.abort(); } catch (_) {}
        cleanup();
        res.end();
    }, ROUTE_TIMEOUT_MS);

    try {
        // Accept UUID or numeric id; let ReportRunner resolve
        const tidRaw = (typeof templateId === 'string') ? templateId.trim() : templateId;

        // Send progress update
        res.write('event: progress\n');
        res.write(`data: ${JSON.stringify({
            status: 'preparing',
            message: 'Preparing report generation',
            progress: 10
        })}\n\n`);

        console.log('[API] Streaming /api/reports/generate request', { reportType, templateId: tidRaw });

        // Call ReportRunner with progress callback
        const generatedContent = await generateReportWithProgress(
            reportType,
            tidRaw,
            (filters || {}),
            { signal },
            (progress) => {
                res.write('event: progress\n');
                res.write(`data: ${JSON.stringify(progress)}\n\n`);
            }
        );

        cleanup();

        // Diagnostics: Log generated content summary before sending final SSE
        try {
            const genStr = (typeof generatedContent === 'string') ? generatedContent : (generatedContent == null ? '' : String(generatedContent));
            console.log('[API] Streaming /api/reports/generate complete payload:', {
                length: genStr.length,
                preview: genStr.slice(0, 200)
            });
        } catch (_) {}

        // Send final result
        res.write('event: complete\n');
        res.write(`data: ${JSON.stringify({
            reportType: reportType,
            templateId: tidRaw,
            generatedReport: generatedContent,
            status: 'completed'
        })}\n\n`);

        res.end();

    } catch (error) {
        cleanup();
        console.error(`[API] Streaming error generating report ${reportType} with template ${templateId}:`, error);

        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({
            error: 'Failed to generate report',
            details: error.message,
            reportType,
            templateId
        })}\n\n`);

        res.end();
    }
}

async function handleStandardReport(req, res) {
    console.log('[API] /api/reports/generate standard request');

    // Backward compatibility: allow promptId as alias
    let { reportType, templateId, promptId, filters } = req.body;
    if (templateId == null && promptId != null) {
        templateId = promptId;
    }

    if (!reportType || templateId == null || templateId === '') {
        console.warn('[API] /api/reports/generate missing fields', { reportType, templateId, promptId });
        return res.status(400).json({ error: 'Missing required fields: reportType and templateId.' });
    }

    // Create route-level AbortController and timeout safety net
    const controller = new AbortController();
    const { signal } = controller;
    const ROUTE_TIMEOUT_MS = 60000; // Overall safety net; provider-specific defaults applied deeper
    let routeTimer = null;

    const cleanup = () => {
        try { if (routeTimer) clearTimeout(routeTimer); } catch (_) {}
        // Remove listeners
        try { req.off('aborted', onAborted); } catch (_) {}
        try { req.off('close', onClose); } catch (_) {}
        try { res.off('close', onClose); } catch (_) {}
    };

    const onAborted = () => {
        console.warn('[API] /api/reports/generate request aborted by client');
        try { controller.abort(); } catch (_) {}
        cleanup();
    };
    const onClose = () => {
        // Only abort if response hasn't finished
        if (!res.writableEnded) {
            console.warn('[API] /api/reports/generate connection closed before response finished');
            try { controller.abort(); } catch (_) {}
        }
        cleanup();
    };

    req.on('aborted', onAborted);
    req.on('close', onClose);
    res.on('close', onClose);

    routeTimer = setTimeout(() => {
        console.warn(`[API] /api/reports/generate exceeded ${ROUTE_TIMEOUT_MS}ms, aborting`);
        try { controller.abort(); } catch (_) {}
        // Send timeout response immediately if nothing has been sent yet
        if (!res.headersSent && !res.writableEnded) {
            try {
                return res.status(408).json({
                    error: 'Request timeout',
                    details: 'Report generation took too long'
                });
            } catch (_) {}
        }
        cleanup();
    }, ROUTE_TIMEOUT_MS);

    try {
        // Accept UUID or numeric id; let ReportRunner resolve
        const tidRaw = (typeof templateId === 'string') ? templateId.trim() : templateId;
        console.log('[API] /api/reports/generate request', { reportType, templateId: tidRaw });
        const generatedContent = await ReportRunner.generateReport(
            reportType,
            tidRaw,
            (filters || {}),
            { signal }
        );
        cleanup();
        if (res.headersSent || res.writableEnded) { return; }
        // Diagnostics: Log generated content summary before JSON response
        try {
            const genStr = (typeof generatedContent === 'string') ? generatedContent : (generatedContent == null ? '' : String(generatedContent));
            console.log('[API] /api/reports/generate standard response:', {
                length: genStr.length,
                preview: genStr.slice(0, 200)
            });
        } catch (_) {}
        return res.json({
            reportType: reportType,
            templateId: tidRaw,
            generatedReport: generatedContent
        });
    } catch (error) {
        cleanup();
        if (res.headersSent || res.writableEnded) { return; }
        console.error(`[API] Error generating report ${reportType} with template ${templateId}:`, error);
        const msg = (error && error.message) ? error.message.toLowerCase() : '';
        if (signal.aborted) {
            // Distinguish client abort vs timeout if possible
            const status = req.aborted ? 499 : 408;
            return res.status(status).json({ error: 'Request aborted', details: error.message || 'Aborted' });
        }
        if (msg.includes('not found')) {
            return res.status(404).json({ error: 'Template not found', details: error.message });
        }
        return res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
}

async function generateReportWithProgress(reportType, templateId, filters, options, progressCallback) {
    // Send initial progress
    progressCallback({
        status: 'loading_template',
        message: 'Loading report template',
        progress: 20
    });

    // Call the actual ReportRunner (we'll need to modify it to support progress callbacks)
    const result = await ReportRunner.generateReport(reportType, templateId, filters, options);

    // Send final progress before completion
    progressCallback({
        status: 'finalizing',
        message: 'Finalizing report',
        progress: 95
    });

    return result;
}

// POST /api/reports/generate-batch - Generate reports for multiple projects
router.post('/generate-batch', reportLimiter.middleware(), async (req, res) => {
    console.log('[API] /api/reports/generate-batch request');

    const { projectIds, reportType, templateId, filters } = req.body;

    // Validate required fields
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
        return res.status(400).json({
            error: 'Missing required field: projectIds (must be a non-empty array)'
        });
    }
    if (!reportType) {
        return res.status(400).json({
            error: 'Missing required field: reportType'
        });
    }
    if (!templateId) {
        return res.status(400).json({
            error: 'Missing required field: templateId'
        });
    }

    // Check if client requested streaming response
    const wantsStreaming = req.headers.accept?.includes('text/event-stream') ||
                          req.query.stream === 'true';

    try {
        // Validate project IDs
        const validProjectIds = await batchGenerator.validateProjectIds(projectIds);

        if (validProjectIds.length === 0) {
            return res.status(400).json({
                error: 'No valid project UUIDs provided'
            });
        }

        if (validProjectIds.length !== projectIds.length) {
            console.warn(`[API] Filtered ${projectIds.length - validProjectIds.length} invalid project IDs`);
        }

        if (wantsStreaming) {
            return handleStreamingBatchReport(validProjectIds, reportType, templateId, filters || {}, res);
        } else {
            // Standard batch processing
            const results = await batchGenerator.generateBatchReports(
                validProjectIds,
                reportType,
                templateId,
                filters || {}
            );

            return res.json({
                success: true,
                data: results
            });
        }

    } catch (error) {
        console.error('[API] Batch report generation error:', error);
        return res.status(500).json({
            error: 'Failed to process batch request',
            details: error.message
        });
    }
});

async function handleStreamingBatchReport(projectIds, reportType, templateId, filters, res) {
    console.log('[API] Streaming batch report generation for', projectIds.length, 'projects');

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        // Prevent proxy buffering (e.g., nginx) which breaks SSE streaming
        'X-Accel-Buffering': 'no'
    });

    try {
        await batchGenerator.generateBatchReportsWithProgress(
            projectIds,
            reportType,
            templateId,
            filters,
            (progress) => {
                res.write(`data: ${JSON.stringify(progress)}\n\n`);
            }
        );

        res.end();
    } catch (error) {
        console.error('[API] Streaming batch error:', error);
        res.write(`data: ${JSON.stringify({
            event: 'error',
            error: 'Batch processing failed',
            details: error.message
        })}\n\n`);
        res.end();
    }
}

module.exports = router;
