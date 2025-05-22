/**
 * Rapid7 Configuration API Routes
 * Handles OpenAPI specification parsing and endpoint configuration
 */

const express = require('express');
const router = express.Router();
const redis = require('../../services/redisService');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/specs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'rapid7-openapi-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    // Accept only JSON and YAML files
    const filetypes = /json|yaml|yml/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JSON and YAML files are allowed'));
    }
  }
});

// Redis keys
const RAPID7_CONFIG_KEY = 'settings:rapid7:config';
const RAPID7_ENDPOINTS_KEY = 'settings:rapid7:endpoints';
const RAPID7_SPEC_PATH_KEY = 'settings:rapid7:spec_path';

/**
 * @route POST /api/rapid7/config
 * @description Save Rapid7 API configuration with endpoints from OpenAPI spec
 * @access Private
 */
router.post('/config', async (req, res) => {
  try {
    const { apiUrl, apiKey, baseUrl, endpoints } = req.body;
    
    if (!apiUrl || !apiKey) {
      return res.status(400).json({ success: false, message: 'API URL and API Key are required' });
    }
    
    // Save basic configuration
    await redis.set('settings:rapid7:api_url', apiUrl);
    await redis.set('settings:rapid7:api_key', apiKey);
    
    // Save base URL if provided
    if (baseUrl) {
      await redis.set('settings:rapid7:base_url', baseUrl);
    }
    
    // Save endpoints configuration
    if (endpoints) {
      await redis.set(RAPID7_ENDPOINTS_KEY, JSON.stringify(endpoints));
    }
    
    // Test connection with new configuration
    try {
      const testResponse = await axios.get(`${apiUrl}/validate`, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const isValid = testResponse.status === 200;
      
      return res.json({ 
        success: true, 
        message: 'Configuration saved successfully',
        connectionValid: isValid
      });
    } catch (error) {
      console.error('Error testing connection with new configuration:', error.message);
      
      return res.json({ 
        success: true, 
        message: 'Configuration saved but connection test failed',
        connectionValid: false,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error saving Rapid7 configuration:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/rapid7/upload-spec
 * @description Upload and parse OpenAPI specification file
 * @access Private
 */
router.post('/upload-spec', upload.single('specFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Save the path to the uploaded spec file
    await redis.set(RAPID7_SPEC_PATH_KEY, req.file.path);
    
    // Return success with file path
    return res.json({ 
      success: true, 
      message: 'Specification file uploaded successfully',
      filePath: req.file.path
    });
  } catch (error) {
    console.error('Error uploading specification file:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/rapid7-test/endpoint
 * @description Test a specific Rapid7 API endpoint
 * @access Private
 */
router.post('/test-endpoint', async (req, res) => {
  try {
    const { apiUrl, apiKey, path, method } = req.body;
    
    if (!apiUrl || !apiKey || !path) {
      return res.status(400).json({ success: false, message: 'API URL, API Key, and endpoint path are required' });
    }
    
    // Construct full URL
    const fullUrl = `${apiUrl}${path.startsWith('/') ? path : '/' + path}`;
    
    // Make request to the endpoint
    try {
      const response = await axios({
        method: method.toLowerCase() || 'get',
        url: fullUrl,
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        // For GET requests, timeout after 10 seconds
        timeout: 10000
      });
      
      return res.json({
        success: true,
        status: response.status,
        statusText: response.statusText,
        data: response.data ? JSON.stringify(response.data).substring(0, 1000) : null // Limit response size
      });
    } catch (error) {
      console.error(`Error testing endpoint ${method} ${path}:`, error.message);
      
      return res.json({
        success: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        statusText: error.response ? error.response.statusText : null,
        data: error.response && error.response.data ? JSON.stringify(error.response.data).substring(0, 1000) : null
      });
    }
  } catch (error) {
    console.error('Error in test endpoint route:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/rapid7/endpoints
 * @description Get saved Rapid7 API endpoints configuration
 * @access Private
 */
router.get('/endpoints', async (req, res) => {
  try {
    const endpointsJson = await redis.get(RAPID7_ENDPOINTS_KEY);
    const endpoints = endpointsJson ? JSON.parse(endpointsJson) : null;
    
    return res.json({ success: true, endpoints });
  } catch (error) {
    console.error('Error getting Rapid7 endpoints:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
