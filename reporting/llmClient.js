/**
 * LLM Client for Report Generation
 * 
 * This module abstracts calls to different LLM providers (OpenAI, Ollama)
 * for generating report content based on provided prompts.
 */

const ollamaUtil = require('../utils/ollama'); // Assuming ollamaUtil is set up for CLI completions
const { getCompletion } = require('../utils/openai');

const LLMClient = {
    /**
     * Get a completion from the specified LLM provider.
     * 
     * @param {string} promptText The full prompt text to send to the LLM.
     * @param {string} provider The LLM provider ('openai' or 'ollama').
     * @param {string} model The specific model to use (e.g., 'gpt-3.5-turbo', 'llama3:latest').
     * @returns {Promise<string>} The LLM's response text.
     * @throws {Error} If the provider is unsupported or the API call fails.
     */
    getCompletion: async function(promptText, provider, model) {
        console.log(`[LLMClient] Getting completion. Provider: ${provider}, Model: ${model}`);
        const maxTokens = 1024;
        let response;
        if (provider.toLowerCase() === 'openai') {
            try {
                // OpenAI provider
                response = await getCompletion(promptText, model, maxTokens);
// Defensive: Check for choices array
if (!response || !Array.isArray(response.choices) || response.choices.length === 0) {
    console.error('[LLMClient] OpenAI raw response:', response);
    throw new Error('No valid completion returned from OpenAI');
}
// Extract completion text for chat and legacy models
let completion;
if (model.includes('gpt-3.5') || model.includes('gpt-4')) {
    completion = response.choices[0].message?.content;
} else {
    completion = response.choices[0].text;
}
if (!completion) {
    console.error('[LLMClient] No completion text extracted from OpenAI response:', response);
    throw new Error('No valid completion text returned from OpenAI');
}
console.log('[LLMClient] Extracted completion:', completion);
return completion;
            } catch (error) {
                console.error('[LLMClient] OpenAI completion error:', error);
                throw new Error(`OpenAI API request failed: ${error.message}`);
            }
        } else if (provider.toLowerCase() === 'ollama') {
            try {
                // Ensure Ollama is initialized if needed (handled internally by ollamaUtil)
                const response = await ollamaUtil.getCompletion(promptText, model);
                // ollamaUtil.getCompletion should return the text response directly
                return response;
            } catch (error) {
                console.error('[LLMClient] Ollama completion error:', error);
                throw new Error(`Ollama request failed: ${error.message}`);
            }
        } else {
            console.error(`[LLMClient] Unsupported LLM provider: ${provider}`);
            throw new Error(`Unsupported LLM provider: ${provider}`);
        }
    }
};

module.exports = LLMClient;
