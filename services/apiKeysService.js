/**
 * API Keys Service
 * Provides functionality to store and retrieve API keys from the dedicated api_keys table
 */
const db = require('../database');

/**
 * Get an API key by provider
 * 
 * @param {string} provider - Provider name (e.g., 'openai', 'ollama', 'rapid7')
 * @returns {Promise<string|null>} - The API key or null if not found
 */
async function getApiKey(provider) {
  try {
    console.debug(`Getting API key for provider: ${provider}`);
    
    const query = `
      SELECT api_key FROM api_keys 
      WHERE provider = $1 AND is_active = true 
      ORDER BY updated_at DESC LIMIT 1
    `;
    
    const result = await db.query(query, [provider]);
    
    if (result.rows.length === 0) {
      console.debug(`No API key found for provider: ${provider}`);
      return null;
    }
    
    return result.rows[0].api_key;
  } catch (error) {
    console.error(`Error getting API key for provider: ${provider}`, error);
    return null;
  }
}

/**
 * Store or update an API key
 * 
 * @param {string} provider - Provider name (e.g., 'openai', 'ollama', 'rapid7')
 * @param {string} apiKey - The API key to store
 * @returns {Promise<boolean>} - Success flag
 */
async function storeApiKey(provider, apiKey) {
  try {
    console.debug(`Storing API key for provider: ${provider}`);
    
    // First, deactivate all existing keys for this provider
    await db.query(`
      UPDATE api_keys SET is_active = false
      WHERE provider = $1
    `, [provider]);
    
    // Now insert the new key
    await db.query(`
      INSERT INTO api_keys (provider, api_key, created_at, updated_at, is_active)
      VALUES ($1, $2, NOW(), NOW(), true)
    `, [provider, apiKey]);
    
    console.log(`Successfully stored API key for provider: ${provider}`);
    return true;
  } catch (error) {
    console.error(`Error storing API key for provider: ${provider}`, error);
    return false;
  }
}

/**
 * Check if a provider has an API key
 * 
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} - True if provider has an active API key
 */
async function hasApiKey(provider) {
  try {
    const query = `
      SELECT COUNT(*) as count FROM api_keys
      WHERE provider = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [provider]);
    return result.rows[0].count > 0;
  } catch (error) {
    console.error(`Error checking API key existence for provider: ${provider}`, error);
    return false;
  }
}

/**
 * Remove all API keys for a provider
 * 
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} - Success flag
 */
async function removeApiKeys(provider) {
  try {
    await db.query(`
      UPDATE api_keys SET is_active = false
      WHERE provider = $1
    `, [provider]);
    
    console.log(`Successfully deactivated API keys for provider: ${provider}`);
    return true;
  } catch (error) {
    console.error(`Error removing API keys for provider: ${provider}`, error);
    return false;
  }
}

/**
 * Migrate API keys from settings table to api_keys table
 * This is a one-time operation to move keys from the old storage to the new one
 * 
 * @returns {Promise<{success: boolean, count: number}>} - Result of migration
 */
async function migrateApiKeysFromSettings() {
  try {
    // Find all API key settings that might exist in the settings table
    const keysToMigrate = [
      { settingKey: 'openai.api_key', provider: 'openai' },
      { settingKey: 'settings.rapid7.api_key', provider: 'rapid7' },
      { settingKey: 'settings:rapid7:api_key', provider: 'rapid7' },
      { settingKey: 'rapid7.api.key', provider: 'rapid7' },
      { settingKey: 'rapid7_api_key', provider: 'rapid7' }
    ];
    
    let migratedCount = 0;
    
    for (const keyInfo of keysToMigrate) {
      // Get the key from settings
      const result = await db.query(
        'SELECT value FROM threat_model.settings WHERE key = $1',
        [keyInfo.settingKey]
      );
      
      if (result.rows.length > 0 && result.rows[0].value) {
        const apiKeyValue = result.rows[0].value;
        
        // Store it in api_keys table
        await storeApiKey(keyInfo.provider, apiKeyValue);
        migratedCount++;
        
        console.log(`Migrated API key for ${keyInfo.provider} from settings.${keyInfo.settingKey}`);
      }
    }
    
    return { success: true, count: migratedCount };
  } catch (error) {
    console.error('Error migrating API keys from settings', error);
    return { success: false, count: 0 };
  }
}

module.exports = {
  getApiKey,
  storeApiKey,
  hasApiKey,
  removeApiKeys,
  migrateApiKeysFromSettings
};
