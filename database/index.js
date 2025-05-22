/**
 * PostgreSQL Database Configuration
 * 
 * This module provides database connection and utility functions
 * for the Threat Model Generator Mk7.
 */
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from environment variables
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Get database configuration from environment variables
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'postgres', // Use the standard postgres database by default
  // Only use SSL in production
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false // Required for some cloud providers
    }
  })
};

// Create a connection pool
const pool = new Pool(dbConfig);

// Log database connection attempts
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database:', dbConfig.database);
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Execute a query with parameters
 * 
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Error executing query', { text, error });
    throw error;
  }
};

/**
 * Get a client from the pool
 * 
 * @returns {Promise} - Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const originalRelease = client.release;
  
  // Monkey patch the release method to log duration
  client.release = () => {
    console.log('Client released back to pool');
    originalRelease.apply(client);
  };
  
  return client;
};

/**
 * Execute a transaction
 * 
 * @param {Function} callback - Transaction callback function that receives a client
 * @returns {Promise} - Transaction result
 */
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Initialize the database
 * 
 * @returns {Promise} - Database initialization result
 */
const initDatabase = async () => {
  try {
    // Read the SQL initialization file
    const fs = require('fs');
    const path = require('path');
    const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    
    // Execute the initialization SQL
    await query(initSql, []);
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
};

// Export database functionality
module.exports = {
  query,
  getClient,
  transaction,
  initDatabase,
  pool
};
