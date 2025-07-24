// Generate Reports Route
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
 * GET /generate
 * Renders the report generation page where users select LLM model and template
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get projectId from query params
    const projectId = req.query.projectId;
    
    if (!projectId) {
      return res.redirect('/reports');
    }
    
    res.render('generate', {
      title: 'Generate Report',
      user: req.session.user,
      projectId
    });
  } catch (error) {
    console.error('Error rendering generate page:', error);
    res.status(500).render('error', {
      message: 'Error loading report generation page',
      error: error,
      user: req.session.user
    });
  }
});

module.exports = router;
