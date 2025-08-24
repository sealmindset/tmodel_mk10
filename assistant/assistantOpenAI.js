// assistantOpenAI.js
// Handles OpenAI chat and model fetching (legacy direct API usage)
const axios = require('axios');
// Use centralized utility that reads API key from threat_model.settings first
const openaiUtil = require('../utils/openai');

exports.getAvailableModels = async () => {
  try {
    const ids = await openaiUtil.fetchAvailableModels();
    // Prefer known chat-capable families
    const preferred = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4-turbo'];
    const filtered = ids.filter(id => preferred.some(p => id === p || id.startsWith(p)));
    const finalList = (filtered.length ? filtered : ids);
    return finalList.map(id => ({ name: id, label: id }));
  } catch (e) {
    console.error('[assistantOpenAI] Failed to fetch models:', e.message);
    return [];
  }
};

exports.getChatResponse = async ({ model, message, context_enabled }) => {
  const apiKey = await openaiUtil.getApiKey();
  // Validate/fallback model to reduce 400s
  try {
    const ids = await openaiUtil.fetchAvailableModels();
    const available = new Set(ids);
    if (!model || !available.has(model)) {
      const fallback = ids.find(id => id === 'gpt-4o' || id.startsWith('gpt-4o')) || 'gpt-4o';
      console.warn(`[assistantOpenAI] Model "${model}" not available; falling back to "${fallback}"`);
      model = fallback;
    }
  } catch (e) {
    console.warn('[assistantOpenAI] Could not validate model list, proceeding with requested model:', model, e.message);
    if (!model) model = 'gpt-4o';
  }

  const messages = context_enabled
    ? [
        { role: 'system', content: 'You are a security expert. Context: Threat modeling.' },
        { role: 'user', content: message }
      ]
    : [{ role: 'user', content: message }];
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model,
      messages
    }, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return response.data.choices[0].message.content;
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || err.message;
    console.error('[assistantOpenAI] Chat completion error', { status, details, model });
    throw new Error(`OpenAI chat error ${status || ''}: ${typeof details === 'string' ? details : (details.error?.message || JSON.stringify(details))}`);
  }
};
