const express = require('express');
const router = express.Router();
const path = require('path');

// Reports routes - all will be mounted under /reports
// For all report routes, we'll serve the main app and let React handle routing
router.get('/', (req, res) => {
  res.render('reports', { 
    title: 'Reports',
    user: req.session.user || { username: 'Anonymous' }
  });
});

// Route for creating a new report for a specific project
router.get('/new/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  res.render('reportgen', {
    title: 'Generate New Report',
    user: req.session.user || { username: 'Anonymous' },
    projectId: projectId
  });
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
