const { exec } = require('child_process');

async function getOllamaModels() {
  return await new Promise((resolve, reject) => {
    exec('ollama list --json', (error, stdout, stderr) => {
      if (error) {
        console.error('Ollama CLI error (list):', error);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.models ? parsed.models.map(m => m.name) : []);
      } catch (e) {
        console.error('Failed to parse Ollama CLI output (list):', e);
        resolve([]);
      }
    });
  });
}

module.exports = { getOllamaModels };
