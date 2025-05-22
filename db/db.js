// PostgreSQL connection pool for Mark 7
const { Pool } = require('pg');

// Use environment variables with fallbacks for database connection
console.log('Connecting to PostgreSQL database with the following settings:');
console.log(`Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
console.log(`Port: ${process.env.POSTGRES_PORT || 5432}`);
console.log(`Database: ${process.env.POSTGRES_DB || 'postgres'}`);

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'postgres'
});

module.exports = pool;
