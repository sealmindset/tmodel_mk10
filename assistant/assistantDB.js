// assistantDB.js
// Handles all Assistant AI DB queries (PostgreSQL)
const { Pool } = require('pg');

// Get the connection string from the environment
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres';
console.log(`Assistant DB using connection: ${connectionString}`);

// Create the pool with the connection string
const pool = new Pool({ connectionString });

// Initialize required tables if they don't exist
async function initializeTables() {
  try {
    // First check if we can connect
    const client = await pool.connect();
    try {
      // Use the threat_model schema since that's where our other tables are
      await client.query('CREATE SCHEMA IF NOT EXISTS threat_model');
      
      // Create tables if they don't exist in the threat_model schema
      await client.query(`
        CREATE TABLE IF NOT EXISTS threat_model.assistant_chat_history (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          session_id TEXT,
          provider TEXT,
          model TEXT,
          user_message TEXT,
          ai_response TEXT,
          created_at TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS threat_model.assistant_settings (
          user_id TEXT,
          session_id TEXT,
          mirror_mode BOOLEAN,
          context_enabled BOOLEAN,
          created_at TIMESTAMP,
          PRIMARY KEY (user_id, session_id)
        );
        
        CREATE TABLE IF NOT EXISTS threat_model.openai_assistants (
          model TEXT PRIMARY KEY,
          assistant_id TEXT,
          created_at TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS threat_model.openai_threads (
          session_id TEXT PRIMARY KEY,
          thread_id TEXT,
          created_at TIMESTAMP
        );
      `);
      console.log('Assistant tables initialized successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error initializing assistant tables:', error);
  }
}

// Initialize tables on module load
initializeTables();

exports.saveChatHistory = async ({ user_id, session_id, provider, model, user_message, ai_response }) => {
  try {
    await pool.query(
      `INSERT INTO threat_model.assistant_chat_history (user_id, session_id, provider, model, user_message, ai_response, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [user_id, session_id, provider, model, user_message, ai_response]
    );
    console.log(`Chat history saved for session ${session_id}`);
  } catch (error) {
    console.error('Error saving chat history:', error);
    throw error;
  }
};

exports.getChatHistory = async ({ user_id, session_id }) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM threat_model.assistant_chat_history 
       WHERE (user_id = $1 OR session_id = $2) 
       ORDER BY created_at DESC LIMIT 50`,
      [user_id || 'anonymous', session_id || 'default-session']
    );
    return rows;
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
};

exports.saveSettings = async ({ user_id, session_id, mirror_mode, context_enabled }) => {
  try {
    await pool.query(
      `INSERT INTO threat_model.assistant_settings (user_id, session_id, mirror_mode, context_enabled, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, session_id) DO UPDATE SET mirror_mode = $3, context_enabled = $4, created_at = NOW()`,
      [user_id, session_id, mirror_mode, context_enabled]
    );
    console.log(`Settings saved for session ${session_id}`);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

exports.getApiKey = async (provider) => {
  try {
    // Fetch API key from the api_keys table with the correct schema and column names
    const { rows } = await pool.query(
      `SELECT api_key FROM api_keys WHERE provider = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
      [provider]
    );
    
    if (rows.length > 0 && rows[0].api_key) {
      console.log(`Successfully retrieved ${provider} API key (starts with ${rows[0].api_key.substring(0, 5)}...)`); 
      return rows[0].api_key;
    } else {
      console.error(`No API key found for provider ${provider}`);
      // Fallback to environment variable
      if (provider === 'openai' && process.env.OPENAI_API_KEY) {
        console.log('Using OpenAI API key from environment variable');
        return process.env.OPENAI_API_KEY;
      }
      return null;
    }
  } catch (error) {
    console.error(`Error fetching API key for provider ${provider}:`, error);
    // Fallback to environment variable if database error
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      console.log('Using OpenAI API key from environment variable due to database error');
      return process.env.OPENAI_API_KEY;
    }
    return null;
  }
};

// Methods for OpenAI Assistants API
exports.saveAssistantId = async (model, assistantId, enableBrowsing = false) => {
  try {
    // Create a composite key that includes browsing capability
    const modelKey = enableBrowsing ? `${model}:browsing` : model;
    
    await pool.query(
      `INSERT INTO threat_model.openai_assistants (model, assistant_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (model) DO UPDATE SET assistant_id = $2, created_at = NOW()`,
      [modelKey, assistantId]
    );
    console.log(`Saved assistant ID for model ${modelKey}: ${assistantId}`);
  } catch (error) {
    console.error(`Error saving assistant ID for model ${model} (browsing: ${enableBrowsing}):`, error);
  }
};

exports.saveThreadId = async (sessionId, threadId) => {
  try {
    await pool.query(
      `INSERT INTO threat_model.openai_threads (session_id, thread_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (session_id) DO UPDATE SET thread_id = $2, created_at = NOW()`,
      [sessionId, threadId]
    );
    console.log(`Saved thread ID for session ${sessionId}: ${threadId}`);
  } catch (error) {
    console.error(`Error saving thread ID for session ${sessionId}:`, error);
    throw error;
  }
};

exports.getAssistantId = async (model, enableBrowsing = false) => {
  try {
    // Create a composite key that includes browsing capability
    const modelKey = enableBrowsing ? `${model}:browsing` : model;
    
    const { rows } = await pool.query(
      `SELECT assistant_id FROM threat_model.openai_assistants WHERE model = $1 LIMIT 1`,
      [modelKey]
    );
    const assistantId = rows[0] ? rows[0].assistant_id : null;
    if (assistantId) {
      console.log(`Retrieved assistant ID for model ${modelKey}: ${assistantId}`);
    } else {
      console.log(`No assistant ID found for model ${modelKey}`);
    }
    return assistantId;
  } catch (error) {
    console.error(`Error getting assistant ID for model ${model} (browsing: ${enableBrowsing}):`, error);
    return null;
  }
};

exports.getThreadId = async (sessionId) => {
  try {
    const { rows } = await pool.query(
      `SELECT thread_id FROM threat_model.openai_threads WHERE session_id = $1 LIMIT 1`,
      [sessionId]
    );
    const threadId = rows[0] ? rows[0].thread_id : null;
    if (threadId) {
      console.log(`Retrieved thread ID for session ${sessionId}: ${threadId}`);
    } else {
      console.log(`No thread ID found for session ${sessionId}`);
    }
    return threadId;
  } catch (error) {
    console.error(`Error getting thread ID for session ${sessionId}:`, error);
    return null;
  }
};
