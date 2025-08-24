/**
 * API Routes for Report Generation
 */
const express = require('express');
const ReportRunner = require('../../reporting/reportRunner'); // Correct path to reportRunner
const router = express.Router();

// POST /api/reports/generate - Generate a report
router.post('/generate', async (req, res) => {
    const { reportType, templateId, filters } = req.body;

    if (!reportType || templateId == null) {
        return res.status(400).json({ error: 'Missing required fields: reportType and templateId.' });
    }

    try {
        console.log(`[API] Received request to generate report: ${reportType}, Template: ${templateId}`);
        const generatedContent = await ReportRunner.generateReport(reportType, templateId, (filters || {}));
        res.json({ 
            reportType: reportType,
            templateId: templateId,
            generatedReport: generatedContent 
        });
    } catch (error) {
        console.error(`[API] Error generating report ${reportType} with template ${templateId}:`, error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

module.exports = router;
