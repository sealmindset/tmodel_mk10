/**
 * OpenAI API Key Controller
 * 
 * Provides endpoints for managing and retrieving OpenAI API keys from PostgreSQL
 */

const express = require('express');
const router = express.Router();
const pool = require('../../db/db');






/**
 * @route GET /api/settings/openai-key-from-db
 * @desc Get OpenAI API key from PostgreSQL database
 */
router.get('/openai-key-from-db', async (req, res) => {
  try {
    // Query the database for the OpenAI API key
    const result = await pool.query(
      'SELECT api_key FROM api_keys WHERE provider = $1 ORDER BY created_at DESC LIMIT 1',
      ['openai']
    );

    if (result.rows.length > 0) {
      const apiKey = result.rows[0].api_key;
      console.log('Retrieved OpenAI API key from PostgreSQL database');
      res.json({ apiKey });
    } else {
      console.log('No OpenAI API key found in PostgreSQL database');
      res.status(404).json({ error: 'No API key found in database' });
    }
  } catch (error) {
    console.error('Error retrieving OpenAI API key from PostgreSQL:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * @route POST /api/settings/openai-key
 * @desc Save OpenAI API key to PostgreSQL database
 */
router.post('/openai-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Save to PostgreSQL
    await pool.query(
      'INSERT INTO api_keys (provider, api_key, created_at) VALUES ($1, $2, NOW())',
      ['openai', apiKey]
    );
    console.log('Saved new OpenAI API key');
    res.status(201).json({ message: 'API key saved successfully' });
  } catch (error) {
    console.error('Error saving OpenAI API key to PostgreSQL:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * @route GET /api/settings/openai-key-health
 * @desc Check the health of the OpenAI API key
 */
router.get('/openai-key-health', async (req, res) => {
  try {
    const openaiUtil = require('../../utils/openai');
    const healthCheck = await openaiUtil.verifyApiKey();
    
    res.json({
      ...healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking OpenAI API key health:', error);
    res.status(500).json({ 
      valid: false,
      source: 'error',
      message: `Error checking API key: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
