// assistantOllama.js
// Handles Ollama chat and model fetching
const axios = require('axios');
const assistantDB = require('./assistantDB');

exports.getAvailableModels = async () => {
  // Fetch models from local Ollama instance
  const fastApiBaseUrl = process.env.FASTAPI_BASE_URL || 'http://localhost:8000';
  const response = await axios.get(`${fastApiBaseUrl}/api/ollama/models`);
  return response.data.models.map(model => ({
    name: model.name,
    label: model.name.replace(/[:@]/g, ' ')
  }));
};

exports.getChatResponse = async ({ model, message, context_enabled }) => {
  const fastApiBaseUrl = process.env.FASTAPI_BASE_URL || 'http://localhost:8000';
  // Prompt template for consistency
  const prompt = context_enabled
    ? `You are a security expert. Context: Threat modeling. User: ${message}`
    : message;
  const response = await axios.post(`${fastApiBaseUrl}/api/ollama/generate`, {
    model,
    prompt,
    stream: false
  });
  return response.data.response;
};
