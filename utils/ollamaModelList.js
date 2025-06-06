// utils/ollamaModelList.js
const { exec } = require('child_process');

/**
 * Fetches the list of available Ollama models by calling `ollama list`.
 * Returns a Promise that resolves to an array of model objects: { name, id, size, age }
 */
function getOllamaModels() {
  return new Promise((resolve, reject) => {
    exec('ollama list', (err, stdout, stderr) => {
      if (err) return reject(err);
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      // Skip header if present (starts with 'NAME')
      const dataLines = lines.filter(line => !/^NAME\s+/i.test(line));
      const models = dataLines.map(line => {
        // Example line: saki007ster/CybersecurityRiskAnalyst:latest    9f4725163115    4.7 GB    11 minutes ago
        const parts = line.split(/\s{2,}/);
        return {
          name: parts[0],
          id: parts[1],
          size: parts[2],
          age: parts[3]
        };
      });
      resolve(models);
    });
  });
}

module.exports = { getOllamaModels };
