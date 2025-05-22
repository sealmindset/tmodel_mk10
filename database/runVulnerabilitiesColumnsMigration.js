/**
 * Vulnerabilities Table Columns Migration Runner
 * 
 * This script executes the migration to add the asset_id and other columns to the vulnerabilities table
 */
const { Pool } = require('pg');
require('dotenv').config({ override: true });

// Ensure pg default env vars match our .env settings
process.env.PGUSER = process.env.POSTGRES_USER;
process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
process.env.PGHOST = process.env.POSTGRES_HOST;
process.env.PGPORT = process.env.POSTGRES_PORT;
process.env.PGDATABASE = process.env.POSTGRES_DB;

console.log('Loaded environment variables from .env file');

// Import the migration
const migration = require('./migrations/20250420_add_asset_id_to_vulnerabilities');

async function runMigration() {
  console.log('Starting vulnerabilities table columns migration...');
  
  try {
    // Run the up migration
    await migration.up();
    console.log('Vulnerabilities table columns migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the migration
runMigration();
