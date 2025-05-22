const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET Confluence settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_confluence', { settings, message: null });
});

// POST Confluence settings
router.post('/', async (req, res) => {
  const { confluence_api_url, confluence_api_key } = req.body;
  let message;
  if (confluence_api_url && confluence_api_key) {
    await settingsService.storeSetting('confluence.api_url', confluence_api_url, 'string');
    await settingsService.storeSetting('confluence.api_key', confluence_api_key, 'string');
    message = { type: 'success', text: 'Confluence API settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both the Confluence API URL and API key.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_confluence', { settings, message });
});

module.exports = router;
