/**
 * Database Migration Runner
 * Executes SQL migration files
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');

// Get migration file path from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Please provide a migration file path');
  process.exit(1);
}

const fullPath = path.resolve(migrationFile);

// Check if file exists
if (!fs.existsSync(fullPath)) {
  console.error(`Migration file not found: ${fullPath}`);
  process.exit(1);
}

// Read and execute the migration
async function runMigration() {
  try {
    console.log(`Running migration: ${fullPath}`);
    const sql = fs.readFileSync(fullPath, 'utf8');
    
    // Execute the migration in a transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Migration completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      client.release();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
