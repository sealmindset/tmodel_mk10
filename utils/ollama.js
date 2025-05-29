console.log('[DEBUG] ollama.js loaded');
/**
 * Ollama API Utility
 * Provides methods for interacting with the local Ollama API
 */
const { exec, spawn } = require('child_process');
const pool = require('../db/db');
const logger = require('../utils/logger').forModule('ollama');

class OllamaUtil {
  constructor() {
    this.OLLAMA_API_URL_KEY = 'ollama.api_url';
    this.OLLAMA_MODEL_KEY = 'ollama.model';
    this.OLLAMA_API_URL = process.env.FASTAPI_BASE_URL || 'http://localhost:8000/api/ollama';
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
      // Only check initialization if not skipping
      if (!skipInitialization) {
        console.log('[OLLAMA] Ensuring Ollama is initialized...');
        await this.ensureInitialized();
      } else {
        console.log('[OLLAMA] Skipping initialization check');
      }
      // Use the CLI to check if models are available
      return await new Promise((resolve) => {
        const { exec } = require('child_process');
        exec('ollama list --json', (error, stdout, stderr) => {
          if (!error) {
            // Try parsing JSON output (newer versions)
            try {
              const parsed = JSON.parse(stdout);
              const hasModels = Array.isArray(parsed.models) && parsed.models.length > 0;
              if (hasModels) {
                console.log('[OLLAMA] Ollama CLI is available and returned models (JSON).');
                return resolve(true);
              } else {
                console.error('[OLLAMA] Ollama CLI (JSON) returned no models.');
                return resolve(false);
              }
            } catch (e) {
              console.warn('[OLLAMA] Ollama CLI --json output not parseable, falling back to plain output.');
              // Fall through to plain parsing below
            }
          }
          // If --json is not supported, try plain output
          exec('ollama list', (plainErr, plainStdout, plainStderr) => {
            if (plainErr) {
              console.error('[OLLAMA] Ollama CLI not available or failed (plain):', plainErr.message);
              logger.error('Error checking Ollama CLI status (plain):', plainErr);
              return resolve(false);
            }
            // Parse plain text output for at least one model
            const lines = plainStdout.split('\n').filter(l => l.trim().length > 0);
            // First line is usually a header, so check for >1 lines
            if (lines.length > 1) {
              console.log('[OLLAMA] Ollama CLI is available and returned models (plain).');
              return resolve(true);
            } else {
              console.error('[OLLAMA] Ollama CLI (plain) returned no models.');
              return resolve(false);
            }
          });
        });
      });
    } catch (error) {
      console.error('[OLLAMA] Error in checkStatus():', error);
      logger.error('Error checking Ollama CLI status:', error);
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
      await this.ensureInitialized();
      return await new Promise((resolve, reject) => {
        const proc = spawn('ollama', ['run', model]);
        let output = '';
        let errorOutput = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
        proc.on('close', (code) => {
          if (code !== 0) {
            logger.error(`Ollama CLI exited with code ${code}: ${errorOutput}`);
            return reject(new Error(`Ollama CLI exited with code ${code}`));
          }
          resolve({ response: output.trim() });
        });
        proc.stdin.write(prompt);
        proc.stdin.end();
      });
    } catch (error) {
      logger.error('Error getting completion from Ollama CLI:', error);
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
      // Flatten messages into a single prompt (simple approach)
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      return await this.getCompletion(prompt, model, maxTokens);
    } catch (error) {
      logger.error('Error getting chat completion from Ollama CLI:', error);
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
      return await new Promise((resolve, reject) => {
        exec('ollama list --json', (error, stdout, stderr) => {
          if (error) {
            logger.error('Ollama CLI error (list):', error);
            return reject(error);
          }
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed.models ? parsed.models.map(m => m.name) : []);
          } catch (e) {
            logger.error('Failed to parse Ollama CLI output (list):', e);
            reject(e);
          }
        });
      });
    } catch (error) {
      logger.error('Error getting models from Ollama CLI:', error);
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
   * @returns {Promise<{success: boolean, error?: string}>} Connection test result
   */
  async testConnection() {
    try {
      // Try to list models using the CLI
      await this.getModels();
      return { success: true };
    } catch (error) {
      logger.error('Error testing Ollama CLI connection:', error);
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
