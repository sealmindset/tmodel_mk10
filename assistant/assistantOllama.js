// assistantOllama.js
// Handles Ollama chat and model fetching
const axios = require('axios');
const assistantDB = require('./assistantDB');

exports.getAvailableModels = async () => {
  // Fetch models from local Ollama instance
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  const response = await axios.get(`${ollamaUrl}/api/tags`);
  return response.data.models.map(model => ({
    name: model.name,
    label: model.name.replace(/[:@]/, ' ')
  }));
};

exports.getChatResponse = async ({ model, message, context_enabled }) => {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  // Prompt template for consistency
  const prompt = context_enabled
    ? `You are a security expert. Context: Threat modeling. User: ${message}`
    : message;
  const response = await axios.post(`${ollamaUrl}/api/generate`, {
    model,
    prompt,
    stream: false
  });
  return response.data.response;
};
