// View/Edit Report Route
const express = require('express');
const router = express.Router();
const path = require('path');

// Function to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

/**
 * GET /viewrpt
 * Renders the report viewing/editing page
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get report ID from query params
    const reportId = req.query.id;
    
    if (!reportId) {
      return res.redirect('/reports');
    }
    
    res.render('viewrpt', {
      title: 'View Report',
      user: req.session.user,
      reportId
    });
  } catch (error) {
    console.error('Error rendering view report page:', error);
    res.status(500).render('error', {
      message: 'Error loading report view page',
      error: error,
      user: req.session.user
    });
  }
});

module.exports = router;
