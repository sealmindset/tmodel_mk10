/**
 * PostgreSQL Pool Wrapper
 * 
 * This wrapper ensures safe handling of database connections and queries
 * to prevent common errors like passing objects instead of strings.
 */

const originalPool = require('./db');

// Create a wrapped version of the pool that adds error handling
const wrappedPool = {
  // Wrap the query method to add parameter validation
  query: async (text, params = []) => {
    // Basic validation of parameters
    if (typeof text !== 'string') {
      console.error('Invalid query: text must be a string');
      throw new Error('Invalid query: text must be a string');
    }
    
    // Ensure params is an array
    if (params && !Array.isArray(params)) {
      console.error('Invalid query params: must be an array');
      throw new Error('Invalid query params: must be an array');
    }
    
    // Log query for debugging
    console.log('Executing query', { 
      text,
      params: Array.isArray(params) ? params.map(p => 
        typeof p === 'object' && p !== null ? '[Object]' : p
      ) : params
    });
    
    try {
      // Execute the original query with validated parameters
      const result = await originalPool.query(text, params);
      
      // Log success for debugging
      console.log('Executed query', { 
        text,
        duration: result.duration,
        rows: result.rowCount || (result.rows ? result.rows.length : 0)
      });
      
      return result;
    } catch (error) {
      console.error('Query error:', error.message);
      throw error;
    }
  },
  
  // Pass through other methods directly to the original pool
  connect: async () => {
    try {
      const client = await originalPool.connect();
      console.log('Client connected to pool');
      
      // Wrap the client.query method to add error handling
      const originalQuery = client.query;
      client.query = async (text, params = []) => {
        // Basic validation of parameters
        if (typeof text !== 'string') {
          console.error('Invalid client query: text must be a string');
          client.release();
          throw new Error('Invalid client query: text must be a string');
        }
        
        try {
          const result = await originalQuery.call(client, text, params);
          return result;
        } catch (error) {
          console.error('Client query error:', error.message);
          throw error;
        }
      };
      
      // Wrap the release method
      const originalRelease = client.release;
      client.release = (err) => {
        originalRelease.call(client, err);
        console.log('Client released back to pool');
      };
      
      return client;
    } catch (error) {
      console.error('Error connecting to pool:', error.message);
      throw error;
    }
  },
  
  // Pass through the end method
  end: () => {
    console.log('Closing connection pool');
    return originalPool.end();
  }
};

module.exports = wrappedPool;
