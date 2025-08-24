const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db/db');

// Reports routes - all will be mounted under /reports
// For all report routes, we'll serve the main app and let React handle routing
router.get('/', (req, res) => {
  res.render('reports', { 
    title: 'Reports',
    user: req.session.user || { username: 'Anonymous' }
  });
});

// New: Report Generation landing page (mirrors create/ flow style)
router.get('/generate', (req, res) => {
  try {
    return res.render('reports-generate', {
      title: 'Generate Report',
      user: req.session.user || { username: 'Anonymous' }
    });
  } catch (err) {
    console.error('[REPORTS] Error rendering /reports/generate:', err);
    return res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading report generation page',
      errorDetails: err.message
    });
  }
});

// Helper: Validate UUID v4
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Route for creating a new report for a specific project
router.get('/new/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    if (!isValidUUID(projectId)) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Invalid project ID. Please check the URL or contact support.'
      });
    }

    const { rows } = await db.query('SELECT id, name FROM threat_model.projects WHERE id = $1', [projectId]);
    if (rows.length === 0) {
      return res.status(404).render('error', { errorCode: 404, errorMessage: 'Project not found' });
    }
    const projectTitle = rows[0]?.name || '';

    res.render('reports-generate', {
      title: 'Generate Report',
      user: req.session.user || { username: 'Anonymous' },
      projectId,
      projectTitle
    });
  } catch (error) {
    console.error('[REPORTS] Error rendering report create page:', error);
    return res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading report creation form',
      errorDetails: error.message
    });
  }
});

// Route for viewing a specific report
router.get('/view/:reportId', (req, res) => {
  const reportId = req.params.reportId;
  res.render('viewrpt', {
    title: 'View Report',
    user: req.session.user || { username: 'Anonymous' },
    reportId: reportId
  });
});

// Route for editing a specific report
router.get('/edit/:reportId', (req, res) => {
  res.render('reports', {
    title: 'Edit Report',
    user: req.session.user || { username: 'Anonymous' }
  });
});

module.exports = router;
