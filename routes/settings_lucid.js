const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET Lucid settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_lucid', { settings, message: null });
});

// POST Lucid settings
router.post('/', async (req, res) => {
  const { lucid_api_url, lucid_api_key } = req.body;
  let message;
  if (lucid_api_url && lucid_api_key) {
    await settingsService.storeSetting('lucid.api_url', lucid_api_url, 'string');
    await settingsService.storeSetting('lucid.api_key', lucid_api_key, 'string');
    message = { type: 'success', text: 'Lucid API settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both the Lucid API URL and API key.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_lucid', { settings, message });
});

module.exports = router;
