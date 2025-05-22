/**
 * Debug routes for testing functionality
 */
const express = require('express');
const router = express.Router();
const openaiUtil = require('../utils/openai');

/**
 * @route GET /debug/openai-test
 * @desc Test OpenAI API integration with a simple form
 */
router.get('/openai-test', async (req, res) => {
  let apiKey = openaiUtil.getApiKey();
  let status = false;
  
  try {
    status = await openaiUtil.checkStatus();
  } catch (error) {
    console.error('Error checking OpenAI status:', error);
  }
  
  // Mask the API key for display
  let maskedKey = '';
  if (apiKey) {
    const keyLength = apiKey.length;
    if (keyLength > 8) {
      maskedKey = `${apiKey.substring(0, 4)}${'*'.repeat(keyLength - 8)}${apiKey.substring(keyLength - 4)}`;
    } else {
      maskedKey = '********';
    }
  }
  
  res.render('debug/openai-test', {
    apiKey: maskedKey,
    apiStatus: status,
    messages: []
  });
});

/**
 * @route POST /debug/openai-test
 * @desc Test a prompt with the OpenAI API
 */
router.post('/openai-test', async (req, res) => {
  // Cascade: Use preferred OpenAI config from Redis
  const { provider, apiKey, model } = (await openaiUtil.getPreferredOpenAIConfig()) || {};
  let messages = [];
  const { prompt } = req.body;

  if (provider !== 'openai') {
    messages.push({
      type: 'warning',
      text: 'OpenAI is not the selected LLM provider. Please select OpenAI in API settings.'
    });
    return res.render('debug/openai-test', {
      apiKey: '',
      apiStatus: false,
      messages,
      lastPrompt: prompt
    });
  }

  let status = false;

  const { prompt } = req.body;
  try {
    // Use OpenAI status check with the preferred API key
    status = apiKey ? await openaiUtil.checkStatus(apiKey) : false;

    if (status && prompt) {
      // Try to get a completion using the prompt and preferred model
      try {
        const response = await openaiUtil.getCompletion(prompt, apiKey, model);
        let responseText = '';
        if (response.choices && response.choices.length > 0) {
          if (response.choices[0].message) {
            responseText = response.choices[0].message.content || '';
          } else {
            responseText = response.choices[0].text || '';
          }
        }
        messages.push({
          type: 'success',
          text: `Prompt successfully sent (model: ${model}). OpenAI response: "${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}"`
        });
      } catch (error) {
        messages.push({
          type: 'danger',
          text: `Error getting completion: ${error.message}`
        });
      }
    } else if (!status) {
      messages.push({
        type: 'warning',
        text: 'OpenAI API is not accessible. Check your API key.'
      });
    } else if (!prompt) {
      messages.push({
        type: 'warning',
        text: 'Please enter a prompt.'
      });
    }
  } catch (error) {
    console.error('Error in OpenAI test:', error);
    messages.push({
      type: 'danger',
      text: `Error: ${error.message}`
    });
  }

  // Mask the API key for display
  let maskedKey = '';
  if (apiKey) {
    const keyLength = apiKey.length;
    if (keyLength > 8) {
      maskedKey = `${apiKey.substring(0, 4)}${'*'.repeat(keyLength - 8)}${apiKey.substring(keyLength - 4)}`;
    } else {
      maskedKey = '********';
    }
  }

  res.render('debug/openai-test', {
    apiKey: maskedKey,
    apiStatus: status,
    messages,
    lastPrompt: prompt
  });
});

module.exports = router;
