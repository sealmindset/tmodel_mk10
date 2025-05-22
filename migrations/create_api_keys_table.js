/**
 * Migration: Create API Keys Table
 * 
 * This migration creates a table to store API keys for various providers
 * with proper encryption and versioning.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the project root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Log database connection details
console.log('Migration - Connecting to PostgreSQL database with the following settings:');
console.log(`Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
console.log(`Port: ${process.env.POSTGRES_PORT || 5432}`);
console.log(`Database: ${process.env.POSTGRES_DB || 'postgres'}`);

// Create a PostgreSQL connection pool using the same settings as the main app
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'postgres',
});

async function createApiKeysTable() {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'api_keys'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('Table api_keys already exists. Skipping creation.');
    } else {
      // Create the api_keys table
      await client.query(`
        CREATE TABLE api_keys (
          id SERIAL PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          api_key TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        );
        
        -- Add index on provider for faster lookups
        CREATE INDEX idx_api_keys_provider ON api_keys(provider);
        
        -- Add index on is_active to quickly find active keys
        CREATE INDEX idx_api_keys_active ON api_keys(is_active);
        
        -- Add comment to table
        COMMENT ON TABLE api_keys IS 'Stores API keys for various external services';
      `);
      
      console.log('Successfully created api_keys table');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error during migration:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}

// Run the migration
createApiKeysTable()
  .then(() => {
    console.log('Migration process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
