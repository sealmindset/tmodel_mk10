// routes/settings-new.js
const express         = require('express');
const router          = express.Router();
const multer          = require('multer');
const openaiUtil      = require('../utils/openai');
const ollamaUtil      = require('../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (settings-new.js):', Object.keys(ollamaUtil));
const settingsService = require('../services/settingsService');
const dbSettings      = require('../services/dbSettingsService');
const rapid7Service   = require('../services/rapid7Service');

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

    // rag retrieval settings
    const ragRetrievalCutoff = await settingsService.getSetting('rag.retrieval_distance_cutoff', 0.45);

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
      ragRetrievalCutoff,
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
      ragRetrievalCutoff: 0.45,
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
    } else if (settingsType === 'openai') {
      const { openaiApiKey, openaiModel } = req.body;
      if (openaiApiKey) {
        await settingsService.storeSetting(
          'settings:openai:api_key',
          openaiApiKey,
          'OpenAI API key'
        );
      }
      if (openaiModel) {
        await settingsService.storeSetting(
          'settings:api:openai:model',
          openaiModel,
          'Default OpenAI model'
        );
      }
      await openaiUtil.refreshClient();
      req.session.message = { type: 'success', text: 'OpenAI settings saved.' };
    } else if (settingsType === 'ollama') {
      const { ollamaApiUrl, ollamaModel } = req.body;
      if (ollamaApiUrl) {
        await settingsService.storeSetting(
          'settings:api:ollama:url',
          ollamaApiUrl,
          'Ollama API URL'
        );
      }
      if (ollamaModel) {
        await settingsService.storeSetting(
          'settings:api:ollama:model',
          ollamaModel,
          'Default Ollama model'
        );
      }
      await ollamaUtil.loadSettings();
      req.session.message = { type: 'success', text: 'Ollama settings saved.' };
    } else if (settingsType === 'rapid7') {
      const { rapid7ApiUrl, rapid7ApiKey } = req.body;
      if (rapid7ApiUrl) {
        await settingsService.storeSetting(
          'settings:rapid7:api_url',
          rapid7ApiUrl,
          'Rapid7 API URL'
        );
      }
      if (rapid7ApiKey) {
        await settingsService.storeSetting(
          'settings:rapid7:api_key',
          rapid7ApiKey,
          'Rapid7 API key'
        );
      }
      await rapid7Service.refreshClient();
      req.session.message = { type: 'success', text: 'Rapid7 settings saved.' };
    } else if (settingsType === 'rag') {
      const { ragRetrievalCutoff } = req.body;
      const cutoffNum = Number(ragRetrievalCutoff);
      if (!isFinite(cutoffNum) || cutoffNum <= 0 || cutoffNum > 2) {
        throw new Error('Invalid RAG retrieval cutoff');
      }
      await settingsService.storeSetting(
        'rag.retrieval_distance_cutoff',
        cutoffNum,
        'RAG retrieval distance cutoff for pgvector distance filtering'
      );
      req.session.message = { type: 'success', text: 'RAG retrieval cutoff saved.' };
    }
    // end of settingsType cases
    res.redirect('/settings');
  } catch (err) {
    console.error('Error POST /settings', err);
    req.session.message = { type: 'danger', text: err.message };
    res.redirect('/settings');
  }
});

module.exports = router;
