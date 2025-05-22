// routes/settings-new.js
const express         = require('express');
const router          = express.Router();
const multer          = require('multer');
const openaiUtil      = require('../utils/openai');
const ollamaUtil      = require('../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (settings-new.js):', Object.keys(ollamaUtil));
const settingsService = require('../services/settingsService');
const dbSettings      = require('../services/dbSettingsService');

// Dev auth bypass
function ensureAuthenticated(req, res, next) {
  req.session.user = { username: 'demo' };
  next();
}

const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /settings
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    console.log('GET /settings');

    // check LLM statuses
    const [ openaiStatus, ollamaStatus ] = await Promise.all([
      openaiUtil.checkStatus(),
      ollamaUtil.checkStatus()
    ]);

    // defaults and cached settings
    const llmProvider           = await settingsService.getSetting('settings:llm:provider', 'openai');
    const lastUpdated           = null; // we can fetch if needed
    const openaiApiKey          = await settingsService.getSetting('settings:openai:api_key', '');
    const openaiModel           = await settingsService.getSetting('settings:api:openai:model', 'gpt-3.5-turbo');
    const ollamaModel           = await settingsService.getSetting('settings:api:ollama:model', 'llama3');
    const ollamaApiUrl          = await settingsService.getSetting('settings:api:ollama:url', 'http://localhost:11434');
    let availableOllamaModels   = [];
    const rapid7ApiKey          = await settingsService.getSetting('settings:rapid7:api_key', '');
    const rapid7ApiUrl          = await settingsService.getSetting('settings:rapid7:api_url', '');
    const rapid7Status          = Boolean(rapid7ApiKey.trim());
    const postgresStatus        = await dbSettings.checkPostgresStatus();
    const cacheTimestamp        = Date.now();

    // fetch Ollama model list if online
    if (ollamaStatus) {
      try {
        availableOllamaModels = await ollamaUtil.getModels();
      } catch (e) {
        console.error('Error fetching Ollama models', e);
      }
    }

    // render view
    res.render('settings', {
      llmProvider,
      lastUpdated,
      cacheTimestamp,
      openaiStatus,
      openaiApiKey,
      openaiModel,
      ollamaStatus,
      ollamaModel,
      ollamaApiUrl,
      availableOllamaModels,
      rapid7ApiKey,
      rapid7ApiUrl,
      rapid7Status,
      postgresStatus,
      message: req.session.message || null
    });
    delete req.session.message;

  } catch (err) {
    console.error('Error GET /settings', err);
    // render with all defaults so view variables exist
    res.render('settings', {
      llmProvider: 'openai',
      lastUpdated: null,
      cacheTimestamp: Date.now(),
      openaiStatus: false,
      openaiApiKey: '',
      openaiModel: 'gpt-3.5-turbo',
      ollamaStatus: false,
      ollamaModel: 'llama3',
      ollamaApiUrl: 'http://localhost:11434',
      availableOllamaModels: [],
      rapid7ApiKey: '',
      rapid7ApiUrl: '',
      rapid7Status: false,
      postgresStatus: false,
      message: { type: 'danger', text: 'Error loading settings: ' + err.message }
    });
  }
});

/**
 * POST /settings
 */
router.post('/', ensureAuthenticated, upload.none(), async (req, res) => {
  console.log('[POST /settings] Handler entered', req.body);
  try {
    console.log('POST /settings', req.body);
    const { settingsType } = req.body;

    if (settingsType === 'llm') {
      const { llmProvider } = req.body;
      if (!['openai', 'ollama'].includes(llmProvider)) {
        throw new Error('Invalid LLM provider: ' + llmProvider);
      }
      // store setting
      await settingsService.storeSetting(
        'settings:llm:provider',
        llmProvider,
        'Default LLM provider'
      );
      // reload client
      if (llmProvider === 'openai') await openaiUtil.refreshClient();
      else await ollamaUtil.loadSettings();
      req.session.message = { type: 'success', text: 'LLM Provider saved.' };
    }
    // TODO: handle other settingsType cases
    res.redirect('/settings');
  } catch (err) {
    console.error('Error POST /settings', err);
    req.session.message = { type: 'danger', text: err.message };
    res.redirect('/settings');
  }
});

module.exports = router;
