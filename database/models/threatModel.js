/**
 * Threat Model Document Model
 * 
 * Provides data access methods for threat model documents in the database
 */
const db = require('../index');
const Threat = require('./threat');

class ThreatModel {
  /**
   * Create a new threat model document
   * 
   * @param {Object} modelData - Threat model data
   * @returns {Promise<Object>} - Created threat model
   */
  static async create(modelData) {
    const { 
      project_id,
      name, 
      description, 
      model_version = '1.0',
      status = 'Draft',
      created_by 
    } = modelData;
    
    const query = `
      INSERT INTO threat_model.threat_models 
        (project_id, name, description, model_version, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      project_id,
      name, 
      description, 
      model_version,
      status,
      created_by
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get threat model by ID
   * 
   * @param {string} id - Threat model ID
   * @returns {Promise<Object>} - Threat model data with threats
   */
  static async getById(id) {
    const query = `
      SELECT tm.*, p.name as project_name 
      FROM threat_model.threat_models tm
      JOIN threat_model.projects p ON tm.project_id = p.id
      WHERE tm.id = $1
    `;
    
    const result = await db.query(query, [id]);
    if (!result.rows.length) return null;
    
    const threatModel = result.rows[0];
    
    // Get threats for this model
    const threats = await Threat.getAll({ threat_model_id: id });
    threatModel.threats = threats;
    
    return threatModel;
  }
  
  /**
   * Get all threat models
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of threat models
   */
  static async getAll(filters = {}) {
    const { project_id, status } = filters;
    
    let query = `
      SELECT tm.*, p.name as project_name,
        COUNT(t.id)::integer as threat_count,
        COALESCE(AVG(t.risk_score), 0)::integer as avg_risk_score
      FROM threat_model.threat_models tm
      JOIN threat_model.projects p ON tm.project_id = p.id
      LEFT JOIN threat_model.threats t ON tm.id = t.threat_model_id
    `;
    
    const values = [];
    
    // Add filters if provided
    const conditions = [];
    if (project_id) {
      conditions.push(`tm.project_id = $${values.length + 1}`);
      values.push(project_id);
    }
    
    if (status) {
      conditions.push(`tm.status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY tm.id, p.name';
    query += ' ORDER BY tm.created_at DESC';
    
    const result = await db.query(query, values);
    return result.rows;
  }
  
  /**
   * Update a threat model
   * 
   * @param {string} id - Threat model ID
   * @param {Object} modelData - Threat model data to update
   * @returns {Promise<Object>} - Updated threat model
   */
  static async update(id, modelData) {
    const { 
      name, 
      description, 
      model_version,
      status,
      reviewed_by,
      reviewed_at,
      review_notes
    } = modelData;
    
    const query = `
      UPDATE threat_model.threat_models
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        model_version = COALESCE($3, model_version),
        status = COALESCE($4, status),
        reviewed_by = COALESCE($5, reviewed_by),
        reviewed_at = COALESCE($6, reviewed_at),
        review_notes = COALESCE($7, review_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    
    const values = [
      name, 
      description, 
      model_version,
      status,
      reviewed_by,
      reviewed_at,
      review_notes,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Delete a threat model
   * 
   * @param {string} id - Threat model ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(id) {
    return db.transaction(async (client) => {
      // First delete all threats associated with this model
      const deleteThreatsQuery = 'DELETE FROM threat_model.threats WHERE threat_model_id = $1';
      await client.query(deleteThreatsQuery, [id]);
      
      // Then delete the model itself
      const deleteModelQuery = 'DELETE FROM threat_model.threat_models WHERE id = $1';
      const result = await client.query(deleteModelQuery, [id]);
      
      return result.rowCount > 0;
    });
  }
  
  /**
   * Clone a threat model
   * 
   * @param {string} id - Threat model ID to clone
   * @param {Object} newData - Override data for the new model
   * @returns {Promise<Object>} - Cloned threat model
   */
  static async clone(id, newData = {}) {
    return db.transaction(async (client) => {
      // Get original threat model
      const getModelQuery = 'SELECT * FROM threat_model.threat_models WHERE id = $1';
      const modelResult = await client.query(getModelQuery, [id]);
      
      if (!modelResult.rows.length) {
        throw new Error('Threat model not found');
      }
      
      const original = modelResult.rows[0];
      
      // Create new threat model
      const cloneModelQuery = `
        INSERT INTO threat_model.threat_models 
          (project_id, name, description, model_version, status, created_by)
        VALUES ($1, $2, $3, $4, 'Draft', $5)
        RETURNING *
      `;
      
      const cloneModelValues = [
        newData.project_id || original.project_id,
        newData.name || `${original.name} (Clone)`,
        newData.description || original.description,
        newData.model_version || `${original.model_version}-clone`,
        newData.created_by || original.created_by
      ];
      
      const clonedModel = await client.query(cloneModelQuery, cloneModelValues);
      const newModelId = clonedModel.rows[0].id;
      
      // Get original threats
      const getThreatsQuery = 'SELECT * FROM threat_model.threats WHERE threat_model_id = $1';
      const threatsResult = await client.query(getThreatsQuery, [id]);
      
      // Clone each threat
      for (const threat of threatsResult.rows) {
        const cloneThreatQuery = `
          INSERT INTO threat_model.threats 
            (threat_model_id, name, description, category, likelihood, 
             impact, risk_score, status, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;
        
        const cloneThreatValues = [
          newModelId,
          threat.name,
          threat.description,
          threat.category,
          threat.likelihood,
          threat.impact,
          threat.risk_score,
          threat.status,
          newData.created_by || threat.created_by
        ];
        
        const clonedThreat = await client.query(cloneThreatQuery, cloneThreatValues);
        const newThreatId = clonedThreat.rows[0].id;
        
        // Clone threat safeguards
        const getSafeguardsQuery = `
          SELECT * FROM threat_model.threat_safeguards 
          WHERE threat_id = $1
        `;
        
        const safeguardsResult = await client.query(getSafeguardsQuery, [threat.id]);
        
        for (const safeguard of safeguardsResult.rows) {
          const cloneSafeguardQuery = `
            INSERT INTO threat_model.threat_safeguards 
              (threat_id, safeguard_id, effectiveness, notes)
            VALUES ($1, $2, $3, $4)
          `;
          
          await client.query(cloneSafeguardQuery, [
            newThreatId,
            safeguard.safeguard_id,
            safeguard.effectiveness,
            safeguard.notes
          ]);
        }
      }
      
      return clonedModel.rows[0];
    });
  }
  
  /**
   * Generate a new version of a threat model
   * 
   * @param {string} id - Threat model ID
   * @returns {Promise<Object>} - New version of threat model
   */
  static async newVersion(id) {
    // Similar to clone, but specifically for versioning
    const originalModel = await this.getById(id);
    
    if (!originalModel) {
      throw new Error('Threat model not found');
    }
    
    // Determine next version number
    const currentVersion = originalModel.model_version;
    let nextVersion;
    
    if (currentVersion.includes('.')) {
      const parts = currentVersion.split('.');
      const major = parseInt(parts[0]);
      const minor = parseInt(parts[1]) + 1;
      nextVersion = `${major}.${minor}`;
    } else {
      nextVersion = `${parseInt(currentVersion) + 1}.0`;
    }
    
    // Clone with new version number
    return this.clone(id, {
      name: originalModel.name,
      description: originalModel.description,
      model_version: nextVersion,
      created_by: originalModel.created_by
    });
  }
  
  /**
   * Export threat model to JSON format
   * 
   * @param {string} id - Threat model ID
   * @returns {Promise<Object>} - Complete threat model as JSON
   */
  static async exportToJson(id) {
    const threatModel = await this.getById(id);
    
    if (!threatModel) {
      throw new Error('Threat model not found');
    }
    
    // Get project details
    const projectQuery = 'SELECT * FROM threat_model.projects WHERE id = $1';
    const projectResult = await db.query(projectQuery, [threatModel.project_id]);
    const project = projectResult.rows[0];
    
    // Get all components in the project
    const componentsQuery = `
      SELECT * FROM threat_model.components
      WHERE id IN (
        SELECT component_id FROM threat_model.project_components
        WHERE project_id = $1
      )
    `;
    
    const componentsResult = await db.query(componentsQuery, [threatModel.project_id]);
    const components = componentsResult.rows;
    
    // For each threat, get safeguards
    const threats = await Promise.all(threatModel.threats.map(async (threat) => {
      const safeguards = await Threat.getSafeguards(threat.id);
      const vulnerabilities = await Threat.getVulnerabilities(threat.id);
      
      return {
        ...threat,
        safeguards,
        vulnerabilities
      };
    }));
    
    // Build final export object
    const exportData = {
      meta: {
        exported_at: new Date().toISOString(),
        version: threatModel.model_version
      },
      threat_model: {
        id: threatModel.id,
        name: threatModel.name,
        description: threatModel.description,
        version: threatModel.model_version,
        status: threatModel.status,
        created_at: threatModel.created_at,
        created_by: threatModel.created_by,
        reviewed_by: threatModel.reviewed_by,
        reviewed_at: threatModel.reviewed_at,
        review_notes: threatModel.review_notes
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        business_unit: project.business_unit,
        criticality: project.criticality,
        data_classification: project.data_classification
      },
      components: components,
      threats: threats
    };
    return exportData;
  }
  
  /**
   * Export multiple threat models to JSON keyed by title (no IDs in output)
   * @param {Array<string>} ids - Array of threat model IDs
   * @returns {Promise<Object>} - Object keyed by model title
   */
  static async exportManyToJson(ids) {
    console.log(`Starting batch export for ${ids.length} threat models...`);
    const exportObj = {};
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        console.log(`Processing export for threat model ID: ${id}`);
        const modelExport = await this.exportToJson(id);
        
        if (!modelExport) {
          console.error(`Export failed for threat model ID: ${id} - No export data returned`);
          errorCount++;
          continue;
        }
        
        if (!modelExport.threat_model) {
          console.error(`Export failed for threat model ID: ${id} - Invalid export format, missing threat_model property`);
          errorCount++;
          continue;
        }
        
        successCount++;
      // Remove IDs from model, project, threats, components
      const { threat_model, project, components, threats, ...rest } = modelExport;
      // Omit id fields
      const cleanThreatModel = { ...threat_model };
      delete cleanThreatModel.id;
      delete cleanThreatModel.created_by;
      delete cleanThreatModel.reviewed_by;
      // Remove IDs from project
      const cleanProject = { ...project };
      delete cleanProject.id;
      // Remove IDs from components
      const cleanComponents = (components || []).map(c => {
        const { id, project_id, ...rest } = c;
        return rest;
      });
      // Remove IDs from threats and nested safeguards/vulnerabilities
      const cleanThreats = (threats || []).map(t => {
        const { id, threat_model_id, ...rest } = t;
        // Clean nested safeguards
        const cleanSafeguards = (t.safeguards || []).map(sg => {
          const { id, threat_id, ...sgRest } = sg;
          return sgRest;
        });
        // Clean nested vulnerabilities
        const cleanVulns = (t.vulnerabilities || []).map(v => {
          const { id, threat_id, ...vRest } = v;
          return vRest;
        });
        return { ...rest, safeguards: cleanSafeguards, vulnerabilities: cleanVulns };
      });
      // Compose cleaned export object
      // Generate a unique key for this model
      let modelKey = cleanThreatModel.name;
      
      // Handle duplicate model names by adding a suffix
      if (exportObj[modelKey]) {
        let counter = 1;
        while (exportObj[`${modelKey}_${counter}`]) {
          counter++;
        }
        modelKey = `${modelKey}_${counter}`;
        console.log(`Handling duplicate model name by using key: ${modelKey}`);
      }
      
      exportObj[modelKey] = {
        meta: modelExport.meta,
        threat_model: cleanThreatModel,
        project: cleanProject,
        components: cleanComponents,
        threats: cleanThreats
      };
      
      } catch (error) {
        console.error(`Error processing export for threat model ID: ${id}`, error);
        errorCount++;
      }
    }
    
    console.log(`Batch export completed: ${successCount} successful, ${errorCount} failed`);
    
    if (Object.keys(exportObj).length === 0) {
      throw new Error(`Failed to export any threat models: processed ${ids.length} IDs but none were exported successfully`);
    }
    
    return exportObj;
  }
  
  // Get threat metrics
  static async getMetrics(id) {
    const riskMetrics = await Threat.calculateRiskMetrics(id);
    const riskMatrix = await Threat.generateRiskMatrix(id);
    
    // Get safeguard coverage
    const safeguardQuery = `
      SELECT 
        COUNT(DISTINCT ts.safeguard_id)::integer as total_safeguards,
        COUNT(DISTINCT t.id)::integer as total_threats,
        COUNT(DISTINCT CASE WHEN ts.safeguard_id IS NOT NULL THEN t.id END)::integer as threats_with_safeguards,
        ROUND(AVG(ts.effectiveness))::integer as avg_safeguard_effectiveness
      FROM threat_model.threats t
      LEFT JOIN threat_model.threat_safeguards ts ON t.id = ts.threat_id
      WHERE t.threat_model_id = $1
    `;
    
    const safeguardResult = await db.query(safeguardQuery, [id]);
    const safeguardMetrics = safeguardResult.rows[0];
    
    // Calculate safeguard coverage percentage
    if (safeguardMetrics.total_threats > 0) {
      safeguardMetrics.coverage_percentage = Math.round(
        (safeguardMetrics.threats_with_safeguards / safeguardMetrics.total_threats) * 100
      );
    } else {
      safeguardMetrics.coverage_percentage = 0;
    }
    
    return {
      risk: riskMetrics,
      matrix: riskMatrix,
      safeguards: safeguardMetrics,
      last_updated: new Date().toISOString()
    };
  }
}

module.exports = ThreatModel;
