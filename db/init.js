/**
 * Database Initialization Script
 * 
 * This script connects to PostgreSQL and initializes the database schema
 * for the Threat Model Generator with Rapid7 integration.
 */
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Read schema SQL file
const schemaFilePath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL. Initializing database schema...');
    
    // First create the database if it doesn't exist
    try {
      await client.query('CREATE DATABASE tmodel;');
      console.log('Database "tmodel" created successfully');
    } catch (err) {
      if (err.code === '42P04') { // Database already exists error code
        console.log('Database "tmodel" already exists, continuing...');
      } else {
        console.error('Error creating database:', err);
      }
    }
    
    // Create schema if it doesn't exist
    await client.query('CREATE SCHEMA IF NOT EXISTS threat_model;');
    
    // Check if the projects table exists and has all required columns
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'threat_model' AND table_name = 'projects'
      );
    `);
    
    const projectsTableExists = tableCheck.rows[0].exists;
    
    if (projectsTableExists) {
      // Check if all columns exist
      console.log('Projects table exists, checking for required columns...');
      
      // Check for business_unit column
      const businessUnitCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'threat_model' AND table_name = 'projects' AND column_name = 'business_unit'
        );
      `);
      
      if (!businessUnitCheck.rows[0].exists) {
        console.log('Adding business_unit column to projects table');
        await client.query('ALTER TABLE threat_model.projects ADD COLUMN business_unit VARCHAR(100);');
      }
      
      // Check for criticality column
      const criticalityCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'threat_model' AND table_name = 'projects' AND column_name = 'criticality'
        );
      `);
      
      if (!criticalityCheck.rows[0].exists) {
        console.log('Adding criticality column to projects table');
        await client.query(`ALTER TABLE threat_model.projects ADD COLUMN criticality VARCHAR(50) DEFAULT 'Medium';`);
      }
      
      // Check for data_classification column
      const dataClassCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'threat_model' AND table_name = 'projects' AND column_name = 'data_classification'
        );
      `);
      
      if (!dataClassCheck.rows[0].exists) {
        console.log('Adding data_classification column to projects table');
        await client.query(`ALTER TABLE threat_model.projects ADD COLUMN data_classification VARCHAR(50) DEFAULT 'Confidential';`);
      }
      
      // Check for status column
      const statusCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'threat_model' AND table_name = 'projects' AND column_name = 'status'
        );
      `);
      
      if (!statusCheck.rows[0].exists) {
        console.log('Adding status column to projects table');
        await client.query(`ALTER TABLE threat_model.projects ADD COLUMN status VARCHAR(50) DEFAULT 'Active';`);
      }
    }
    
    // Now execute the rest of the schema SQL for other tables
    await client.query(schemaSql);
    console.log('Database schema initialized successfully');
    
    // Insert a default project if needed
    const projectCheck = await client.query('SELECT COUNT(*) FROM threat_model.projects');
    if (parseInt(projectCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO threat_model.projects (name, description, business_unit, criticality, status) 
        VALUES ('Default Project', 'Default project for vulnerabilities', 'Engineering', 'Medium', 'Active')
      `);
      console.log('Created a default project');
    }
    
    console.log('Database setup completed successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('Database initialization complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
