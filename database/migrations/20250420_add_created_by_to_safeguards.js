/**
 * Migration: Add created_by column to safeguards table
 * 
 * This migration adds the created_by column to the safeguards table
 */

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres'
});

async function up() {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Check if created_by column exists in safeguards table
    const columnCheckResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'threat_model' 
      AND table_name = 'safeguards' 
      AND column_name = 'created_by'
    `);

    // Add created_by column if it doesn't exist
    if (columnCheckResult.rows.length === 0) {
      console.log('Adding created_by column to safeguards table');
      await client.query(`
        ALTER TABLE threat_model.safeguards
        ADD COLUMN created_by VARCHAR(100)
      `);
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Remove created_by column from safeguards table
    await client.query(`
      ALTER TABLE threat_model.safeguards
      DROP COLUMN IF EXISTS created_by
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Rollback completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
