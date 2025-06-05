/**
 * API Routes for Report Generation
 */
const express = require('express');
const ReportRunner = require('../../reporting/reportRunner'); // Correct path to reportRunner
const router = express.Router();

// POST /api/reports/generate - Generate a report
router.post('/generate', async (req, res) => {
    const { reportType, promptId, filters } = req.body;

    if (!reportType || !promptId) {
        return res.status(400).json({ error: 'Missing required fields: reportType and promptId.' });
    }

    try {
        console.log(`[API] Received request to generate report: ${reportType}, Prompt: ${promptId}`);
        const generatedContent = await ReportRunner.generateReport(reportType, promptId, filters || {});
        res.json({ 
            reportType: reportType,
            promptId: promptId,
            generatedReport: generatedContent 
        });
    } catch (error) {
        console.error(`[API] Error generating report ${reportType} with prompt ${promptId}:`, error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

module.exports = router;
