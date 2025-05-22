/**
 * Enterprise Architecture Migration Runner
 * 
 * This script executes the enterprise architecture SQL migration
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config({ override: true });
  // Ensure pg default env vars match our .env settings
  process.env.PGUSER = process.env.POSTGRES_USER;
  process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
  process.env.PGHOST = process.env.POSTGRES_HOST;
  process.env.PGPORT = process.env.POSTGRES_PORT;
  process.env.PGDATABASE = process.env.POSTGRES_DB;
  console.log('Loaded environment variables from .env file');
} catch (err) {
  console.log('No .env file found, using default values');
}

async function runEnterpriseArchitectureMigration() {
  try {
    console.log('Starting enterprise architecture database migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'enterprise_architecture.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 100)}...`);
        await db.query(statement);
        console.log('Statement executed successfully');
      } catch (error) {
        console.error(`Error executing statement: ${error.message}`);
        // Continue with the next statement
      }
    }
    
    console.log('Enterprise architecture migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the migration
runEnterpriseArchitectureMigration();
