/**
 * Threat Model Merge Service V2
 * 
 * Provides functionality to merge multiple threat models into one
 * Handles PostgreSQL models
 */
const pool = require('../database').pool;


/**
 * Merge multiple threat models into a primary model
 * 
 * @param {string} primaryModelId - ID of the primary model to merge into
 * @param {Array<string>} sourceModelIds - IDs of the models to merge from
 * @param {string} mergedBy - Username of the person performing the merge
 * @returns {Promise<Object>} - Updated primary model with merged threats
 */
async function mergeThreatModels(primaryModelId, sourceModelIds, mergedBy) {
  console.log('Starting merge operation with:', { primaryModelId, sourceModelIds, mergedBy });
  
  if (!primaryModelId || !sourceModelIds || !Array.isArray(sourceModelIds) || sourceModelIds.length === 0) {
    throw new Error('Primary model ID and at least one source model ID are required');
  }

  // Filter out the primary model from source models if it's included
  sourceModelIds = sourceModelIds.filter(id => id !== primaryModelId);
  
  if (sourceModelIds.length === 0) {
    throw new Error('At least one source model different from the primary model is required');
  }

  // Track metrics for the merge operation
  const mergeMetrics = {
    total_threats_added: 0,
    total_threats_skipped: 0,
    total_safeguards_added: 0,
    source_models_processed: 0,

    model_details: []
  };

  let primaryModel = null;
  let existingThreats = [];

  // Process primary PostgreSQL model
  await handlePostgresPrimaryModel(primaryModelId, mergeMetrics);

  // Process source PostgreSQL models
  for (const sourceId of sourceModelIds) {
    await processPostgresSourceModel(sourceId, primaryModelId, existingThreats, mergeMetrics);
  }

  // Update primary model metadata
  await updatePostgresPrimaryModelMetadata(primaryModelId, sourceModelIds, mergedBy, mergeMetrics);

  return {
    model: primaryModel,
    metrics: mergeMetrics
  };
}

/**
 * Handle PostgreSQL primary model initialization
 */
async function handlePostgresPrimaryModel(modelId, metrics) {
  console.log(`Processing PostgreSQL primary model: ${modelId}`);
  
  let modelResult, threatsResult;
  const client = await pool.connect();
  try {
    // Get model details
    const modelQuery = `SELECT * FROM threat_model.threat_models WHERE id = $1`;
    modelResult = await client.query(modelQuery, [modelId]);
    if (modelResult.rows.length === 0) {
      throw new Error(`Primary PostgreSQL threat model with ID ${modelId} not found`);
    }
    primaryModel = modelResult.rows[0];
    // Get existing threats
    const threatsQuery = `SELECT * FROM threat_model.threats WHERE threat_model_id = $1`;
    threatsResult = await client.query(threatsQuery, [modelId]);
    existingThreats = threatsResult.rows;
    console.log(`Found ${existingThreats.length} existing threats in PostgreSQL model ${modelId}`);
  } catch (error) {
    // If there's an error with the UUID format, provide a clearer message
    if (error.code === '22P02') { // invalid input syntax for type uuid
      throw new Error(`Invalid PostgreSQL model ID format: ${modelId}`);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Process a PostgreSQL source model
 */
async function processPostgresSourceModel(modelId, primaryModelId, existingThreats, metrics) {
  console.log(`Processing PostgreSQL source model: ${modelId}`);
  
  const client = await pool.connect();
  try {
    // Get model details
    const modelQuery = `SELECT * FROM threat_model.threat_models WHERE id = $1`;
    let model;
    
    try {
      const modelResult = await client.query(modelQuery, [modelId]);
      
      if (modelResult.rows.length === 0) {
        console.log(`Source PostgreSQL model ${modelId} not found, skipping`);
        return;
      }
      
      model = modelResult.rows[0];
    } catch (error) {
      // If there's an error with the UUID format, provide a clearer message and skip
      if (error.code === '22P02') { // invalid input syntax for type uuid
        console.log(`Invalid PostgreSQL model ID format: ${modelId}. Skipping this model.`);
        return;
      }
      throw error;
    }
    
    // Add model to metrics
    const threatCountQuery = `SELECT COUNT(*) as count FROM threat_model.threats WHERE threat_model_id = $1`;
    const threatCountResult = await client.query(threatCountQuery, [modelId]);
    const threatCount = parseInt(threatCountResult.rows[0].count, 10) || 0;
    
    metrics.model_details.push({
      id: modelId,
      name: model.name,
      type: 'postgresql',
      total_threats: threatCount,
      threats_added: 0,
      threats_skipped: 0
    });
    
    // Get threats from source model
    const threatsQuery = `SELECT * FROM threat_model.threats WHERE threat_model_id = $1`;
    const threatsResult = await client.query(threatsQuery, [modelId]);
    const threats = threatsResult.rows;
    
    console.log(`Found ${threats.length} threats in PostgreSQL model ${modelId}`);
    
    // Process each threat
    for (const threat of threats) {
      // Check if this threat is similar to any existing threats
      const isSimilar = checkIfThreatIsSimilar(threat, existingThreats);
      
      if (!isSimilar) {
        // Add to PostgreSQL primary model
        await addThreatToPostgresModel(threat, primaryModelId, modelId, model.name, metrics);
        
        // Update metrics
        metrics.total_threats_added++;
        const modelDetail = metrics.model_details.find(m => m.id === modelId);
        if (modelDetail) {
          modelDetail.threats_added++;
        }
      } else {
        // Skip duplicate threat
        console.log(`Skipping duplicate threat: ${threat.title}`);
        metrics.total_threats_skipped++;
        const modelDetail = metrics.model_details.find(m => m.id === modelId);
        if (modelDetail) {
          modelDetail.threats_skipped++;
        }
      }
    }
    
    metrics.source_models_processed++;
  } finally {
    client.release();
  }
}

/**
 * Add a threat to a PostgreSQL model
 */
async function addThreatToPostgresModel(threat, primaryModelId, sourceModelId, sourceModelName, metrics) {
  console.log(`Adding threat to PostgreSQL model ${primaryModelId}: ${threat.threat}`);
  
  const client = await pool.connect();
  try {
    const insertQuery = `
      INSERT INTO threat_model.threats (
        threat_model_id, title, description, mitigation, risk_score,
        impact, likelihood, source_model_id, source_model_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    
    const result = await client.query(insertQuery, [
      primaryModelId,
      threat.threat,
      threat.description,
      threat.mitigation,
      calculateRiskScore(threat.description),
      3, // Default impact
      3, // Default likelihood
      sourceModelId,
      sourceModelName
    ]);
    console.log(`Added threat to PostgreSQL model ${primaryModelId} with ID ${result.rows[0].id}`);
    
    // Add to existing threats to prevent duplicates
    existingThreats.push({
      id: result.rows[0].id,
      title: threat.threat,
      description: threat.description,
      mitigation: threat.mitigation,
      threat_model_id: primaryModelId
    });
  } finally {
    client.release();
  }
}
/**
 * Update PostgreSQL primary model metadata
 */
async function updatePostgresPrimaryModelMetadata(modelId, sourceModelIds, mergedBy, metrics) {
  console.log(`Updating PostgreSQL model ${modelId} metadata`);
  
  const client = await pool.connect();
  try {
    // Store merge metadata
    const mergeMetadata = {
      merged_at: new Date().toISOString(),
      merged_by: mergedBy,
      source_models: sourceModelIds,
      metrics: metrics
    };
    
    const updateQuery = `
      UPDATE threat_model.threat_models
      SET 
        updated_at = CURRENT_TIMESTAMP,
        model_version = (CAST(model_version AS NUMERIC) + 0.1)::TEXT,
        status = 'Draft',
        merge_metadata = $2
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [modelId, JSON.stringify(mergeMetadata)]);
    primaryModel = result.rows[0];
    
    console.log(`Updated PostgreSQL model ${modelId} metadata`);
    
    return primaryModel;
  } finally {
    client.release();
  }
      const mergeMetadata = {
        merged_at: new Date().toISOString(),
        merged_by: mergedBy,
        source_models: sourceModelIds,
        metrics: metrics
      };
      
      const updateQuery = `
        UPDATE threat_model.threat_models
        SET 
          updated_at = CURRENT_TIMESTAMP,
          model_version = (CAST(model_version AS NUMERIC) + 0.1)::TEXT,
          status = 'Draft',
          merge_metadata = $2
        WHERE id = $1
        RETURNING *
      `;
}

/**
 * Check if a threat is similar to any existing threats
 * 
 * @param {Object} threat - Threat to check
 * @param {Array<Object>} existingThreats - Existing threats to compare against
 * @returns {boolean} - True if similar threat exists, false otherwise
 */
function checkIfThreatIsSimilar(threat, existingThreats) {
  if (!existingThreats || existingThreats.length === 0) {
    return false;
  }
  
  // Get title and description from threat object based on its format
  const title = threat.title || threat.threat || '';
  const description = threat.description || '';
  
  // Check for exact title match
  const exactTitleMatch = existingThreats.some(existingThreat => {
    const existingTitle = existingThreat.title || existingThreat.threat || '';
    return existingTitle.toLowerCase() === title.toLowerCase();
  });
  
  if (exactTitleMatch) {
    return true;
  }
  
  // Check for high similarity in title or description
  return existingThreats.some(existingThreat => {
    const existingTitle = existingThreat.title || existingThreat.threat || '';
    const existingDescription = existingThreat.description || '';
    
    // Check title similarity (if titles are at least 70% similar)
    if (existingTitle && title && calculateSimilarity(existingTitle, title) > 0.7) {
      return true;
    }
    
    // Check description similarity (if descriptions are at least 80% similar)
    if (existingDescription && description && calculateSimilarity(existingDescription, description) > 0.8) {
      return true;
    }
    
    return false;
  });
  
  // Simple similarity calculation (Jaccard index)
  function calculateSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\W+/).filter(Boolean));
    const set2 = new Set(str2.toLowerCase().split(/\W+/).filter(Boolean));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
}

/**
 * Extract threats from a response text
 * 
 * @param {string} responseText - Response text
 * @returns {Array<Object>} - Array of threats
 */
function extractThreatsFromResponse(responseText) {
  if (!responseText) return [];
  
  const threats = [];
  
  // Different patterns to match threats in different formats
  const patterns = [
    // Pattern 1: Format with ## Threat: and **Description:** / **Mitigation:**
    {
      regex: /## Threat:([^#]+)##\s*\*\*Description:\*\*([^*]+)\*\*Mitigation:\*\*([^#]*)/g,
      extract: (match) => {
        return {
          threat: match[1].trim(),
          description: match[2].trim(),
          mitigation: match[3].trim()
        };
      }
    },
    // Pattern 2: Format with ## as headers and Description/Mitigation as text
    {
      regex: /## ([^#\n]+)\n\n([^#]+)/g,
      extract: (match) => {
        const title = match[1].trim();
        const content = match[2].trim();
        let description = content;
        let mitigation = '';
        
        const mitigationMatch = content.match(/Mitigation:([\s\S]*)/i);
        if (mitigationMatch) {
          mitigation = mitigationMatch[1].trim();
          description = content.replace(/Mitigation:[\s\S]*/i, '').trim();
        }
        
        return {
          threat: title,
          description: description,
          mitigation: mitigation
        };
      }
    },
    // Pattern 3: Format with just ## as headers for each threat
    {
      regex: /## ([^#\n]+)([\s\S]*?)(?=## |$)/g,
      extract: (match) => {
        const title = match[1].trim();
        const content = match[2].trim();
        
        // Skip headers like "Overview", "Introduction", etc.
        if (['Overview', 'Introduction', 'Summary', 'Conclusion', 'Background'].includes(title)) {
          return null;
        }
        
        let description = content;
        let mitigation = '';
        
        const mitigationMatch = content.match(/Mitigation:([\s\S]*)/i);
        if (mitigationMatch) {
          mitigation = mitigationMatch[1].trim();
          description = content.replace(/Mitigation:[\s\S]*/i, '').trim();
        }
        
        return {
          threat: title,
          description: description,
          mitigation: mitigation
        };
      }
    },
    // Pattern 4: Format with numbered threats
    {
      regex: /\d+\.\s+([^\n]+)([\s\S]*?)(?=\d+\.|$)/g,
      extract: (match) => {
        const title = match[1].trim();
        const content = match[2].trim();
        
        if (content.length < 10) return null; // Skip if content is too short
        
        let description = content;
        let mitigation = '';
        
        const mitigationMatch = content.match(/Mitigation:([\s\S]*)/i);
        if (mitigationMatch) {
          mitigation = mitigationMatch[1].trim();
          description = content.replace(/Mitigation:[\s\S]*/i, '').trim();
        }
        
        return {
          threat: title,
          description: description,
          mitigation: mitigation
        };
      }
    }
  ];
  
  // Try each pattern until we find threats
  for (const pattern of patterns) {
    let match;
    pattern.regex.lastIndex = 0; // Reset regex state
    
    while ((match = pattern.regex.exec(responseText)) !== null) {
      const threat = pattern.extract(match);
      if (threat) {
        threats.push(threat);
      }
    }
    
    // If we found threats with this pattern, stop trying other patterns
    if (threats.length > 0) {
      break;
    }
  }
  
  return threats;
}

/**
 * Calculate a risk score based on threat description
 * 
 * @param {string} description - Threat description
 * @returns {number} - Risk score (1-100)
 */
function calculateRiskScore(description) {
  // Default medium risk
  let baseScore = 50;
  
  if (!description) return baseScore;
  
  // Keywords that indicate higher risk
  const highRiskKeywords = [
    'critical', 'severe', 'high', 'dangerous', 'significant', 'major', 
    'sensitive data', 'personal data', 'financial', 'authentication',
    'bypass', 'privilege', 'escalation', 'remote', 'execution', 'injection',
    'unauthorized', 'access', 'disclosure', 'breach', 'compromise'
  ];
  
  // Keywords that indicate lower risk
  const lowRiskKeywords = [
    'low', 'minor', 'minimal', 'limited', 'small', 'unlikely', 'rare',
    'informational', 'disclosure', 'non-sensitive', 'public', 'temporary'
  ];
  
  // Check for high risk keywords
  for (const keyword of highRiskKeywords) {
    if (description.toLowerCase().includes(keyword)) {
      baseScore += 5; // Increase score for each high risk keyword
    }
  }
  
  // Check for low risk keywords
  for (const keyword of lowRiskKeywords) {
    if (description.toLowerCase().includes(keyword)) {
      baseScore -= 5; // Decrease score for each low risk keyword
    }
  }
  
  // Ensure score is within range
  return Math.max(1, Math.min(100, baseScore));
}

module.exports = {
  mergeThreatModels
};
