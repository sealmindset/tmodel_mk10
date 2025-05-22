const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET Jira settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_jira', { settings, message: null });
});

// POST Jira settings
router.post('/', async (req, res) => {
  const { jira_api_url, jira_api_key } = req.body;
  let message;
  if (jira_api_url && jira_api_key) {
    await settingsService.storeSetting('jira.api_url', jira_api_url, 'string');
    await settingsService.storeSetting('jira.api_key', jira_api_key, 'string');
    message = { type: 'success', text: 'Jira API settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both the Jira API URL and API key.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_jira', { settings, message });
});

module.exports = router;
