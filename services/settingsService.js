// services/settingsService.js
const db = require('../database'); // import your pg client wrapper

// Cache for settings to reduce database queries
let settingsCache = null;
let settingsCacheTime = null;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetch all settings as a key-value object with caching
 */
async function getAllSettings(useCache = true) {
  // Check if we should use the cache and if it's valid
  const now = Date.now();
  if (useCache && settingsCache && settingsCacheTime && (now - settingsCacheTime < SETTINGS_CACHE_TTL)) {
    return settingsCache;
  }

  // Cache miss or bypass - fetch from database
  const result = await db.query('SELECT key, value FROM threat_model.settings');
  const settings = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  
  // Update cache
  if (useCache) {
    settingsCache = settings;
    settingsCacheTime = now;
  }
  
  return settings;
}

/**
 * Clear the settings cache
 * Call this after settings are updated to ensure fresh data
 */
function clearSettingsCache() {
  settingsCache = null;
  settingsCacheTime = null;
}

async function updateSettings(settingsObj) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settingsObj)) {
      await client.query(
        `INSERT INTO threat_model.settings (key, value, value_type, updated_at)
         VALUES ($1, $2, 'string', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }
    await client.query('COMMIT');
    
    // Clear cache after updates
    clearSettingsCache();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update multiple settings in one transaction
 * @param {Object} settingsObj - key/value pairs to update
 * Insert or update a setting, bumping updated_at on conflict.
 */
async function storeSetting(key, value, description = null) {
  const valueType   = typeof value === 'object' ? 'json' : typeof value;
  const valueText   = valueType === 'json' ? JSON.stringify(value) : String(value);

  const sql = `
    INSERT INTO threat_model.settings
      (key, value, value_type, description)
    VALUES
      ($1, $2, $3, $4)
    ON CONFLICT (key) DO UPDATE
      SET value       = EXCLUDED.value,
          value_type  = EXCLUDED.value_type,
          description = EXCLUDED.description,
          updated_at  = NOW()
  `;
  console.log(`[storeSetting] About to run query for key=${key}, value=${valueText}`);
  try {
    const result = await db.query(sql, [key, valueText, valueType, description]);
    console.log(`[storeSetting] Query successful for key=${key}, rowCount=${result.rowCount}`);
    
    // Clear cache after updates
    clearSettingsCache();
  } catch (err) {
    console.error(`[storeSetting] Error running query for key=${key}:`, err);
    throw err;
  }
}

/**
 * Fetch a setting. If missing and createIfMissing=true, seed defaultValue.
 * Uses caching when possible.
 */
async function getSetting(key, defaultValue = null, createIfMissing = true) {
  try {
    // Try to get from cache first
    const settings = await getAllSettings();
    if (settings[key] !== undefined) {
      const value = settings[key];
      // Attempt to parse based on value type (simple detection)
      if (value === 'true' || value === 'false') {
        return value === 'true';
      } else if (!isNaN(value) && value !== '') {
        return Number(value);
      } else if (value.startsWith('{') || value.startsWith('[')) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      } else {
        return value;
      }
    }
    
    // If not in cache, get specific value type from database
    const res = await db.query(
      `SELECT value, value_type
         FROM threat_model.settings
        WHERE key = $1`,
      [key]
    );
    
    if (res.rows.length) {
      const { value, value_type } = res.rows[0];
      switch (value_type) {
        case 'number':  return Number(value);
        case 'boolean': return value === 'true';
        case 'json':    return JSON.parse(value);
        default:        return value;
      }
    }
    
    if (defaultValue !== null && createIfMissing) {
      await storeSetting(key, defaultValue);
      return defaultValue;
    }
    return defaultValue;
  } catch (err) {
    console.error(`getSetting error for key=${key}`, err);
    return defaultValue;
  }
}

async function getSettingByKey(key) {
  try {
    // Try to get from cache first
    const settings = await getAllSettings();
    if (settings[key] !== undefined) {
      return settings[key];
    }
    
    // Fall back to direct database query if not in cache
    const result = await db.query('SELECT value FROM threat_model.settings WHERE key = $1', [key]);
    return result.rows[0]?.value;
  } catch (err) {
    console.error(`getSettingByKey error for key=${key}`, err);
    return null;
  }
}

module.exports = {
  getAllSettings,
  storeSetting,
  getSetting,
  getSettingByKey,
  clearSettingsCache
};
