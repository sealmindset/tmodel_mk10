/**
 * Migration: Add asset_id column to vulnerabilities table
 * 
 * This migration adds the asset_id column to the vulnerabilities table
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

    // Check if asset_id column exists in vulnerabilities table
    const columnCheckResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'threat_model' 
      AND table_name = 'vulnerabilities' 
      AND column_name = 'asset_id'
    `);

    // Add asset_id column if it doesn't exist
    if (columnCheckResult.rows.length === 0) {
      console.log('Adding asset_id column to vulnerabilities table');
      await client.query(`
        ALTER TABLE threat_model.vulnerabilities
        ADD COLUMN asset_id VARCHAR(100)
      `);
    }

    // Check if technical_details column exists in vulnerabilities table
    const technicalDetailsCheckResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'threat_model' 
      AND table_name = 'vulnerabilities' 
      AND column_name = 'technical_details'
    `);

    // Add technical_details column if it doesn't exist
    if (technicalDetailsCheckResult.rows.length === 0) {
      console.log('Adding technical_details column to vulnerabilities table');
      await client.query(`
        ALTER TABLE threat_model.vulnerabilities
        ADD COLUMN technical_details TEXT
      `);
    }

    // Check if remediation_steps column exists in vulnerabilities table
    const remediationStepsCheckResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'threat_model' 
      AND table_name = 'vulnerabilities' 
      AND column_name = 'remediation_steps'
    `);

    // Add remediation_steps column if it doesn't exist
    if (remediationStepsCheckResult.rows.length === 0) {
      console.log('Adding remediation_steps column to vulnerabilities table');
      await client.query(`
        ALTER TABLE threat_model.vulnerabilities
        ADD COLUMN remediation_steps TEXT
      `);
    }

    // Create index on asset_id for better query performance
    console.log('Creating index on asset_id column');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vulnerabilities_asset_id ON threat_model.vulnerabilities(asset_id)
    `);

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

    // Drop index on asset_id
    await client.query(`
      DROP INDEX IF EXISTS threat_model.idx_vulnerabilities_asset_id
    `);

    // Remove asset_id column from vulnerabilities table
    await client.query(`
      ALTER TABLE threat_model.vulnerabilities
      DROP COLUMN IF EXISTS asset_id
    `);

    // Remove technical_details column from vulnerabilities table
    await client.query(`
      ALTER TABLE threat_model.vulnerabilities
      DROP COLUMN IF EXISTS technical_details
    `);

    // Remove remediation_steps column from vulnerabilities table
    await client.query(`
      ALTER TABLE threat_model.vulnerabilities
      DROP COLUMN IF EXISTS remediation_steps
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
