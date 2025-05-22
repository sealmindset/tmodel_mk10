/**
 * API Explorer Routes
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');


// Get auth middleware - try both possible locations
let ensureAuthenticated;
try {
  // First try to import from the root auth module
  ensureAuthenticated = require('../auth')(express()).ensureAuthenticated;
} catch (error) {
  console.log('Using direct middleware import for auth');
  // Fall back to middleware folder
  ensureAuthenticated = require('../middleware/auth').ensureAuthenticated;
}

// Main API Explorer page
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get Rapid7 API URL and Key from environment variables only
    const rapid7ApiUrl = process.env.RAPID7_API_URL || 'http://localhost:3100';
    const rapid7ApiKey = process.env.RAPID7_API_KEY || 'test-api-key';

    // Check Rapid7 API connectivity
    let rapid7Status = false;
    let endpoints = [];
    let error = null;

    try {
      // First, try to get a list of available endpoints
      const response = await axios.get(`${rapid7ApiUrl}/api/endpoints`, {
        headers: {
          'Authorization': `Bearer ${rapid7ApiKey}`
        },
        timeout: 5000 // 5 second timeout
      });
      
      rapid7Status = true;
      endpoints = response.data.endpoints || [];
    } catch (err) {
      console.error('Error fetching Rapid7 API endpoints:', err.message);
      error = err.message;
    }

    res.render('api-explorer', {
      rapid7ApiUrl,
      rapid7Status,
      endpoints,
      error
    });
  } catch (error) {
    console.error('Error loading API Explorer page:', error);
    res.status(500).render('error', {
      message: 'Error loading API Explorer',
      error: error
    });
  }
});

// Endpoint to fetch data from a specific Rapid7 API endpoint
router.get('/endpoint-data', ensureAuthenticated, async (req, res) => {
  try {
    const { path, method } = req.query;
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // Get Rapid7 API URL and key
    const rapid7ApiUrl = process.env.RAPID7_API_URL || 'http://localhost:3100';
    const rapid7ApiKey = process.env.RAPID7_API_KEY || 'test-api-key';
    
    const apiMethod = method?.toLowerCase() || 'get';
    
    try {
      const response = await axios({
        method: apiMethod,
        url: `${rapid7ApiUrl}${path}`,
        headers: {
          'Authorization': `Bearer ${rapid7ApiKey}`
        },
        timeout: 10000 // 10 second timeout
      });
      
      res.json({
        success: true,
        data: response.data,
        status: response.status
      });
    } catch (err) {
      console.error(`Error fetching data from ${path}:`, err.message);
      res.status(500).json({
        success: false,
        error: err.message,
        status: err.response?.status || 500
      });
    }
  } catch (error) {
    console.error('Error in endpoint-data route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
