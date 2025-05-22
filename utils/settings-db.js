/**
 * Settings Database Utility
 * Provides functions to interact with settings stored in PostgreSQL
 */
const dbSettingsService = require('../services/dbSettingsService');
const logger = require('../utils/logger').forModule('settings-db');

    // Insert or update the setting
    await pool.query(
      `INSERT INTO threat_model.settings (key, value, value_type, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE
       SET value = $2, value_type = $3, description = $4, updated_at = NOW()`,
      [key, valueToStore, valueType, description]
    );
    
    logger.debug(`Successfully stored setting in PostgreSQL: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Error storing setting in PostgreSQL: ${key}`, error);
    // Return false to indicate failure, but don't throw to maintain application flow
    return false;
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (poolError) {
        logger.error('Error closing database pool', poolError);
      }
    }
  }
}

module.exports = {
  getSetting,
  storeSetting
};
