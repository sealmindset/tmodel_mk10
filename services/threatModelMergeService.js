/**
 * Threat Model Merge Service
 * 
 * Provides functionality to merge multiple threat models into one
 */
const db = require('../database');
const pool = require('../database').pool;

const ThreatModel = require('../database/models/threatModel');

/**
 * Merge multiple threat models into a primary model
 * 
 * @param {string} primaryModelId - ID of the primary model to merge into
 * @param {Array<string>} sourceModelIds - IDs of the models to merge from
 * @param {string} mergedBy - Username of the person performing the merge
 * @returns {Promise<Object>} - Updated primary model with merged threats
 */
async function mergeThreatModels(primaryModelId, sourceModelIds, mergedBy) {
  if (!primaryModelId || !sourceModelIds || !Array.isArray(sourceModelIds) || sourceModelIds.length === 0) {
    throw new Error('Primary model ID and at least one source model ID are required');
  }

  // Filter out the primary model from source models if it's included
  sourceModelIds = sourceModelIds.filter(id => id !== primaryModelId);
  
  if (sourceModelIds.length === 0) {
    throw new Error('At least one source model different from the primary model is required');
  }

  const dbClient = await pool.connect();
  
  try {
    await dbClient.query('BEGIN');
    
    // Check if primary model exists in PostgreSQL
    let primaryModel;
    const primaryModelQuery = `
      SELECT * FROM threat_model.threat_models WHERE id = $1
    `;
    try {
      const primaryModelResult = await dbClient.query(primaryModelQuery, [primaryModelId]);
      if (primaryModelResult.rows.length === 0) {
        throw new Error(`Primary threat model with ID ${primaryModelId} not found`);
      }
      primaryModel = primaryModelResult.rows[0];
    } catch (error) {
      // If there's an error with the UUID format, provide a clearer message
      if (error.code === '22P02') { // invalid input syntax for type uuid
        throw new Error(`Invalid PostgreSQL model ID format: ${primaryModelId}.`);
      }
      throw error;
    }
    
    console.log(`Using PostgreSQL model as primary: ${primaryModel.name || primaryModel.title} (ID: ${primaryModel.id})`);
    // Only PostgreSQL models are supported
    const pgModelIds = sourceModelIds;

    // Get existing threats in the primary model
    let existingThreats = [];
    
    // For PostgreSQL models, get threats from the database
    const existingThreatsQuery = `
      SELECT * FROM threat_model.threats WHERE threat_model_id = $1
    `;
    const existingThreatsResult = await dbClient.query(existingThreatsQuery, [primaryModelId]);
    existingThreats = existingThreatsResult.rows;
    
    // Track metrics for the merge operation
    const mergeMetrics = {
      total_threats_added: 0,
      total_threats_skipped: 0, // Count of duplicate threats that were skipped
      total_safeguards_added: 0,
      source_models_processed: 0,
      model_details: [] // Details for each processed model
    };
    
    // Process PostgreSQL models
    if (pgModelIds.length > 0) {
      // Get threats from source models
      const sourceThreatsQuery = `
        SELECT t.*, tm.name as model_name 
        FROM threat_model.threats t
        JOIN threat_model.threat_models tm ON t.threat_model_id = tm.id
        WHERE t.threat_model_id = ANY($1::uuid[])
      `;
      const sourceThreatsResult = await dbClient.query(sourceThreatsQuery, [pgModelIds]);
      const sourceThreats = sourceThreatsResult.rows;
      
      // Merge threats into primary model
      for (const threat of sourceThreats) {
        // Check if a similar threat already exists in the primary model
        const similarThreat = existingThreats.find(t => 
          t.title.toLowerCase() === threat.title.toLowerCase() ||
          t.description.toLowerCase().includes(threat.description.toLowerCase()) ||
          threat.description.toLowerCase().includes(t.description.toLowerCase())
        );
        
        if (!similarThreat) {
          // Add this threat to the primary model
          const insertThreatQuery = `
            INSERT INTO threat_model.threats (
              threat_model_id, title, description, impact, likelihood, 
              risk_score, mitigation, source_model_id, source_model_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `;
          
          const threatValues = [
            primaryModelId,
            threat.title,
            threat.description,
            threat.impact,
            threat.likelihood,
            threat.risk_score,
            threat.mitigation,
            threat.threat_model_id,
            threat.model_name
          ];
          
          const newThreatResult = await dbClient.query(insertThreatQuery, threatValues);
          const newThreatId = newThreatResult.rows[0].id;
          
          // Get safeguards for this threat
          const safeguardsQuery = `
            SELECT s.* FROM threat_model.safeguards s
            JOIN threat_model.threat_safeguards ts ON s.id = ts.safeguard_id
            WHERE ts.threat_id = $1
          `;
          const safeguardsResult = await dbClient.query(safeguardsQuery, [threat.id]);
          const safeguards = safeguardsResult.rows;
          
          // Add safeguards to the new threat
          for (const safeguard of safeguards) {
            // Check if safeguard already exists
            const existingSafeguardQuery = `
              SELECT id FROM threat_model.safeguards 
              WHERE title = $1 AND threat_model_id = $2
            `;
            const existingSafeguardResult = await dbClient.query(existingSafeguardQuery, [
              safeguard.title, primaryModelId
            ]);
            
            let safeguardId;
            
            if (existingSafeguardResult.rows.length > 0) {
              // Use existing safeguard
              safeguardId = existingSafeguardResult.rows[0].id;
            } else {
              // Create new safeguard
              const insertSafeguardQuery = `
                INSERT INTO threat_model.safeguards (
                  threat_model_id, title, description, type, status
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
              `;
              
              const safeguardValues = [
                primaryModelId,
                safeguard.title,
                safeguard.description,
                safeguard.type,
                safeguard.status
              ];
              
              const newSafeguardResult = await dbClient.query(insertSafeguardQuery, safeguardValues);
              safeguardId = newSafeguardResult.rows[0].id;
              mergeMetrics.total_safeguards_added++;
            }
            
            // Link safeguard to threat
            const linkSafeguardQuery = `
              INSERT INTO threat_model.threat_safeguards (
                threat_id, safeguard_id, effectiveness
              )
              VALUES ($1, $2, $3)
            `;
            
            await dbClient.query(linkSafeguardQuery, [
              newThreatId, 
              safeguardId, 
              safeguard.effectiveness || 50
            ]);
          }
          
          mergeMetrics.total_threats_added++;
        } else {
          mergeMetrics.total_threats_skipped++;
        }
      }
      
      mergeMetrics.source_models_processed = pgModelIds.length;
      
      // Add model details for each processed PostgreSQL model
      for (const modelId of pgModelIds) {
        const modelDetailsQuery = `
          SELECT id, name, threat_count::integer as threat_count
          FROM threat_model.threat_models 
          WHERE id = $1
        `;
        const modelDetailsResult = await dbClient.query(modelDetailsQuery, [modelId]);
        
        if (modelDetailsResult.rows.length > 0) {
          const modelDetails = modelDetailsResult.rows[0];
          mergeMetrics.model_details.push({
            id: modelDetails.id,
            name: modelDetails.name,
            type: 'postgresql',
            total_threats: modelDetails.threat_count || 0,
            threats_added: 0,
            threats_skipped: 0
          });
        }
      }
    }
    
    // Update the primary model metadata
    const updateModelQuery = `
      UPDATE threat_model.threat_models
      SET 
        updated_at = CURRENT_TIMESTAMP,
        model_version = (CAST(model_version AS NUMERIC) + 0.1)::TEXT,
        status = 'Draft',
        merge_metadata = $2
      WHERE id = $1
      RETURNING *
    `;
    const mergeMetadata = {
      merged_at: new Date().toISOString(),
      merged_by: mergedBy,
      source_models: {
        postgres: pgModelIds
      },
      metrics: mergeMetrics
    };
    const updatedModelResult = await dbClient.query(updateModelQuery, [
      primaryModelId, 
      JSON.stringify(mergeMetadata)
    ]);
    const updatedModel = updatedModelResult.rows[0];
    await dbClient.query('COMMIT');
    return {
      model: updatedModel,
      metrics: mergeMetrics
    };

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error merging threat models:', error);
    throw error;
  } finally {
    dbClient.release();
  }
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
