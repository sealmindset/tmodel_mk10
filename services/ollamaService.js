const axios = require('axios');

async function getOllamaModels(apiUrl = 'http://localhost:11434/api/tags') {
  try {
    const response = await axios.get(apiUrl);
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
