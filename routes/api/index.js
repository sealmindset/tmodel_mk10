// routes/api/index.js
const express  = require('express');
const router   = express.Router();

router.use('/projects',           require('./projects'));
router.use('/ollama-models',      require('./ollamaModels'));
router.use('/safeguards',         require('./safeguards'));
router.use('/vulnerabilities',    require('./vulnerabilities'));
router.use('/threats',            require('./threats'));
router.use('/components',         require('./componentAssignments'));
router.use('/threat-models',      require('./threatModels'));
router.use('/results',            require('./results'));
router.use('/',                   require('./threatModelMerge'));
router.use('/rapid7',             require('./rapid7'));
router.use('/rapid7-test',        require('./rapid7-test'));
router.use('/rapid7-sync',        require('./rapid7-sync'));
router.use('/llm',                require('./llm'));
router.use('/settings',           require('./openaiKeyController'));
router.use('/subjects',           require('./subjects'));
router.use('/components',         require('./components'));
router.use('/report-generator',   require('./reportGenerator'));
router.use('/project-mapper',     require('./projectMapper'));
router.use('/',                   require('./projectAssignments'));
router.use('/rag',                require('./rag'));

// Health
// Explicit OPTIONS preflight handler for /api/status
router.options('/status', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  console.log('[CORS] OPTIONS /api/status preflight handled.');
  res.sendStatus(204);
});

// GET /api/status with explicit CORS headers
router.get('/status', (_req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.json({
    success: true,
    message: 'Threat Modeling API is operational',
    timestamp: new Date().toISOString()
  });
  console.log('[CORS] GET /api/status CORS headers sent.');
});

// Proxy for legacy /api/provider-status endpoint
router.get('/provider-status', async (req, res) => {
  try {
    // Forward query params if present
    const fetch = require('node-fetch');
    const provider = req.query.provider ? `?provider=${encodeURIComponent(req.query.provider)}` : '';
    const llmStatusUrl = `http://localhost:3000/api/llm/status${provider}`;
    const response = await fetch(llmStatusUrl);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Error proxying /api/provider-status:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch provider status' });
  }
});

// GET /api/rapid7-config
// Returns Rapid7 API URL & Key from PostgreSQL
router.get('/rapid7-config', async (req, res) => {
  try {
    // Check if we have any settings cached in the service first
    const rapid7Service = require('../../services/rapid7Service');
    const settings = await rapid7Service.getCachedSettings();
    
    // Extract settings with proper defaults (and show URL plainly)
    const url = settings.apiUrl || 'https://us.api.insight.rapid7.com';
    const apiKey = settings.apiKey || '';
    
    // Create a redacted key for security in the response
    let redactedKey = '';
    if (apiKey && apiKey.length > 8) {
      redactedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
    }
    
    res.json({ 
      url: url, // Show URL plainly as requested
      apiKey: redactedKey,
      hasApiKey: apiKey.length > 0
    });
  } catch (error) {
    console.error('Error retrieving Rapid7 API settings:', error);
    res.status(500).json({ error: 'Could not retrieve Rapid7 API settings' });
  }
});

module.exports = router;
