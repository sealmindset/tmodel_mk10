// routes/settings.js
const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const logger = require('../logger'); // Uses utils/logger.js which can be swapped for winston


// GET /settings - Render settings page
router.get('/', async (req, res) => {
  try {
    // Fetch the canonical LLM provider from DB
    const settings = await settingsService.getAllSettings();
    const provider = settings['settings:llm:provider'] || 'openai';
    // Pass provider to template for radio selection
    res.render('settings', {
      settings,
      provider,
      message: null,
      openaiStatus: Boolean(settings['openai.api_key']),
      ollamaStatus: Boolean(settings['ollama.api_url']),
      rapid7Status: Boolean(settings['rapid7.api_key']),
      availableOllamaModels: settings['ollama.model'] ? [{ name: settings['ollama.model'] }] : [],
      cacheTimestamp: Date.now(),
      lastUpdated: settings['llm.last_updated'] || null
    });
  } catch (err) {
    console.error('[GET /settings] Error:', err);
    res.status(500).render('settings', { settings: {}, provider: 'openai', message: { type: 'danger', text: 'Failed to load settings.' } });
  }
});

// POST /settings - Update LLM provider only (simple workflow)
router.post('/', async (req, res) => {
  console.log('POST /settings received:', req.body);
  logger.info('[POST /settings] Attempted POST', { body: req.body });
  if (!req.body || Object.keys(req.body).length === 0) {
    logger.error('[POST /settings] Empty or missing req.body', { headers: req.headers });
  }

  try {
    const providerValue = req.body.llmProvider;
    logger.info('[POST /settings] llmProvider received', { providerValue });
    if (providerValue && ['openai', 'ollama'].includes(providerValue)) {
      logger.info('[POST /settings] Updating DB with', { providerValue });
      await settingsService.storeSetting('settings:llm:provider', providerValue);
    } else {
      logger.warn('[POST /settings] Invalid or missing llmProvider', { providerValue });
    }
    // Always reload settings from DB after update
    const settings = await settingsService.getAllSettings();
    const provider = settings['settings:llm:provider'] || 'openai';
    res.render('settings', {
      settings,
      provider,
      message: { type: 'success', text: 'LLM Provider updated.' },
      openaiStatus: Boolean(settings['openai.api_key']),
      ollamaStatus: Boolean(settings['ollama.api_url']),
      rapid7Status: Boolean(settings['rapid7.api_key']),
      availableOllamaModels: settings['ollama.model'] ? [{ name: settings['ollama.model'] }] : [],
      cacheTimestamp: Date.now(),
      lastUpdated: settings['llm.last_updated'] || null
    });
  } catch (err) {
    logger.error('[POST /settings] Error', { error: err.message, stack: err.stack });
    res.status(500).render('settings', { settings: {}, provider: 'openai', message: { type: 'danger', text: 'Failed to update LLM Provider.' } });
  }
});


// --- TEST LLM PROVIDER FORM ---
router.get('/test-llm-provider', (req, res) => {
  res.render('test-llm-provider');
});

router.post('/test-llm-provider', (req, res) => {
  console.log('[TEST LLM] content-type:', req.headers['content-type']);
  console.log('[TEST LLM] req.body:', req.body);
  const provider = req.body.llmProvider;
  res.render('test-llm-provider', { provider });
});
// --- END TEST ---

module.exports = router;

