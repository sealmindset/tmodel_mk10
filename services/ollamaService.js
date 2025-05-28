const axios = require('axios');

async function getOllamaModels(apiUrl) {
  const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://localhost:8000';
  const endpoint = apiUrl || `${FASTAPI_BASE_URL}/api/ollama/models`;
  try {
    const response = await axios.get(endpoint);
    console.log('Ollama models API response:', response.data);
    if (response.data && Array.isArray(response.data.models)) {
      // Normalize to array of strings
      return response.data.models.map(m => m.name || m.model || m);
    }
    return [];
  } catch (err) {
    return [];
  }
}

module.exports = { getOllamaModels };
