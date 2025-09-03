/**
 * LLM Client for Report Generation
 *
 * This module abstracts calls to different LLM providers (OpenAI, Ollama)
 * for generating report content based on provided prompts.
 */

const ollamaUtil = require('../utils/ollama'); // Assuming ollamaUtil is set up for CLI completions
const { getCompletion } = require('../utils/openai');
const { withRetry, RetryError } = require('../utils/retry');
const { getCircuitBreaker, CircuitBreakerError } = require('../utils/circuitBreaker');

const LLMClient = {
    /**
     * Get a completion from the specified LLM provider.
     *
     * @param {string} promptText The full prompt text to send to the LLM.
     * @param {string} provider The LLM provider ('openai' or 'ollama').
     * @param {string} model The specific model to use (e.g., 'gpt-3.5-turbo', 'llama3:latest').
     * @param {Object} options Additional options for the request.
     * @param {AbortSignal} options.signal Abort signal for cancelling the request.
     * @param {number} options.timeoutMs Timeout in milliseconds.
     * @param {number} options.maxRetries Maximum number of retry attempts.
     * @returns {Promise<string>} The LLM's response text.
     * @throws {Error} If the provider is unsupported or the API call fails.
     */
    getCompletion: async function(promptText, provider, model, options = {}) {
        console.log(`[LLMClient] Getting completion. Provider: ${provider}, Model: ${model}`);

        const maxTokens = options.maxTokens || 1024;
        const maxRetries = options.maxRetries || 2; // Conservative retry count
        const timeoutMs = options.timeoutMs;

        // Provider-specific timeout defaults if not specified
        let effectiveTimeout = timeoutMs;
        if (!effectiveTimeout) {
            effectiveTimeout = provider.toLowerCase() === 'ollama' ? 60000 : 45000; // Ollama: 60s, OpenAI: 45s
        }

        const retryOptions = {
            maxAttempts: maxRetries + 1, // +1 for initial attempt
            baseDelay: 1000,
            maxDelay: 10000,
            onRetry: (attempt, delay, error) => {
                console.warn(`[LLMClient] Retry attempt ${attempt}/${maxRetries} after ${delay.toFixed(0)}ms delay. Error: ${error.message}`);
            }
        };

        try {
            if (provider.toLowerCase() === 'openai') {
                const circuitBreaker = getCircuitBreaker('openai');
                return await circuitBreaker.execute(async () => {
                    return await withRetry(async () => {
                        const response = await getCompletion(promptText, model, maxTokens, {
                            signal: options.signal,
                            timeoutMs: effectiveTimeout
                        });

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

                        console.log('[LLMClient] Extracted completion from OpenAI');
                        return completion;
                    }, retryOptions);
                });

            } else if (provider.toLowerCase() === 'ollama') {
                const circuitBreaker = getCircuitBreaker('ollama');
                return await circuitBreaker.execute(async () => {
                    return await withRetry(async () => {
                        const response = await ollamaUtil.getCompletion(promptText, model, maxTokens, {
                            signal: options.signal,
                            timeoutMs: effectiveTimeout
                        });
                        console.log('[LLMClient] Got completion from Ollama');
                        return response;
                    }, retryOptions);
                });

            } else {
                console.error(`[LLMClient] Unsupported LLM provider: ${provider}`);
                throw new Error(`Unsupported LLM provider: ${provider}`);
            }
        } catch (error) {
            if (error instanceof CircuitBreakerError) {
                console.error(`[LLMClient] Circuit breaker ${error.state} for ${provider}:`, error.message);
                throw new Error(`${provider} service temporarily unavailable (circuit breaker ${error.state})`);
            }
            if (error instanceof RetryError) {
                console.error(`[LLMClient] All retry attempts failed for ${provider}:`, error.lastError);
                throw new Error(`${provider} request failed after retries: ${error.lastError.message}`);
            } else {
                console.error(`[LLMClient] ${provider} completion error:`, error);
                throw new Error(`${provider} request failed: ${error.message}`);
            }
        }
    }
};

module.exports = LLMClient;
