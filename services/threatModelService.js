/**
 * Threat Model Service
 * Handles persistence and retrieval of threat models from PostgreSQL database only
 */
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const logger = require('../logger');

/**
 * Creates a new threat model
 * @param {Object} data Threat model data
 * @param {string} data.title Title of the threat model
 * @param {string} data.description Description of the threat model
 * @param {string} data.subjectText The original subject text
 * @param {string} data.response The full response from LLM
 * @param {string} data.model The model used (e.g., gpt-3.5-turbo)
 * @param {string} data.username The user who created the model
 * @param {string} [data.projectId] Optional project ID to associate with
 * @returns {Promise<Object>} The created threat model with ID
 */
async function createThreatModel(data) {
  const { v4: uuidv4, validate: validateUuid } = require('uuid');
  try {
    console.log('Creating new threat model in PostgreSQL');

    // Generate UUID for the new model
    const id = uuidv4();

    // Validate projectId if provided
    let projectIdToSave = null;
    if (data.projectId) {
      if (typeof data.projectId === 'string' && validateUuid(data.projectId)) {
        projectIdToSave = data.projectId;
      } else {
        console.error('Invalid projectId format for threat model creation', {
          field: 'project_id',
          value: data.projectId,
          error: 'Not a valid UUID',
        });
        throw new Error('Invalid projectId: must be a valid UUID');
      }
    }

    // Insert into PostgreSQL
    const query = `
      INSERT INTO threat_model.threat_models (
        id, title, description, response_text, model, 
        created_by, project_id, source, llm_provider
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id,
      data.title,
      data.description || (data.subjectText ? data.subjectText.substring(0, 200) : null),
      data.response,
      data.model,
      data.username,
      projectIdToSave,
      'postgres',
      data.llmProvider || null
    ];

    console.debug('Attempting to insert threat model with values', {
      id,
      title: data.title,
      description: data.description,
      response: data.response,
      model: data.model,
      username: data.username,
      project_id: projectIdToSave,
      source: 'postgres',
      llmProvider: data.llmProvider
    });

    const result = await db.query(query, values);
    console.log(`Created new threat model in PostgreSQL with ID: ${id}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating threat model in PostgreSQL', {
      error: error,
      stack: error.stack,
      data,
      fields: {
        id: data && data.id,
        title: data && data.title,
        description: data && data.description,
        response: data && data.response,
        model: data && data.model,
        username: data && data.username,
        project_id: data && data.projectId
      },
      columns: [
        'id', 'title', 'description', 'response_text', 'model', 'created_by', 'project_id', 'source'
      ]
    });
    throw error;
  }
}

/**
 * Gets a threat model by ID, determining the source (Redis or PostgreSQL) automatically
 * @param {string} id The threat model ID (UUID or numeric Redis ID)
 * @returns {Promise<Object|null>} The threat model or null if not found
 */
async function getThreatModel(id) {
  // Only look up by UUID in PostgreSQL
  try {
    // Check if this ID looks like a UUID
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuidFormat) {
      console.log(`Looking up threat model with UUID: ${id} in PostgreSQL`);
      const query = 'SELECT * FROM threat_model.threat_models WHERE id = $1';
      const result = await db.query(query, [id]);
      if (result.rows.length > 0) {
        console.log(`Found threat model in PostgreSQL with ID: ${id}`);
        return {
          id: result.rows[0].id,
          title: result.rows[0].title,
          description: result.rows[0].description,
          responseText: result.rows[0].response_text,
          model: result.rows[0].model,
          createdBy: result.rows[0].created_by,
          source: 'postgres',
          pgRecord: result.rows[0] // Full DB record
        };
      }
    }
    console.log(`No threat model found for ID: ${id} in PostgreSQL`);
    return null;
  } catch (error) {
    console.error(`Error retrieving threat model with ID: ${id}`, error);
    throw error;
  }
}

/**
 * Lists all threat models (from PostgreSQL only)
 * @returns {Promise<Array>} Array of threat models
 */
async function listThreatModels(options = {}) {
  let result = [];
  try {
    console.log('Fetching threat models from PostgreSQL');
    const pgQuery = 'SELECT * FROM threat_model.threat_models ORDER BY created_at DESC';
    const pgResult = await db.query(pgQuery);
    const pgModels = pgResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      model: row.model,
      createdAt: row.created_at,
      source: 'postgres',
      pgRecord: row // The full DB record
    }));
    result = [...pgModels];
    console.log(`Found ${result.length} total threat models`);
    return result;
  } catch (error) {
    console.error('Error listing threat models', error);
    throw error;
  }
}

/**
 * Updates a threat model by ID with provided fields
 * @param {string} id - Threat model UUID
 * @param {Object} fields - Fields to update (e.g., { response_text: '...', status: 'Approved' })
 * @returns {Promise<Object>} The updated threat model row
 */
async function updateThreatModel(id, fields) {
  if (!id || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    throw new Error('updateThreatModel requires id and at least one field to update');
  }
  const setClauses = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  values.push(id);
  const query = `UPDATE threat_model.threat_models SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Threat model not found');
    }
    return result.rows[0];
  } catch (error) {
    console.error('Error updating threat model', error);
    throw error;
  }
}

/**
 * Retrieves the subject text for a threat model by its ID (UUID) from PostgreSQL.
 * If a dedicated subject_text column exists, use it. Otherwise, fallback to the description column.
 * @param {string} id - The UUID of the threat model
 * @returns {Promise<string|null>} The subject text or null if not found
 */
async function getSubjectText(id) {
  try {
    // Try to fetch subject_text, fallback to description if not present
    const query = `
      SELECT 
        CASE 
          WHEN subject_text IS NOT NULL AND subject_text != '' THEN subject_text
          ELSE description
        END AS subject_text
      FROM threat_model.threat_models
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      console.warn(`[getSubjectText] No threat model found for id: ${id}`);
      return null;
    }
    const subjectText = result.rows[0].subject_text;
    console.log(`[getSubjectText] Subject text for id ${id}: ${subjectText ? subjectText.substring(0, 80) : 'EMPTY'}`);
    return subjectText || null;
  } catch (error) {
    console.error(`[getSubjectText] Error retrieving subject text for id ${id}:`, error);
    throw error;
  }
}

module.exports = {
  createThreatModel,
  getThreatModel,
  listThreatModels,
  updateThreatModel,
  getSubjectText
};
