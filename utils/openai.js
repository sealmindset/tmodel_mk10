/**
 * OpenAI API Utility
 * Provides methods for interacting with the OpenAI API
 */
const OpenAI = require('openai');
// Redis utility removed.
// Redis client removed.

// Initialize logger
const logger = require('./logger').forModule('openai');

// Redis key constants removed
// Redis key removed

// Flag to ensure we only log the API key message once per server startup
let apiKeyMessageLogged = false;

// Function to get API key from settings first (threat_model.settings),
// then fall back to legacy public.api_keys. No .env fallback here.
const getApiKey = async () => {
  try {
    // 1) Try threat_model.settings via settingsService (bypass cache to avoid stale key)
    const settingsService = require('../services/settingsService');
    // Force cache clear to ensure we see keys inserted outside the app flow
    if (typeof settingsService.clearSettingsCache === 'function') {
      settingsService.clearSettingsCache();
    }
    // Read directly by key to avoid full-cache reliance
    const keyFromSettings = await settingsService.getSettingByKey('openai.api_key');
    if (keyFromSettings && String(keyFromSettings).trim() !== '') {
      if (!apiKeyMessageLogged) {
        logger.info('Loaded OpenAI API key from threat_model.settings (openai.api_key)');
        apiKeyMessageLogged = true;
      }
      return String(keyFromSettings).trim();
    }

    // 2) Fall back to legacy table public.api_keys
    const pool = require('../db/db');
    logger.debug('Falling back to legacy public.api_keys table for OpenAI API key');
    const result = await pool.query(
      'SELECT api_key FROM api_keys WHERE provider = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1',
      ['openai']
    );
    if (result.rows.length > 0) {
      const apiKey = result.rows[0].api_key;
      if (apiKey && apiKey.trim() !== '') {
        if (!apiKeyMessageLogged) {
          logger.info('Loaded OpenAI API key from public.api_keys');
          apiKeyMessageLogged = true;
        }
        return apiKey;
      } else {
        logger.warn('Retrieved empty OpenAI API key from public.api_keys');
      }
    } else {
      logger.warn('No OpenAI API key found in public.api_keys');
    }

    logger.warn('No OpenAI API key found in PostgreSQL settings or legacy table');
    return null;
  } catch (error) {
    logger.error('Error getting OpenAI API key', null, error);
    return null;
    logger.error('Error retrieving API key', null, error);
    // Fall back to environment variables
    return process.env.OPENAI_API_KEY || process.env.API_KEY || '';
  }
};

// Synchronous version for immediate initialization
const getApiKeySync = () => {
  // For initial setup, we can only use environment variables
  // Later calls will use getApiKey() which checks PostgreSQL first
  return process.env.OPENAI_API_KEY || process.env.API_KEY || '';
};

// Create an OpenAI API client (v4.x+)
let openai = new OpenAI({
  apiKey: getApiKeySync(), // Use sync version for initial setup
});

// Function to refresh the API client with a new key
const refreshClient = async () => {
  try {
    const apiKey = await getApiKey();
    logger.debug('API key retrieved for client refresh', {
      keyLength: apiKey ? apiKey.length : 0,
      keyAvailable: !!apiKey
    });

    if (apiKey) {
      // Log first and last 4 characters and length for debugging
      const keyStart = apiKey.substring(0, 4);
      const keyEnd = apiKey.substring(apiKey.length - 4);
      logger.info(`API key for OpenAI client: ${keyStart}...${keyEnd} (length: ${apiKey.length})`);
    } else {
      logger.warn('No API key available for OpenAI client refresh');
    }

    // Create a new OpenAI API client (v4.x+)
    openai = new OpenAI({ apiKey });
    // Also update the exported reference so external consumers get the fresh client
    module.exports.openai = openai;
    logger.info('OpenAI client refreshed with new key');
    return true;
  } catch (error) {
    logger.error('Error refreshing OpenAI client', null, error);
    return false;
  }
};

/**
 * Check if the OpenAI API is accessible
 * @returns {Promise<boolean>} true if connected, false otherwise
 */
const checkStatus = async () => {
  try {
    // Refresh the client to ensure we have the latest API key
    await refreshClient();
    
    // First check if we have an API key
    const apiKey = await getApiKey();
    console.log('OpenAI status check - API key retrieved, length:', apiKey ? apiKey.length : 0);
    if (apiKey) {
      console.log('OpenAI status check - API key starts with:', apiKey.substring(0, 4));
      console.log('OpenAI status check - API key ends with:', apiKey.substring(apiKey.length - 4));
    }
    
    if (!apiKey) {
      console.error('OpenAI status check failed: No API key provided');
      return false;
    }
    
    console.log('OpenAI status check - Making API call to test connectivity...');
    // Use a lightweight models list call to check connectivity
    await openai.models.list();
    console.log('OpenAI status check - API call successful!');
    return true;
  } catch (error) {
    console.error('OpenAI connection error:', error.message);
    // More detailed error information
    if (error.response) {
      // The request was made, but the API returned an error status code
      console.error(`API error status: ${error.response.status}`);
      console.error(`API error details: ${JSON.stringify(error.response.data)}`);
      
      // Check for specific error types
      if (error.response.status === 401) {
        console.error('Authentication error: API key is invalid or missing');
      } else if (error.response.status === 429) {
        console.error('Rate limit exceeded: Too many requests');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from OpenAI API');
    }
    return false;
  }
};

// Store recent API events for monitoring
const apiEvents = [];
const MAX_EVENTS = 50; // Maximum number of events to keep

/**
 * Add an event to the API events log
 * @param {string} type - Type of event (request or response)
 * @param {object} data - Event data
 */
const logApiEvent = (type, data) => {
  // Create event object with timestamp
  const event = {
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type,
    data: typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
  };
  
  // Add to beginning of array (newest first)
  apiEvents.unshift(event);
  
  // Trim array to maximum size
  if (apiEvents.length > MAX_EVENTS) {
    apiEvents.length = MAX_EVENTS;
  }
  
  // Log to console for debugging
  if (type === 'request') {
    console.log(`OpenAI API request: Model: ${data.model}, Prompt: ${data.prompt?.substring(0, 50)}...`);
  } else {
    // Defensive: Only log usage if it exists
    if (data && data.usage && typeof data.usage.total_tokens !== 'undefined') {
      console.log(`OpenAI API response: Tokens used: ${data.usage.total_tokens}`);
    } else {
      console.log('OpenAI API response: No usage data available.');
    }
  }
};

/**
 * Get all logged API events
 * @returns {Array} - Array of API events
 */
const getApiEvents = () => apiEvents;

/**
 * Get a completion from the OpenAI API
 * @param {string} prompt - The prompt to send to the API
 * @param {string} model - The model to use (default: gpt-3.5-turbo)
 * @param {number} maxTokens - Maximum number of tokens to generate
 * @returns {Promise<Object>} - The API response
 */
const { logLlmUsage } = require('./llmUsageLogger');
const { v4: uuidv4 } = require('uuid');

/**
 * Get a completion from the OpenAI API and log usage
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {object} options - { session_id, task_type, meta }
 * @returns {Promise<Object>}
 */
const getCompletion = async (prompt, model = 'gpt-4', maxTokens = 100, options = {}) => {
  try {
    await refreshClient();
    let response;
    let usage = null;
    let completionText = '';
    let task_type = options.task_type || null;
    let session_id = options.session_id || null;
    let meta = options.meta || null;
    // Decide API: default to chat.completions for modern models
    // Use legacy completions only for classic instruct/text models
    const modelId = String(model || '').toLowerCase();
    const isLegacyCompletionModel = (
      modelId.startsWith('text-') ||
      modelId.includes('instruct') ||
      modelId === 'davinci-002' ||
      modelId === 'babbage-002'
    );
    if (!isLegacyCompletionModel) {
      logger.info(`[openai.getCompletion] Using chat.completions for model=${model}`);
      logApiEvent('request', {
        model,
        prompt,
        maxTokens,
        type: 'chat.completion',
        timestamp: new Date().toISOString()
      });
      {
        const req = {
          model,
          messages: [{ role: 'user', content: prompt }]
        };
        if (Number.isFinite(maxTokens)) req.max_tokens = maxTokens;
        response = await openai.chat.completions.create(req);
      }
      logger.info('Raw OpenAI API response:', response);
      usage = response.usage || {};
      completionText = response.choices && response.choices[0] ? response.choices[0].message.content : '';
    } else {
      logger.info(`[openai.getCompletion] Using legacy completions for model=${model}`);
      logApiEvent('request', {
        model,
        prompt,
        maxTokens,
        type: 'completion',
        timestamp: new Date().toISOString()
      });
      {
        const req = { model, prompt };
        if (Number.isFinite(maxTokens)) req.max_tokens = maxTokens;
        response = await openai.completions.create(req);
      }
      logger.info('Raw OpenAI API response:', response);
      usage = response.usage || {};
      completionText = response.choices && response.choices[0] ? response.choices[0].text : '';
    }
    logApiEvent('response', response);
    // Log to llm_usage_log
    try {
      await logLlmUsage({
        session_id: session_id || uuidv4(),
        task_type,
        model_provider: 'openai',
        model_name: model,
        tokens_prompt: usage.prompt_tokens || null,
        tokens_completion: usage.completion_tokens || null,
        tokens_total: usage.total_tokens || null,
        cost_usd: meta && meta.cost_usd ? meta.cost_usd : null, // Optionally pass cost in meta
        currency: 'USD',
        prompt,
        response: completionText,
        meta
      });
    } catch (logErr) {
      logger.error('Failed to log OpenAI LLM usage', logErr);
    }
    return response;
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    logApiEvent('error', {
      message: error.message,
      code: status,
      details: data
    });
    try {
      logger.error('[openai.getCompletion] OpenAI request failed', {
        model,
        status,
        error: data || error.message
      });
    } catch (_) {}
    console.error('Error fetching from OpenAI API:', error.message);
    throw error;
  }
};


/**
 * Fetch available models from OpenAI API
 * Returns array of model ids (e.g., gpt-4o, gpt-4o-mini, gpt-4-turbo, etc.)
 */
const fetchAvailableModels = async () => {
  try {
    await refreshClient();
    const list = await openai.models.list();
    const data = (list && Array.isArray(list.data)) ? list.data : [];
    // Return all model ids to include new families (e.g., o3, o4, omni)
    const models = data
      .map(m => m && m.id)
      .filter(Boolean);
    logger.info(`[openai] Retrieved ${models.length} OpenAI models: ` + models.slice(0, 10).join(', ') + (models.length > 10 ? '...' : ''));
    return models;
  } catch (error) {
    console.error('Error fetching OpenAI models:', error.message);
    return [];
  }
};

/**
 * Helper: Get preferred OpenAI config (provider, apiKey, model) from PostgreSQL or environment
 * Returns { provider, apiKey, model }
 */
const getPreferredOpenAIConfig = async () => {
  // Use settingsService or fallback to environment variables
  const settingsService = require('../services/settingsService');
  const provider = await settingsService.getSetting('settings:llm:provider', 'openai');
  if (provider !== 'openai') return null;
  const apiKey = await getApiKey();
  // Prefer model set by settings/openai route: threat_model.settings key 'openai.model'
  const model = await settingsService.getSetting('openai.model', 'gpt-3.5-turbo');
  return { provider, apiKey, model };
};

/**
 * Verify that the OpenAI API key is valid by making a test request
 * @returns {Promise<{valid: boolean, source: string, message: string}>}
 */
const verifyApiKey = async () => {
  try {
    // Get the API key using our prioritized approach
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      return {
        valid: false,
        source: 'none',
        message: 'No API key found in any storage location'
      };
    }
    
    // Determine the source of the API key
    let source = 'unknown';
    
    // Check if it matches the environment variable
    if (apiKey === process.env.OPENAI_API_KEY) {
      source = 'environment';
    } else {
      // If it's not from environment, assume PostgreSQL
      source = 'postgresql';
    }
    
    // Make a lightweight API call to verify the key
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      return {
        valid: true,
        source,
        message: `Valid API key found in ${source}`
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        source,
        message: `Invalid API key from ${source}: ${errorData.error?.message || response.statusText}`
      };
    }
  } catch (error) {
    return {
      valid: false,
      source: 'error',
      message: `Error verifying API key: ${error.message}`
    };
  }
};

/**
 * Test connection to OpenAI API with a provided API key
 * @param {string} apiKey - The API key to test
 * @returns {Promise<Object>} - { success: boolean, models?: Array, error?: string }
 */
const testConnection = async (apiKey) => {
  try {
    if (!apiKey) {
      return { success: false, error: 'API key is required' };
    }

    // Make a lightweight API call to verify the key
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error?.message || `API returned ${response.status}: ${response.statusText}`
      };
    }
    
    // Parse the response to get models
    const data = await response.json();
    
    // Filter for chat/completion models and extract useful info
    const models = data.data
      .filter(model => model.id.startsWith('gpt-'))
      .map(model => ({
        id: model.id,
        name: model.id.replace('gpt-', 'GPT-').replace(/-([0-9])/, ' $1'),
        created: model.created,
        owned_by: model.owned_by
      }))
      .sort((a, b) => b.created - a.created); // Sort newest first
    
    // Cache API key in Redis for future use (implementation removed)
    try {
      // await redisClient.set(OPENAI_API_KEY_REDIS_KEY, apiKey);
      // logger.debug('Cached tested API key in Redis');
    } catch (redisError) {
      logger.warn('Failed to cache tested API key in Redis', redisError);
    }
    
    return { 
      success: true,
      models
    };
  } catch (error) {
    logger.error('Error testing OpenAI connection', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
};

module.exports = {
  openai,
  checkStatus,
  getCompletion,
  getApiKey,
  getApiEvents,
  logApiEvent,
  refreshClient,
  fetchAvailableModels,
  getPreferredOpenAIConfig,
  verifyApiKey,
  testConnection
};
