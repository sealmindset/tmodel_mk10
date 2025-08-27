/**
 * API Routes for Report Generation
 */
const express = require('express');
const ReportRunner = require('../../reporting/reportRunner'); // Correct path to reportRunner
const router = express.Router();

// POST /api/reports/generate - Generate a report
router.post('/generate', async (req, res) => {
    // Backward compatibility: allow promptId as alias
    let { reportType, templateId, promptId, filters } = req.body;
    if (templateId == null && promptId != null) {
        templateId = promptId;
    }

    if (!reportType || templateId == null || templateId === '') {
        console.warn('[API] /api/reports/generate missing fields', { reportType, templateId, promptId });
        return res.status(400).json({ error: 'Missing required fields: reportType and templateId.' });
    }

    try {
        // Accept UUID or numeric id; let ReportRunner resolve
        const tidRaw = (typeof templateId === 'string') ? templateId.trim() : templateId;
        console.log('[API] /api/reports/generate request', { reportType, templateId: tidRaw });
        const generatedContent = await ReportRunner.generateReport(reportType, tidRaw, (filters || {}));
        res.json({ 
            reportType: reportType,
            templateId: tidRaw,
            generatedReport: generatedContent 
        });
    } catch (error) {
        console.error(`[API] Error generating report ${reportType} with template ${templateId}:`, error);
        const msg = (error && error.message) ? error.message.toLowerCase() : '';
        if (msg.includes('not found')) {
            return res.status(404).json({ error: 'Template not found', details: error.message });
        }
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

module.exports = router;
