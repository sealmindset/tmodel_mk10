const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const { getOllamaModels } = require('../services/ollamaService');
console.log('[DEBUG] settings_ollama.js: getOllamaModels:', typeof getOllamaModels, getOllamaModels ? 'function' : 'undefined');
const { exec } = require('child_process');

// GET Ollama settings page
router.get('/', async (req, res) => {
  console.log('[DEBUG] [GET /settings_ollama] route entered');
  const settings = await settingsService.getAllSettings();
  let models = [];
  try {
    let apiUrl = settings['ollama.api_url'];
    // Always use FastAPI backend for Ollama models
    models = await getOllamaModels();
    if (!Array.isArray(models)) models = [];
  } catch (e) {
    models = [];
  }
  console.log('Settings passed to EJS (GET):', settings);
  console.log('Models passed to EJS (GET):', models);
  res.render('settings_ollama', { settings, models, message: null });
});

// POST Ollama settings
router.post('/', async (req, res) => {
  console.log('[DEBUG] [POST /settings_ollama] route entered');
  const { ollama_api_url, ollama_model, action } = req.body;
  let message;
  if (action === 'start_ollama') {
    // Try to start ollama serve
    exec('ollama serve', (error, stdout, stderr) => {
      // No need to block, just log
      if (error) {
        console.error('Failed to start ollama serve:', error);
      }
    });
    message = { type: 'info', text: 'Attempted to start ollama serve.' };
  } else if (ollama_api_url && ollama_model) {
    await settingsService.storeSetting('ollama.api_url', ollama_api_url, 'string');
    await settingsService.storeSetting('ollama.model', ollama_model, 'string');
    message = { type: 'success', text: 'Ollama settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both API URL and model.' };
  }
  const settings = await settingsService.getAllSettings();
  let models = [];
  try {
    models = await getOllamaModels();
    if (!Array.isArray(models)) models = [];
  } catch (e) {
    models = [];
  }
  console.log('Settings passed to EJS (POST):', settings);
  console.log('Models passed to EJS (POST):', models);
  res.render('settings_ollama', { settings, models, message });
});

module.exports = router;
