/**
 * API Routes for internal functionality
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis').client;
const db = require('../db/db');
const rapid7Service = require('../services/rapid7Service');
const openaiUtil = require('../utils/openai');
const ollamaUtil = require('../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (api.js):', Object.keys(ollamaUtil));
const openApiParser = require('../utils/openApiParser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const scheduler = require('../utils/scheduler');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../uploads');
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, 'rapid7-openapi-' + Date.now() + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept only JSON files
    if (file.mimetype === 'application/json' || 
        path.extname(file.originalname).toLowerCase() === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

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

// --- Ensure settingsService is imported ---
const settingsService = require('../services/settingsService');
const componentsService = require('../services/componentsService');

// Mount RTG API (protected)
try {
  const rtgRouter = require('./api/rtg');
  router.use('/rtg', ensureAuthenticated, rtgRouter);
  console.log('Mounted /api/rtg router');
} catch (e) {
  console.warn('RTG router not mounted (missing routes/api/rtg.js).');
}

// Get the LLM provider from settings (PostgreSQL or default to 'openai') - no auth required
router.get('/settings/provider', async (req, res) => {
  try {
    let provider = 'openai';
    if (typeof settingsService.getSetting === 'function') {
      provider = await settingsService.getSetting('settings:llm:provider', 'openai');
    }
    res.set('Access-Control-Allow-Origin', '*'); // Open CORS
    res.json({ provider });
  } catch (err) {
    console.error('Error getting current LLM provider:', err);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

// Get status of core services - no auth required for this route
router.get('/status', async (req, res) => {
  try {
    // Check which provider to test based on query parameter
    const provider = req.query.provider || 'all';
    const response = {
      timestamp: new Date().toISOString()
    };


    // Check PostgreSQL status if requested or checking all
    if (provider === 'all' || provider === 'postgres') {
      let postgresStatus = false;
      try {
        // Start timing the connection attempt
        const startTime = Date.now();
        
        // Create a connection pool with a short timeout
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionTimeoutMillis: 3000, // 3 second connection timeout
          idleTimeoutMillis: 1000       // 1 second idle timeout
        });
        
        // Try to connect and run a simple query
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        // Calculate latency
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Mark PostgreSQL as connected
        postgresStatus = true;
        console.log(`PostgreSQL connection successful, latency: ${latency}ms`);
        
        // Make sure to end the pool

      } catch (pgError) {
        console.error('PostgreSQL connection error:', pgError.message);
      }
      response.postgres = postgresStatus;
    }

    // Check Rapid7 API status if requested or checking all (and not explicitly skipped)
    if ((provider === 'all' || provider === 'rapid7') && req.query.skipRapid7 !== 'true') {
      let rapid7Status = false;
      try {
        // Get Rapid7 API URL and key from Redis
        const rapid7ApiUrl = await redisClient.get('settings:rapid7:api_url') || process.env.RAPID7_API_URL || 'http://localhost:3100';
        const rapid7ApiKey = await redisClient.get('settings:rapid7:api_key') || process.env.RAPID7_API_KEY || 'test-api-key';
        
        console.log(`Checking Rapid7 API at ${rapid7ApiUrl}`);
        
        // Try different endpoints to check if Rapid7 API is accessible
        const axios = require('axios');
        try {
          // First try the /vulnerabilities endpoint which we know exists on the mock server
          const rapid7Response = await axios.get(`${rapid7ApiUrl}/vulnerabilities`, {
            headers: {
              'X-Api-Key': rapid7ApiKey  // Use the correct header for the mock server
            },
            timeout: 3000 // 3 second timeout
          });
          
          rapid7Status = rapid7Response.status === 200;
          console.log('Rapid7 check successful via /vulnerabilities endpoint');
        } catch (vulnError) {
          // If vulnerabilities endpoint fails, try the health endpoint as fallback
          try {
            const healthResponse = await axios.get(`${rapid7ApiUrl}/health`, {
              headers: {
                'X-Api-Key': rapid7ApiKey  // Use the correct header for the mock server
              },
              timeout: 3000
            });
            
            rapid7Status = healthResponse.status === 200;
            console.log('Rapid7 check successful via /health endpoint');
          } catch (healthError) {
            // If both fail, try a simpler GET request to the root
            try {
              const rootResponse = await axios.get(`${rapid7ApiUrl}`, {
                headers: {
                  'X-Api-Key': rapid7ApiKey  // Use the correct header for the mock server
                },
                timeout: 3000
              });
              
              rapid7Status = rootResponse.status === 200;
              console.log('Rapid7 check successful via root endpoint');
            } catch (rootError) {
              console.error('All Rapid7 API connection attempts failed');
              rapid7Status = false;
            }
          }
        }
      } catch (rapid7Error) {
        console.error('Rapid7 API connection error:', rapid7Error.message);
      }
      
      console.log('Final Rapid7 status:', rapid7Status);
      response.rapid7 = rapid7Status;
    } 

    // Get status info for all LLM providers
    const llmStatusInfo = await scheduler.getLlmStatusInfo();
    response.currentProvider = llmStatusInfo.currentProvider;
    
    // Check OpenAI status if requested or checking all
    if (provider === 'all' || provider === 'openai') {
      // Force a check if explicitly requested by query param
      if (req.query.forceCheck === 'true') {
        try {
          await scheduler.checkOpenAiStatus();
          // Get updated status after the check
          const updatedLlmStatusInfo = await scheduler.getLlmStatusInfo();
          llmStatusInfo.openai = updatedLlmStatusInfo.openai;
        } catch (checkError) {
          console.error('Error during forced OpenAI status check:', checkError);
        }
      }

      response.openai = llmStatusInfo.openai.accessible;
      response.openaiLastChecked = llmStatusInfo.openai.lastChecked;
    }

    // Check Ollama status if requested or checking all
    if (provider === 'all' || provider === 'ollama') {
      // Force a check if explicitly requested by query param
      if (req.query.forceCheck === 'true') {
        try {
          await scheduler.checkOllamaStatus();
          // Get updated status after the check
          const updatedLlmStatusInfo = await scheduler.getLlmStatusInfo();
          llmStatusInfo.ollama = updatedLlmStatusInfo.ollama;
        } catch (checkError) {
          console.error('Error during forced Ollama status check:', checkError);
        }
      } else if (!llmStatusInfo.ollama.lastChecked) {
        // If we don't have a cached status, check now
        try {
          await scheduler.checkOllamaStatus();
          const updatedLlmStatusInfo = await scheduler.getLlmStatusInfo();
          llmStatusInfo.ollama = updatedLlmStatusInfo.ollama;
        } catch (ollamaError) {
          console.error('Ollama connection error:', ollamaError);
        }
      }
      
      response.ollama = llmStatusInfo.ollama.accessible;
      response.ollamaLastChecked = llmStatusInfo.ollama.lastChecked;

      // If checking Ollama specifically, also include available models
      if (provider === 'ollama' && llmStatusInfo.ollama.accessible) {
        try {
          const ollamaModels = await ollamaUtil.getModels();
          response.ollamaModels = ollamaModels;
        } catch (modelError) {
          console.error('Error fetching Ollama models:', modelError);
        }
      }
    }
    
    // Return the combined status
    res.json(response);
  } catch (error) {
    console.error('Error checking service status:', error);
    res.status(500).json({ error: 'Failed to check service status' });
  }
});

// Example protected route
router.get('/protected-example', ensureAuthenticated, async (req, res) => {
  // This is a protected route example that requires authentication
  res.json({
    message: 'You have access to this protected route',
    user: req.session.user || 'Anonymous' 
  });
});

/**
 * @route GET /api/llm/events
 * @desc Get recent LLM API events for monitoring (OpenAI or Ollama)
 */
router.get('/llm/events', async (req, res) => {
  try {
    const provider = req.query.provider || 'openai';
    let events = [];
    
    if (provider === 'openai') {
      events = openaiUtil.getApiEvents();
    } else if (provider === 'ollama') {
      events = ollamaUtil.getApiEvents();
    } else {
      // If invalid provider, return error
      return res.status(400).json({ error: 'Invalid provider specified' });
    }
    
    res.json(events);
  } catch (error) {
    console.error(`Error retrieving ${req.query.provider || 'LLM'} API events:`, error);
    res.status(500).json({ error: `Error retrieving ${req.query.provider || 'LLM'} API events` });
  }
});

/**
 * @route GET /api/ollama/models
 * @desc Get list of available Ollama models
 */
router.get('/ollama/models', async (req, res) => {
  try {
    const models = await ollamaUtil.getModels();
    res.json(models);
  } catch (error) {
    console.error('Error retrieving Ollama models:', error);
    res.status(500).json({ error: 'Error retrieving Ollama models' });
  }
});

/**
 * @route GET /api/openai/events
 * @desc Get recent OpenAI API events for monitoring (legacy route)
 */
router.get('/openai/events', async (req, res) => {
  try {
    const events = openaiUtil.getApiEvents();
    res.json(events);
  } catch (error) {
    console.error('Error retrieving OpenAI API events:', error);
    res.status(500).json({ error: 'Error retrieving OpenAI API events' });
  }
});

/**
 * @route GET /api/postgres/status
 * @desc Check PostgreSQL connection status (similar to pg_isready)
 */
router.get('/postgres/status', async (req, res) => {
  try {
    let postgresStatus = false;
    let details = {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'postgres',
      user: process.env.PGUSER || 'postgres',
      status: 'unknown',
      latency_ms: null,
      error: null
    };
    
    try {
      // Start timing the connection attempt
      const startTime = Date.now();
      
      // Create a connection pool with a short timeout
      const { Pool } = require('pg');
      const pool = new Pool({
        // Use default environment variables for connection settings
        // Add a short connection timeout
        connectionTimeoutMillis: 3000, // 3 second connection timeout
        idleTimeoutMillis: 1000       // 1 second idle timeout
      });
      
      // Try to establish a connection and run a simple query
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as time, current_database() as db, version() as version');
      client.release();
      
      // Calculate latency
      const endTime = Date.now();
      details.latency_ms = endTime - startTime;
      
      // Mark as successful and get additional details
      postgresStatus = true;
      details.status = 'accepting connections';
      
      if (result.rows && result.rows.length > 0) {
        details.server_time = result.rows[0].time;
        details.connected_to = result.rows[0].db;
        details.version = result.rows[0].version.split(' on ')[0]; // Just get the PostgreSQL version
      }
      
      // Make sure to end the pool
      await pool.end();
      
      console.log('PostgreSQL connection successful, latency:', details.latency_ms, 'ms');
    } catch (pgError) {
      // Connection failed
      details.status = 'rejecting connections';
      details.error = pgError.message;
      console.error('PostgreSQL connection error:', pgError.message);
    }
    
    // Send the detailed response, including postgres status for backward compatibility
    res.json({ 
      postgres: postgresStatus, 
      details: details,
      timestamp: new Date().toISOString() 
    }); // Redis status removed for simplicity and reliability
  } catch (error) {
    console.error('Error checking PostgreSQL status:', error);
    res.status(500).json({ error: 'Failed to check PostgreSQL status' });
  }
});

/**
 * @route POST /api/rapid7/parse-openapi
 * @desc Parse Rapid7 OpenAPI JSON file
 */
router.post('/rapid7/parse-openapi', upload.single('openapi_file'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a valid OpenAPI JSON file.'
      });
    }

    console.log('Processing uploaded OpenAPI file:', req.file.path);
    
    // Use the Rapid7 service to parse the OpenAPI file
    const rapid7Service = require('../services/rapid7Service');
    const rapid7Client = new rapid7Service();
    const parseResult = await rapid7Client.parseOpenApiFile(req.file.path);
    
    // Return the parsed information
    res.json(parseResult);
  } catch (error) {
    console.error('Error processing OpenAPI file:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing OpenAPI file: ' + error.message
    });
  }
});

/**
 * @route POST /api/rapid7/parse-openapi-path
 * @desc Parse Rapid7 OpenAPI JSON file from a specified path
 */
router.post('/rapid7/parse-openapi-path', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'No file path provided'
      });
    }
    
    console.log('Processing OpenAPI file from path:', filePath);
    
    // Use the Rapid7 service to parse the OpenAPI file
    const rapid7Service = require('../services/rapid7Service');
    const rapid7Client = new rapid7Service();
    const parseResult = await rapid7Client.parseOpenApiFile(filePath);
    
    // Return the parsed information
    res.json(parseResult);
  } catch (error) {
    console.error('Error processing OpenAPI file:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing OpenAPI file: ' + error.message
    });
  }
});

/**
 * @route POST /api/rapid7/update-url
 * @desc Update Rapid7 API URL based on OpenAPI specification
 */
router.post('/rapid7/update-url', async (req, res) => {
  try {
    const { baseUrl } = req.body;
    
    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        message: 'Base URL is required'
      });
    }
    
    console.log('Updating Rapid7 API URL:', baseUrl);
    
    // Use the Rapid7 service to update the API URL
    const rapid7Service = require('../services/rapid7Service');
    const rapid7Client = new rapid7Service();
    const updateResult = await rapid7Client.updateApiUrlFromSpec(baseUrl);
    
    // Return the update result
    res.json(updateResult);
  } catch (error) {
    console.error('Error updating Rapid7 API URL:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating Rapid7 API URL: ' + error.message
    });
  }
});

/**
 * @route POST /api/rapid7/test-endpoint
 * @desc Test a specific Rapid7 API endpoint
 */
router.post('/rapid7/test-endpoint', async (req, res) => {
  try {
    const { path, method } = req.body;
    
    if (!path || !method) {
      return res.status(400).json({
        success: false,
        message: 'Path and method are required'
      });
    }
    
    console.log(`Testing Rapid7 endpoint: ${method} ${path}`);
    
    // Use the Rapid7 service to test the endpoint
    const rapid7Service = require('../services/rapid7Service');
    const rapid7Client = new rapid7Service();
    const testResult = await rapid7Client.testEndpoint({ path, method });
    
    // Return the test result
    res.json(testResult);
  } catch (error) {
    console.error('Error testing Rapid7 endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing Rapid7 endpoint: ' + error.message
    });
  }
});

/**
 * @route GET /api/health/rapid7
 * @desc Check Rapid7 API connection status
 */
router.get('/health/rapid7', async (req, res) => {
  try {
    // Get Rapid7 API URL and key from Redis
    const rapid7ApiUrl = await redisClient.get('settings:rapid7:api_url') || process.env.RAPID7_API_URL || 'https://us.api.insight.rapid7.com';
    const rapid7ApiKey = await redisClient.get('settings:rapid7:api_key') || process.env.RAPID7_API_KEY || '';
    
    console.log('Checking Rapid7 API health at:', rapid7ApiUrl);
    console.log('API Key length:', rapid7ApiKey ? rapid7ApiKey.length : 0);
    
    // Validate URL and API key
    if (!rapid7ApiUrl || typeof rapid7ApiUrl !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Rapid7 API URL format' 
      });
    }
    
    if (!rapid7ApiKey || typeof rapid7ApiKey !== 'string' || rapid7ApiKey.length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Rapid7 API key format' 
      });
    }
    
    // Try to connect to the Rapid7 API
    const axios = require('axios');
    try {
      // First try the /validate endpoint
      const validationUrl = `${rapid7ApiUrl}/validate`;
      console.log(`Checking Rapid7 connection using validation URL: ${validationUrl}`);
      
      const validationResponse = await axios.get(validationUrl, {
        headers: {
          'X-Api-Key': rapid7ApiKey
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (validationResponse.status === 200) {
        console.log('Rapid7 API connection validated successfully');
        return res.json({ 
          success: true, 
          message: 'Rapid7 API connection successful',
          status: 'connected'
        });
      }
    } catch (validationError) {
      console.error('Validation endpoint failed:', validationError.message);
      
      // If validation endpoint fails, try a different endpoint
      try {
        // Try the /vm/v4/integration/vulnerabilities endpoint as fallback
        const vulnUrl = `${rapid7ApiUrl}/vm/v4/integration/vulnerabilities`;
        console.log(`Trying fallback URL: ${vulnUrl}`);
        
        const vulnResponse = await axios.get(vulnUrl, {
          headers: {
            'X-Api-Key': rapid7ApiKey
          },
          timeout: 5000 // 5 second timeout
        });
        
        if (vulnResponse.status === 200) {
          console.log('Rapid7 API connection successful via vulnerabilities endpoint');
          return res.json({ 
            success: true, 
            message: 'Rapid7 API connection successful',
            status: 'connected'
          });
        }
      } catch (vulnError) {
        console.error('Vulnerabilities endpoint failed:', vulnError.message);
        
        // Return detailed error information
        return res.status(400).json({ 
          success: false, 
          message: 'Failed to connect to Rapid7 API: ' + (vulnError.response ? 
            `API responded with status ${vulnError.response.status}` : 
            vulnError.message),
          error: vulnError.message,
          status: 'disconnected'
        });
      }
    }
    
    // If we get here, both connection attempts failed
    return res.status(400).json({ 
      success: false, 
      message: 'Failed to connect to Rapid7 API after multiple attempts',
      status: 'disconnected'
    });
  } catch (error) {
    console.error('Error checking Rapid7 health:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking Rapid7 health: ' + error.message,
      status: 'error'
    });
  }
});

// LEGACY endpoint for backward compatibility - redirects to new endpoint
router.get('/rapid7-url', async (req, res) => {
  try {
    // Use cached settings from Rapid7 service
    const rapid7Service = require('./services/rapid7Service');
    const settings = await rapid7Service.getCachedSettings();
    
    // Show URL plainly as requested (no need to hide it)
    const url = settings.apiUrl || process.env.RAPID7_API_URL || 'https://us.api.insight.rapid7.com';
    const apiKey = settings.apiKey || process.env.RAPID7_API_KEY || '';
    
    // Create a redacted key for security in the response
    let redactedKey = '';
    if (apiKey && apiKey.length > 8) {
      redactedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
    }
    
    // Return data in the expected format for backward compatibility
    res.json({
      url: url,
      apiKey: redactedKey,
      hasApiKey: apiKey.length > 0
    });
  } catch (error) {
    console.error('Error retrieving Rapid7 settings:', error);
    res.status(500).json({ error: 'Failed to retrieve Rapid7 settings' });
  }
});

/**
 * @route GET /api/projects
 * @desc Get all projects for the reports app
 */
router.get('/projects', async (req, res) => {
  try {
    // Set CORS headers to allow requests from browser-based reports app
    res.set('Access-Control-Allow-Origin', '*');
    
    const result = await db.query(
      'SELECT id, name, business_unit, criticality, status FROM projects ORDER BY name'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

module.exports = router;
