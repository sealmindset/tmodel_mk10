// assistantOllama.js
// Handles Ollama chat and model fetching
const { exec, spawn } = require('child_process');
const assistantDB = require('./assistantDB');

exports.getAvailableModels = async () => {
  return await new Promise((resolve, reject) => {
    exec('ollama list --json', (error, stdout, stderr) => {
      if (error) {
        console.error('Ollama CLI error (list):', error);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(
          parsed.models
            ? parsed.models.map(model => ({
                name: model.name,
                label: model.name.replace(/[:@]/g, ' ')
              }))
            : []
        );
      } catch (e) {
        console.error('Failed to parse Ollama CLI output (list):', e);
        resolve([]);
      }
    });
  });
};

exports.getChatResponse = async ({ model, message, context_enabled }) => {
  // Prompt template for consistency
  const prompt = context_enabled
    ? `You are a security expert. Context: Threat modeling. User: ${message}`
    : message;
  return await new Promise((resolve, reject) => {
    const proc = spawn('ollama', ['run', model]);
    let output = '';
    let errorOutput = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Ollama CLI exited with code ${code}: ${errorOutput}`);
        return reject(new Error(`Ollama CLI exited with code ${code}`));
      }
      resolve(output.trim());
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
