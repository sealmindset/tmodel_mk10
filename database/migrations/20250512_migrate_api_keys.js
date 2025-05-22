/**
 * Migration: Move API Keys from settings table to dedicated api_keys table
 * Date: 2025-05-12
 * 
 * This migration moves API keys from the threat_model.settings table
 * to the dedicated public.api_keys table for better security and organization.
 */
const { Pool } = require('pg');

// Create a logger or use console.log if logger module not available
let logger;
try {
  logger = require('../../utils/logger').forModule('migration');
} catch (e) {
  logger = {
    info: console.log,
    error: console.error,
    debug: console.log,
    warn: console.warn
  };
}

// Get DB connection details from environment or use defaults
const host = process.env.POSTGRES_HOST || 'localhost';
const port = process.env.POSTGRES_PORT || '5432';
const database = process.env.POSTGRES_DB || 'postgres';
const user = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || '';

// Log connection info
console.log('Connecting to PostgreSQL database with the following settings:');
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`Database: ${database}`);

async function up() {
  // Create a new pool for this migration
  const pool = new Pool({
    host,
    port,
    database,
    user,
    password
  });
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    logger.info('Starting API keys migration');
    
    // Make sure api_keys table exists and has all required columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.api_keys (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        api_key TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Add indexes if they don't exist
      CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON public.api_keys(provider);
      CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active);
    `);
    
    // Get API keys from settings table
    const settingsKeys = [
      { settingKey: 'openai.api_key', provider: 'openai' },
      { settingKey: 'settings.rapid7.api_key', provider: 'rapid7' },
      { settingKey: 'settings:rapid7:api_key', provider: 'rapid7' },
      { settingKey: 'rapid7.api.key', provider: 'rapid7' },
      { settingKey: 'rapid7_api_key', provider: 'rapid7' }
    ];
    
    let migratedCount = 0;
    
    for (const keyInfo of settingsKeys) {
      // Get API key from settings
      const result = await client.query(
        'SELECT value FROM threat_model.settings WHERE key = $1',
        [keyInfo.settingKey]
      );
      
      if (result.rows.length > 0 && result.rows[0].value) {
        const apiKey = result.rows[0].value;
        
        // Deactivate any existing keys for this provider
        await client.query(`
          UPDATE public.api_keys
          SET is_active = FALSE
          WHERE provider = $1
        `, [keyInfo.provider]);
        
        // Insert the key into api_keys table
        await client.query(`
          INSERT INTO public.api_keys (provider, api_key)
          VALUES ($1, $2)
        `, [keyInfo.provider, apiKey]);
        
        migratedCount++;
        logger.info(`Migrated ${keyInfo.provider} API key`);
      }
    }
    
    logger.info(`API key migration complete. Migrated ${migratedCount} keys.`);
    
    await client.query('COMMIT');
    return { success: true, count: migratedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error migrating API keys', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function down() {
  logger.warn('No rollback implemented for API keys migration');
  return { success: true, message: 'No rollback needed' };
}

module.exports = {
  up,
  down
};

// Execute the migration when this script is run directly
if (require.main === module) {
  console.log('Running API keys migration...');
  up().then(result => {
    console.log('Migration result:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
