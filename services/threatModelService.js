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

/**
 * Merges selected threats from a source model into a target model
 * @param {string} targetId The target threat model ID to merge threats into
 * @param {Array} sourceThreats Array of threat objects to merge
 * @returns {Promise<Object>} Result with addedThreats and skippedThreats arrays
 */
async function mergeSelectedThreats(targetId, sourceThreats) {
  if (!targetId || !Array.isArray(sourceThreats)) {
    throw new Error('Invalid parameters: targetId and sourceThreats array required');
  }

  try {
    // Get the target model
    const targetModel = await getThreatModel(targetId);
    if (!targetModel) {
      throw new Error(`Target model not found: ${targetId}`);
    }

    // Parse the existing threats from the response text
    const existingThreats = parseThreatsFromResponse(targetModel.responseText);
    logger.info(`Found ${existingThreats.length} existing threats in target model ${targetId}`);

    // Arrays to track merge results
    const addedThreats = [];
    const skippedThreats = [];

    // Process each source threat
    for (const sourceThreat of sourceThreats) {
      // Check if this threat already exists in the target model
      const isDuplicate = checkDuplicateThreat(existingThreats, sourceThreat);
      
      if (isDuplicate) {
        skippedThreats.push(sourceThreat);
        continue;
      }

      // Add the threat to the target model
      addedThreats.push(sourceThreat);
    }

    // If we have threats to add, update the model
    if (addedThreats.length > 0) {
      // Append the new threats to the response text
      const updatedResponseText = appendThreatsToResponse(targetModel.responseText, addedThreats);

      // Update the model in the database
      await updateThreatModel(targetId, {
        response_text: updatedResponseText,
        merged_at: new Date(),
        merged_threats_count: existingThreats.length + addedThreats.length
      });

      logger.info(`Successfully merged ${addedThreats.length} threats into model ${targetId}`);
    } else {
      logger.info(`No new threats to merge into model ${targetId}`);
    }

    return {
      addedThreats,
      skippedThreats
    };
  } catch (error) {
    logger.error(`Error merging selected threats into model ${targetId}:`, error);
    throw error;
  }
}

/**
 * Parse threats from response text
 * @param {string} responseText The response text containing threat information
 * @returns {Array} Array of parsed threat objects
 */
function parseThreatsFromResponse(responseText) {
  if (!responseText) return [];
  
  const threats = [];

  // Primary parser: headings like '## Threat: <title>' or '### Threat: <title>'
  // Capture the title from the heading line and include the full block until the next Threat heading
  const headerBlockRe = /^(?:#{2,3})\s*Threat:\s*(.+?)\s*#*\s*$\n?([\s\S]*?)(?=^(?:#{2,3})\s*Threat:|\Z)/gmi;
  let m;
  while ((m = headerBlockRe.exec(responseText)) !== null) {
    const title = (m[1] || '').trim();
    const body = (m[2] || '').trim();
    if (!title) continue;
    const fullContent = `## Threat: ${title}\n\n${body}`.trim();
    threats.push({ title, description: '', content: fullContent });
  }

  // Backward compatibility: legacy blocks where title was inside '**Title:**'
  if (threats.length === 0) {
    const legacyRe = /### Threat: ([\s\S]*?)(?=### Threat:|$)/g;
    let match;
    while ((match = legacyRe.exec(responseText)) !== null) {
      const threatText = match[1].trim();
      const titleMatch = threatText.match(/\*\*Title:\*\*\s?(.+?)(?:\n|$)/);
      const descriptionMatch = threatText.match(/\*\*Description:\*\*\s?(.+?)(?:\n|$)/);
      if (titleMatch) {
        threats.push({
          title: titleMatch[1].trim(),
          description: descriptionMatch ? descriptionMatch[1].trim() : '',
          content: match[0]
        });
      }
    }
  }

  return threats;
}

/**
 * Check if a threat is a duplicate of any in the existing threats
 * @param {Array} existingThreats Array of existing threat objects
 * @param {Object} newThreat The new threat object to check
 * @returns {boolean} True if the threat is a duplicate
 */
function checkDuplicateThreat(existingThreats, newThreat) {
  if (!newThreat || !newThreat.title) return true; // Skip if no title
  
  const newTitle = newThreat.title.toLowerCase().trim();
  
  return existingThreats.some(threat => {
    if (!threat.title) return false;
    const existingTitle = threat.title.toLowerCase().trim();
    
    // Consider it a duplicate if titles are similar
    return existingTitle === newTitle || 
           existingTitle.includes(newTitle) || 
           newTitle.includes(existingTitle);
  });
}

/**
 * Append new threats to the response text
 * @param {string} responseText The original response text
 * @param {Array} newThreats Array of new threat objects to append
 * @returns {string} Updated response text with new threats
 */
function appendThreatsToResponse(responseText, newThreats) {
  if (!newThreats || newThreats.length === 0) return responseText;
  
  let updatedText = responseText;
  
  // Check if we need to add a threats section header
  if (!responseText.includes('## Threat Model')) {
    updatedText += '\n\n## Threat Model\n';
  }
  
  // Add each new threat
  for (const threat of newThreats) {
    if (threat.title) {
      updatedText += '\n\n### Threat: ' + threat.title;
      
      if (threat.description) {
        updatedText += '\n**Description:** ' + threat.description;
      }
    } else if (threat.content) {
      // If we have the full content, just append it
      updatedText += '\n\n' + threat.content;
    }
  }
  
  return updatedText;
}

module.exports = {
  createThreatModel,
  getThreatModel,
  listThreatModels,
  updateThreatModel,
  getSubjectText,
  mergeSelectedThreats,
  // Exported to support RAG ingestion without duplicating parsing logic
  parseThreatsFromResponse
};
