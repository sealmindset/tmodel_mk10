console.log('[DEBUG] ollama.js loaded');
/**
 * Ollama API Utility
 * Provides methods for interacting with the local Ollama API
 */
const axios = require('axios');
const pool = require('../db/db');
const logger = require('../utils/logger').forModule('ollama');

class OllamaUtil {
  constructor() {
    this.OLLAMA_API_URL_KEY = 'ollama.api_url';
    this.OLLAMA_MODEL_KEY = 'ollama.model';
    this.OLLAMA_API_URL = 'http://localhost:11434/api';
    this.DEFAULT_MODEL = 'llama4:latest';
    this.apiStatusMessageLogged = false;
    this.apiEvents = [];
    this.MAX_EVENTS = 50;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the Ollama client
   * @returns {Promise<void>}
   */
  async init() {
    console.log('[OLLAMA] Starting initialization...');
    if (this.initialized) {
      console.log('[OLLAMA] Already initialized, returning');
      return;
    }
    if (this.initializationPromise) {
      console.log('[OLLAMA] Initialization already in progress, returning existing promise');
      return this.initializationPromise;
    }

    console.log('[OLLAMA] Creating new initialization promise');
    this.initializationPromise = (async () => {
      try {
        console.log('[OLLAMA] Loading settings...');
        await this.loadSettings();
        console.log('[OLLAMA] Settings loaded, checking status...');
        // Skip initialization check to prevent recursive loop
        await this.checkStatus(true);
        this.initialized = true;
        console.log('[OLLAMA] Initialization completed successfully');
        logger.info('Ollama client initialized');
      } catch (error) {
        console.error('[OLLAMA] Initialization failed:', error);
        logger.error('Failed to initialize Ollama client:', error);
        // Clear the promise so we can retry
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Ensure the client is initialized
   * @private
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Load settings from database
   * @private
   */
  async loadSettings() {
    console.log('[OLLAMA] loadSettings() started');
    try {
      console.log('[OLLAMA] Loading API URL from database...');
      // Load API URL
      const apiUrlResult = await pool.query(
        'SELECT value FROM threat_model.settings WHERE key = $1',
        [this.OLLAMA_API_URL_KEY]
      );
      
      if (apiUrlResult.rows.length > 0 && apiUrlResult.rows[0].value) {
        this.OLLAMA_API_URL = apiUrlResult.rows[0].value;
        console.log(`[OLLAMA] Loaded API URL from database: ${this.OLLAMA_API_URL}`);
        logger.info(`Loaded Ollama API URL from database: ${this.OLLAMA_API_URL}`);
      } else {
        console.log(`[OLLAMA] No API URL found in database, using default: ${this.OLLAMA_API_URL}`);
      }

      console.log('[OLLAMA] Loading model from database...');
      // Load default model
      const modelResult = await pool.query(
        'SELECT value FROM threat_model.settings WHERE key = $1',
        [this.OLLAMA_MODEL_KEY]
      );
      
      if (modelResult.rows.length > 0 && modelResult.rows[0].value) {
        this.DEFAULT_MODEL = modelResult.rows[0].value;
        console.log(`[OLLAMA] Loaded model from database: ${this.DEFAULT_MODEL}`);
        logger.info(`Loaded Ollama model from database: ${this.DEFAULT_MODEL}`);
      } else {
        console.log(`[OLLAMA] No model found in database, using default: ${this.DEFAULT_MODEL}`);
      }
      
      console.log('[OLLAMA] loadSettings() completed successfully');
    } catch (error) {
      console.error('[OLLAMA] Error in loadSettings():', error);
      logger.error('Error loading Ollama settings:', error);
      throw error;
    }
  }

  /**
   * Check if the Ollama API is accessible
   * @param {boolean} skipInitialization - If true, skip the ensureInitialized check
   * @returns {Promise<boolean>} true if connected, false otherwise
   */
  async checkStatus(skipInitialization = false) {
    console.log('[OLLAMA] checkStatus() started');
    try {
      if (!skipInitialization) {
        console.log('[OLLAMA] Ensuring Ollama is initialized...');
        await this.ensureInitialized();
      } else {
        console.log('[OLLAMA] Skipping initialization check');
      }
      
      console.log(`[OLLAMA] Making request to: ${this.OLLAMA_API_URL}/tags`);
      const startTime = Date.now();
      const response = await axios.get(`${this.OLLAMA_API_URL}/tags`, {
        timeout: 5000 // 5 second timeout
      });
      const duration = Date.now() - startTime;
      
      console.log(`[OLLAMA] API response status: ${response.status} (${duration}ms)`);
      const isSuccess = response.status === 200;
      
      if (isSuccess) {
        console.log('[OLLAMA] Successfully connected to Ollama API');
      } else {
        console.error(`[OLLAMA] Unexpected status code: ${response.status}`, response.data);
      }
      
      return isSuccess;
    } catch (error) {
      console.error('[OLLAMA] Error in checkStatus():', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout
        },
        response: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      });
      
      logger.error('Error checking Ollama status:', error);
      return false;
    } finally {
      console.log('[OLLAMA] checkStatus() completed');
    }
  }

  /**
   * Get a completion from the Ollama API
   * @param {string} prompt - The prompt to send to the API
   * @param {string} model - The model to use (default: llama3:latest)
   * @param {number} maxTokens - Maximum number of tokens to generate
   * @returns {Promise<Object>} The API response
   */
  async getCompletion(prompt, model = 'llama4', maxTokens = 100) {
    try {
      console.log('[OLLAMA] getCompletion called');
      await this.ensureInitialized();
      console.log(`[OLLAMA] Sending request to ${this.OLLAMA_API_URL}/generate with model: ${model}`);
      console.log(`[OLLAMA] Message length: ${prompt.length} characters`);
      
      // Create a robust axios instance with increased timeout
      const response = await axios.post(`${this.OLLAMA_API_URL}/generate`, {
        model,
        prompt,
        max_tokens: maxTokens,
        stream: false // Explicitly request non-streaming response
      }, {
        timeout: 120000, // 2 minute timeout for large requests
        maxBodyLength: 10 * 1024 * 1024, // 10MB max body length
        maxContentLength: 10 * 1024 * 1024 // 10MB max content length
      });
      
      console.log('[OLLAMA] Response received successfully');
      return response.data;
    } catch (error) {
      console.error('[OLLAMA] Error in getCompletion:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout
        },
        response: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      });
      
      logger.error('Error getting completion from Ollama:', error);
      throw error;
    }
  }

  /**
   * Get a chat completion from the Ollama API
   * @param {Array} messages - Array of message objects with role and content
   * @param {string} model - The model to use (default: llama3:latest)
   * @param {number} maxTokens - Maximum number of tokens to generate
   * @returns {Promise<Object>} The API response formatted like OpenAI's
   */
  async getChatCompletion(messages, model = 'llama4', maxTokens = 100) {
    try {
      await this.ensureInitialized();
      
      const response = await axios.post(`${this.OLLAMA_API_URL}/chat`, {
        model,
        messages,
        max_tokens: maxTokens
      });
      
      return response.data;
    } catch (error) {
      logger.error('Error getting chat completion from Ollama:', error);
      throw error;
    }
  }

  /**
   * Get list of available models
   * @returns {Promise<Array>} List of available models
   */
  async getModels() {
    try {
      await this.ensureInitialized();
      const response = await axios.get(`${this.OLLAMA_API_URL}/tags`);
      return response.data.models || [];
    } catch (error) {
      logger.error('Error getting models from Ollama:', error);
      throw error;
    }
  }

  /**
   * Add an event to the API events log
   * @param {string} type - Type of event (e.g., 'request', 'response', 'error')
   * @param {Object} data - Event data
   */
  logApiEvent(type, data) {
    this.apiEvents.unshift({
      timestamp: new Date().toISOString(),
      type,
      data
    });

    // Keep only the most recent events
    if (this.apiEvents.length > this.MAX_EVENTS) {
      this.apiEvents = this.apiEvents.slice(0, this.MAX_EVENTS);
    }
  }

  /**
   * Get all logged API events
   * @returns {Array} Array of API events
   */
  getApiEvents() {
    return [...this.apiEvents];
  }

  /**
   * Test connection to Ollama API
   * @param {string} apiUrl - The API URL to test
   * @returns {Promise<{success: boolean, error?: string}>} Connection test result
   */
  async testConnection(apiUrl) {
    try {
      const response = await axios.get(`${apiUrl}/api/tags`, {
        timeout: 5000 // 5 second timeout
      });
      return { success: response.status === 200 };
    } catch (error) {
      logger.error('Error testing Ollama connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reload the Ollama client with current settings
   * @returns {Promise<boolean>} True if reloaded successfully
   */
  async reloadClient() {
    try {
      this.initialized = false;
      this.initializationPromise = null;
      await this.init();
      return true;
    } catch (error) {
      logger.error('Error reloading Ollama client:', error);
      return false;
    }
  }

  /**
   * Get the current API URL
   * @returns {string} The current API URL
   */
  getApiUrl() {
    return this.OLLAMA_API_URL;
  }

  /**
   * Get the default model
   * @returns {string} The default model
   */
  getDefaultModel() {
    return this.DEFAULT_MODEL;
  }
}

// Create and export a singleton instance
const ollamaUtil = new OllamaUtil();

// Initialize the instance when this module is loaded
ollamaUtil.init().catch(error => {
  logger.error('Failed to initialize Ollama utility:', error);
});

module.exports = ollamaUtil;
