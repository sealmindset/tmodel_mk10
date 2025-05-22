/**
 * Rapid7 Integration Service
 * 
 * This service handles communication with the Rapid7 InsightVM API
 * to fetch vulnerabilities and scan information.
 */
const axios = require('axios');
const db = require('../db/db');
const settingsService = require('./settingsService');

const logger = require('../utils/logger').forModule('rapid7Service');

// Cache for Rapid7 settings and connection validation
let rapid7SettingsCache = null;
let rapid7CacheTime = null;
let connectionValidCache = null;
let connectionValidCacheTime = null;
const RAPID7_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get Rapid7 settings with caching to reduce database queries
 */
async function getCachedRapid7Settings() {
  try {
    const now = Date.now();
    
    // Return cached settings if valid
    if (rapid7SettingsCache && rapid7CacheTime && (now - rapid7CacheTime < RAPID7_CACHE_TTL)) {
      // Don't log every time to reduce console noise
      return rapid7SettingsCache;
    }
    
    // Cache miss - fetch ALL settings from database in one query
    console.log('Fetching Rapid7 settings (cache miss) - will cache for 5 minutes');
    
    // Get all settings at once - much more efficient than individual queries
    const allSettings = await settingsService.getAllSettings();
    
    // Extract the Rapid7 settings we need
    const apiUrl = allSettings['rapid7.api_url'] || process.env.RAPID7_API_URL || '';
    const apiKey = allSettings['rapid7.api_key'] || process.env.RAPID7_API_KEY || '';
    
    // Update cache
    rapid7SettingsCache = { apiUrl, apiKey };
    rapid7CacheTime = now;
    
    return rapid7SettingsCache;
  } catch (error) {
    console.error('Error getting cached Rapid7 settings:', error);
    
    // Fallback to environment variables if settings service fails
    return {
      apiUrl: process.env.RAPID7_API_URL || '',
      apiKey: process.env.RAPID7_API_KEY || ''
    };
  }
}

// Helper functions for storing scan data and vulnerabilities
async function saveVulnerability(vulnData) {
  try {
    const query = `
      INSERT INTO threat_model.vulnerabilities 
        (external_id, title, description, severity, cvss_score, 
         status, remediation, asset_id, asset_name, first_found, last_found)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (external_id) 
      DO UPDATE SET 
        title = $2, 
        description = $3, 
        severity = $4, 
        cvss_score = $5, 
        status = $6, 
        remediation = $7,
        asset_id = $8,
        asset_name = $9,
        last_found = $11,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`;

    const result = await db.query(query, [
      vulnData.id, // external_id
      vulnData.title, 
      vulnData.description || '',
      vulnData.severity,
      vulnData.cvss_score, 
      'Open',  // default status
      vulnData.remediation || '',
      vulnData.asset_id,
      vulnData.asset_name || '',
      new Date(), // first_found 
      new Date()  // last_found
    ]);

    return result.rows[0].id;
  } catch (error) {
    console.error(`Error saving vulnerability ${vulnData.id}:`, error);
    throw error;
  }
}

async function updateScanHistory(scanId, status, vulnCount = 0) {
  try {
    const query = `
      UPDATE threat_model.scan_history 
      SET status = $1, 
          total_vulnerabilities = $2,
          end_time = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE scan_id = $4
      RETURNING id`;

    const result = await db.query(query, [
      status,
      vulnCount,
      status === 'Completed' ? new Date() : null,
      scanId
    ]);

    return result.rows[0];
  } catch (error) {
    console.error(`Error updating scan history for ${scanId}:`, error);
    throw error;
  }
}

class Rapid7Service {
  constructor() {
    this.refreshClient();
  }
  
  /**
   * Initialize the service with the provided settings
   * @param {Object} settings - Settings object
   * @param {string} settings.apiUrl - API URL
   * @param {string} settings.apiKey - API key
   */
  init(settings = {}) {
    if (settings.apiUrl) {
      this.apiUrl = settings.apiUrl;
      this.baseUrl = settings.apiUrl;
      
      // Remove trailing slash from baseUrl if present
      if (this.baseUrl.endsWith('/')) {
        this.baseUrl = this.baseUrl.slice(0, -1);
      }
      
      console.log('Initialized Rapid7 service with API URL:', this.apiUrl);
    }
    
    if (settings.apiKey) {
      this.apiKey = settings.apiKey;
      console.log('Initialized Rapid7 service with API key, length:', this.apiKey.length);
    }
    
    // Configure axios client with updated settings
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get Rapid7 settings from cache - exposed for other modules to use
   * @returns {Promise<{apiUrl: string, apiKey: string}>} The cached settings
   */
  async getCachedSettings() {
    return getCachedRapid7Settings();
  }

  /**
   * Refresh the API client with latest settings from cache or database
   */
  async refreshClient() {
    try {
      // Use our caching function to get settings
      const settings = await getCachedRapid7Settings();
      
      // Set baseUrl and apiKey from cached settings with fallbacks
      this.baseUrl = settings.apiUrl || 'https://us.api.insight.rapid7.com';
      this.apiUrl = this.baseUrl;
      this.apiKey = settings.apiKey || '';
      
      // Configure axios client
      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      console.log('Rapid7 client refreshed', { baseUrl: this.baseUrl });
      return true;
    } catch (error) {
      console.error('Error refreshing Rapid7 client', null, error);
      return false;
    }
  }

  /**
   * Check connection to Rapid7 API
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async checkConnection() {
    try {
      const now = Date.now();
      
      // Check if we already validated the connection recently
      // Only validate connections every 5 minutes to avoid excessive API calls
      if (connectionValidCache !== null && connectionValidCacheTime && (now - connectionValidCacheTime < RAPID7_CACHE_TTL)) {
        // Use cached connection validation result
        return connectionValidCache;
      }

      // Get settings without forcing a refresh - use cache if available
      await this.refreshClient();
      
      // Early exit if credentials are missing
      if (!this.apiUrl) {
        console.warn('Rapid7 API URL is empty');
        connectionValidCache = false;
        connectionValidCacheTime = now;
        return false;
      }
      
      if (!this.apiKey) {
        console.warn('Rapid7 API key is empty');
        connectionValidCache = false;
        connectionValidCacheTime = now;
        return false;
      }
      
      // Only log on cache misses to reduce console noise
      console.log(`Validating Rapid7 API connection (cache miss) - will cache for 5 minutes`);
      
      // Mask API key for logging
      let maskedKey = 'HIDDEN';
      if (this.apiKey && this.apiKey.length > 8) {
        maskedKey = this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      }
      console.log(`Using API key: ${maskedKey}`);
      
      // Format the URL properly
      const axios = require('axios');
      try {
        console.debug('Sending Rapid7 validation request', { url: validationUrl });
        
        // Use exactly the same approach as the working curl command
        const response = await axios({
          method: 'GET',
          url: validationUrl,
          headers: {
            'X-Api-Key': this.apiKey,
            'Accept': 'application/json'
          },
          timeout: 30000, // 30 seconds timeout for slow connections
          validateStatus: () => true, // Don't throw on any status code
          maxRedirects: 5 // Allow redirects
        });
        
        console.debug('Rapid7 validation response received', { 
          status: response.status,
          statusText: response.statusText,
          dataReceived: !!response.data
        });
        
        // Check if the response is valid
        if (response.status >= 200 && response.status < 300) {
          console.log('Rapid7 connection validated successfully');
          // Cache the successful validation result
          connectionValidCache = true;
          connectionValidCacheTime = now;
          return true;
        } else {
          console.error('Rapid7 validation failed', { 
            status: response.status,
            statusText: response.statusText,
            data: response.data
          });
          
          // Try to extract a meaningful error message
          let errorMessage = 'Connection failed. Check your API URL and key.';
          
          // Add more details if available
          if (response.data && response.data.message) {
            errorMessage = response.data.message;
          } else if (response.statusText) {
            errorMessage = response.statusText;
          }
          
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Error validating Rapid7 connection', { message: error.message }, error);
        
        let errorMessage = 'Connection failed. Check your API URL and key.';
        
        // Add more details if available
        if (error.response) {
          errorMessage = `API responded with status ${error.response.status}. Check your API key.`;
        } else if (error.code) {
          errorMessage = `Network error: ${error.code}. Check your API URL.`;
        }
        
        console.error('Rapid7 connection validation error', { errorMessage });
        
        // Cache the failed validation result
        connectionValidCache = false;
        connectionValidCacheTime = now;
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Rapid7 connectivity check failed', { message: error.message }, error);
      
      // Cache the failed validation result
      connectionValidCache = false;
      connectionValidCacheTime = now;
      
      throw error;
    }
  }
  
  async mapAssetsToComponents(assets, componentMatcher) {
    const results = {
      mapped: 0,
      unmapped: 0,
      mappings: []
    };
    
    for (const asset of assets) {
      // Use the provided matcher function to find a matching component
      const component = await componentMatcher(asset);
      
      if (component) {
        results.mapped++;
        results.mappings.push({
          asset_id: asset.id,
          asset_hostname: asset.hostName,
          component_id: component.id,
          component_name: component.name
        });
      } else {
        results.unmapped++;
      }
    }
    
    return results;
  }
}

module.exports = new Rapid7Service();
