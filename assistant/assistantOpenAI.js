// assistantOpenAI.js
// Handles OpenAI chat and model fetching
const axios = require('axios');
const assistantDB = require('./assistantDB');

exports.getAvailableModels = async () => {
  // Fetch models from OpenAI API (example for GPT-3.5/4)
  const apiKey = await assistantDB.getApiKey('openai');
  const response = await axios.get('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  // Filter chat models
  return response.data.data
    .filter(m => m.id.startsWith('gpt'))
    .map(m => ({ name: m.id, label: m.id }));
};

exports.getChatResponse = async ({ model, message, context_enabled }) => {
  const apiKey = await assistantDB.getApiKey('openai');
  const messages = context_enabled
    ? [
        { role: 'system', content: 'You are a security expert. Context: Threat modeling.' },
        { role: 'user', content: message }
      ]
    : [{ role: 'user', content: message }];
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages
  }, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  return response.data.choices[0].message.content;
};
