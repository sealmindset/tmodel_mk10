/**
 * Rapid7 API Test Routes
 * 
 * This file contains routes for testing the Rapid7 API connection
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

const logger = require('../../utils/logger').forModule('rapid7-test');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * POST /api/rapid7-test/connection
 * Test connection to Rapid7 API with provided credentials
 */
router.post('/connection', ensureAuthenticated, async (req, res) => {
  logger.info('Testing Rapid7 connection with provided credentials');
  logger.debug('Request body received', { 
    apiUrlProvided: !!req.body.apiUrl,
    apiKeyLength: req.body.apiKey ? req.body.apiKey.length : 0
  });
  
  try {
    const { apiUrl, apiKey } = req.body;
    
    if (!apiUrl || !apiKey) {
      logger.warn('Missing required parameters for Rapid7 connection test');
      return res.status(400).json({
        success: false,
        message: 'API URL and API Key are required'
      });
    }
    
    // Validate URL format
    let validationUrl;
    try {
      // Format the URL properly
      let formattedUrl = apiUrl.trim();
      
      // Add https:// if missing
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      // Remove trailing slashes
      formattedUrl = formattedUrl.replace(/\/+$/, '');
      
      // Ensure the URL ends with /validate
      validationUrl = formattedUrl;
      if (!validationUrl.endsWith('/validate')) {
        validationUrl = `${validationUrl}/validate`;
      }
      
      // Verify it's a valid URL
      new URL(validationUrl);
    } catch (urlError) {
      logger.error('Invalid URL format', { apiUrl }, urlError);
      return res.status(400).json({
        success: false,
        message: `Invalid URL format: ${urlError.message}`
      });
    }
    
    logger.debug(`Testing Rapid7 connection to ${validationUrl}`);
    
    // Make a direct API call to validate the connection
    const response = await axios({
      method: 'GET',
      url: validationUrl,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true // Don't throw on any status code
    });
    
    logger.debug('Rapid7 validation response received', { 
      status: response.status,
      statusText: response.statusText,
      dataReceived: !!response.data
    });
    
    // Check if the response indicates authorization success
    if (response.status === 200) {
      logger.info('Rapid7 API connection test successful');
      return res.json({
        success: true,
        message: 'Connection successful',
        status: 'UP',
        data: response.data
      });
    } else {
      logger.warn('Rapid7 API connection test failed', { 
        status: response.status, 
        data: response.data 
      });
      return res.status(response.status).json({
        success: false,
        message: response.data?.message || 'Connection failed: Unexpected response',
        status: 'DOWN',
        data: response.data
      });
    }
  } catch (error) {
    console.error('Rapid7 API connection test failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Connection failed: ${error.message}`,
      error: error.response ? error.response.data : null
    });
  }
});

/**
 * GET /api/rapid7-test/connection
 * Test connection to Rapid7 API with stored credentials
 */
router.get('/connection', ensureAuthenticated, async (req, res) => {
  logger.info('Testing Rapid7 connection with stored credentials');
  try {
    // Get API URL and Key from environment variables
    const apiUrl = process.env.RAPID7_API_URL || null;
    const apiKey = process.env.RAPID7_API_KEY || null;
    
    if (!apiUrl || !apiKey) {
      logger.warn('Rapid7 API settings not configured');
      return res.status(400).json({
        success: false,
        message: 'Rapid7 API settings not configured',
        status: 'NOT_CONFIGURED'
      });
    }
    
    // Format the URL for validation
    let validationUrl = apiUrl;
    if (!validationUrl.endsWith('/validate')) {
      validationUrl = `${validationUrl}/validate`;
    }
    
    logger.debug(`Testing Rapid7 connection to ${validationUrl}`);
    
    // Make a direct API call to validate the connection
    const response = await axios({
      method: 'GET',
      url: validationUrl,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true // Don't throw on any status code
    });
    
    logger.debug('Rapid7 validation response received', { 
      status: response.status,
      statusText: response.statusText,
      dataReceived: !!response.data
    });
    
    // Check if the response indicates success
    if (response.status === 200) {
      logger.info('Rapid7 API connection test successful');
      
      // Log successful connection status
      console.log('Rapid7 connection status: UP');
      console.log('Rapid7 last connection check:', new Date().toISOString());
      
      return res.json({
        success: true,
        message: 'Connection successful',
        status: 'UP',
        data: response.data
      });
    } else {
      logger.warn('Rapid7 API connection test failed', { 
        status: response.status, 
        data: response.data 
      });
      
      // Log failed connection status
      console.log('Rapid7 connection status: DOWN');
      console.log('Rapid7 last connection check:', new Date().toISOString());
      
      return res.status(response.status).json({
        success: false,
        message: response.data?.message || 'Connection failed: Unexpected response',
        status: 'DOWN',
        data: response.data
      });
    }
  } catch (error) {
    console.error('Rapid7 API connection test failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Connection failed: ${error.message}`,
      error: error.response ? error.response.data : null
    });
  }
});

module.exports = router;
