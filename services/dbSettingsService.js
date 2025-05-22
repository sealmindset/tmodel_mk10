// services/dbSettingsService.js
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.POSTGRES_HOST || 'localhost',
      port:     parseInt(process.env.POSTGRES_PORT,10) || 5432,
      database: process.env.POSTGRES_DB   || 'postgres',
      user:     process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || ''
    });
    console.log(`Created PG Pool → ${pool.options.host}:${pool.options.port}/${pool.options.database}`);
  }
  return pool;
}

async function getConnection() {
  return getPool();
}

async function checkPostgresStatus() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('Postgres health check succeeded');
    return true;
  } catch (err) {
    console.error('Postgres health check failed', err);
    return false;
  }
}

/**
 * Create (or return) the shared PG pool.
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.POSTGRES_HOST || 'localhost',
      port:     parseInt(process.env.POSTGRES_PORT,10) || 5432,
      database: process.env.POSTGRES_DB   || 'postgres',
      user:     process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || ''
    });
    console.log(`Created PG Pool → ${pool.options.host}:${pool.options.port}/${pool.options.database}`);
  }
  return pool;
}

/**
 * Return the pool (for query use).
 */
async function getConnection() {
  return getPool();
}

/**
 * Simple health check: returns true if SELECT 1 succeeds.
 */
async function checkPostgresStatus() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('Postgres health check succeeded');
    return true;
  } catch (err) {
    console.error('Postgres health check failed', err);
    return false;
  }
}

module.exports = {
  getConnection,
  checkPostgresStatus
};
