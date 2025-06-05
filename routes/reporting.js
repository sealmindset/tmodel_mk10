/**
 * Routes for Reporting Features
 */
const express = require('express');
const router = express.Router();

// GET /reporting/prompt-manager - Serves the Report Prompt Manager UI
router.get('/prompt-manager', (req, res) => {
    // You can pass initial data to the EJS template if needed, e.g., list of report types
    // For now, report types are hardcoded in the EJS select dropdown
    res.render('reportPromptManager', {
        title: 'Report Prompt Manager',
        user: req.user // Assuming user object is available if auth was in place
    });
});

module.exports = router;
