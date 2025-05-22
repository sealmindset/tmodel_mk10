/**
 * Project Model
 * 
 * Provides data access methods for projects in the database
 */
const db = require('../index');

class Project {
  /**
   * Create a new project
   * 
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} - Created project
   */
  static async create(projectData) {
    const { name, description, business_unit, criticality, data_classification, created_by } = projectData;
    // Accept status from projectData, default to 'Active' if not provided
    const status = projectData.status || 'Active';
    const query = `
      INSERT INTO threat_model.projects 
        (name, description, business_unit, criticality, data_classification, status, created_by, last_updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *
    `;
    const values = [name, description, business_unit, criticality, data_classification, status, created_by];
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get project by ID
   * 
   * @param {string} id - Project ID
   * @returns {Promise<Object>} - Project data
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.projects WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
  
  /**
   * Get all projects
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of projects
   */
  static async getAll(filters = {}) {
    const { business_unit, status } = filters;
    let query = 'SELECT * FROM threat_model.projects';
    const values = [];
    
    // Add filters if provided
    const conditions = [];
    if (business_unit) {
      conditions.push(`business_unit = $${values.length + 1}`);
      values.push(business_unit);
    }
    
    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const result = await db.query(query, values);
    return result.rows;
  }
  
  /**
   * Update a project
   * 
   * @param {string} id - Project ID
   * @param {Object} projectData - Project data to update
   * @returns {Promise<Object>} - Updated project
   */
  static async update(id, projectData) {
    const { name, description, business_unit, criticality, data_classification, status, last_updated_by } = projectData;
    
    const query = `
      UPDATE threat_model.projects
      SET 
        name = $1,
        description = $2,
        business_unit = $3,
        criticality = $4,
        data_classification = $5,
        status = $6,
        last_updated_by = $7
      WHERE id = $8
      RETURNING *
    `;
    
    const values = [
      name, 
      description, 
      business_unit, 
      criticality, 
      data_classification, 
      status, 
      last_updated_by,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Delete a project
   * 
   * @param {string} id - Project ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async delete(id) {
    // Use a transaction to ensure all related records are deleted properly
    return db.transaction(async (client) => {
      try {
        // First, delete all related records in dependent tables
        
        // 1. Delete project-component associations
        await client.query('DELETE FROM threat_model.project_components WHERE project_id = $1', [id]);
        
        // 2. Delete threat models and their related threats
        // First get threat model IDs for this project
        const threatModelResult = await client.query(
          'SELECT id FROM threat_model.threat_models WHERE project_id = $1', 
          [id]
        );
        
        // Delete threats for each threat model
        if (threatModelResult.rows.length > 0) {
          const threatModelIds = threatModelResult.rows.map(row => row.id);
          // Use ANY to delete threats for all threat models at once
          await client.query(
            'DELETE FROM threat_model.threats WHERE threat_model_id = ANY($1)', 
            [threatModelIds]
          );
          
          // Now delete the threat models themselves
          await client.query('DELETE FROM threat_model.threat_models WHERE project_id = $1', [id]);
        }
        
        // 4. Delete the project itself
        const projectResult = await client.query('DELETE FROM threat_model.projects WHERE id = $1', [id]);
        
        return projectResult.rowCount > 0;
      } catch (error) {
        console.error('Error in transaction during project deletion:', error);
        // Re-throw the error to trigger a rollback
        throw error;
      }
    });
  }
  
  /**
   * Create a new component
   * 
   * @param {Object} componentData - Component data
   * @returns {Promise<Object>} - Created component
   */
  static async createComponent(componentData) {
    const { name, hostname, ip_address, type } = componentData;
    
    const query = `
      INSERT INTO threat_model.components 
        (name, hostname, ip_address, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [name, hostname, ip_address, type];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get component by ID
   * 
   * @param {string} id - Component ID
   * @returns {Promise<Object>} - Component data
   */
  static async getComponentById(id) {
    const query = 'SELECT * FROM threat_model.components WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Update a component
   * 
   * @param {string} id - Component ID
   * @param {Object} componentData - Component data to update
   * @returns {Promise<Object>} - Updated component
   */
  static async updateComponent(id, componentData) {
    const { name, hostname, ip_address, type, has_threat_model, threat_model_id } = componentData;
    
    const query = `
      UPDATE threat_model.components
      SET 
        name = $1,
        hostname = $2,
        ip_address = $3,
        type = $4,
        has_threat_model = $5,
        threat_model_id = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;
    
    const values = [
      name, 
      hostname, 
      ip_address, 
      type, 
      has_threat_model || false, 
      threat_model_id,
      id
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete a component
   * 
   * @param {string} id - Component ID
   * @returns {Promise<boolean>} - True if deleted
   */
  static async deleteComponent(id) {
    const query = 'DELETE FROM threat_model.components WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Get project components
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Project components
   */
  static async getComponents(projectId) {
    const query = `
      SELECT c.* 
      FROM threat_model.components c
      JOIN threat_model.project_components pc ON c.id = pc.component_id
      WHERE pc.project_id = $1
      ORDER BY c.name
    `;
    
    const result = await db.query(query, [projectId]);
    return result.rows;
  }
  
  /**
   * Add a component to a project
   * 
   * @param {string} projectId - Project ID
   * @param {string} componentId - Component ID
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} - Junction record
   */
  static async addComponentToProject(projectId, componentId, notes = '') {
    const query = `
      INSERT INTO threat_model.project_components
        (project_id, component_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, component_id) DO UPDATE
      SET notes = $3
      RETURNING *
    `;
    
    const values = [projectId, componentId, notes];
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Remove a component from a project
   * 
   * @param {string} projectId - Project ID
   * @param {string} componentId - Component ID
   * @returns {Promise<boolean>} - True if removed
   */
  static async removeComponentFromProject(projectId, componentId) {
    const query = `
      DELETE FROM threat_model.project_components
      WHERE project_id = $1 AND component_id = $2
    `;
    
    const result = await db.query(query, [projectId, componentId]);
    return result.rowCount > 0;
  }
  static async addComponent(projectId, componentId, notes = null) {
    const query = `
      INSERT INTO threat_model.project_components (project_id, component_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, component_id) 
      DO UPDATE SET notes = $3
      RETURNING *
    `;
    
    const result = await db.query(query, [projectId, componentId, notes]);
    return result.rows[0];
  }
  
  /**
   * Remove a component from a project
   * 
   * @param {string} projectId - Project ID
   * @param {string} componentId - Component ID
   * @returns {Promise<boolean>} - True if removed
   */
  static async removeComponent(projectId, componentId) {
    const query = `
      DELETE FROM threat_model.project_components 
      WHERE project_id = $1 AND component_id = $2
    `;
    
    const result = await db.query(query, [projectId, componentId]);
    return result.rowCount > 0;
  }
  
  /**
   * Get security incidents for a project
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Project security incidents
   */
  static async getSecurityIncidents(projectId) {
    const query = `
      SELECT * FROM threat_model.security_incidents
      WHERE project_id = $1
      ORDER BY detected_at DESC
    `;
    
    const result = await db.query(query, [projectId]);
    return result.rows;
  }
  
  /**
   * Get threat models assigned to a project
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Project's threat models
   */
  static async getThreatModels(projectId) {
    const query = `
      SELECT tm.*
      FROM threat_model.threat_models tm
      JOIN threat_model.project_threat_models ptm ON tm.id = ptm.threat_model_id
      WHERE ptm.project_id = $1
      ORDER BY tm.created_at DESC
    `;
    
    console.log(`[PROJECT-MODEL] Fetching threat models for project ${projectId}`);
    const result = await db.query(query, [projectId]);
    console.log(`[PROJECT-MODEL] Found ${result.rows.length} threat models for project ${projectId}`);
    return result.rows;
  }

  /**
   * Get project statistics
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} - Project statistics
   */
  static async getStatistics(projectId) {
    // Use a transaction to ensure consistency
    return db.transaction(async (client) => {
      // Count components
      const componentsQuery = `
        SELECT COUNT(*)::int as component_count
        FROM threat_model.project_components
        WHERE project_id = $1
      `;
      const componentsResult = await client.query(componentsQuery, [projectId]);
      
      // Count threat models
      const threatModelsQuery = `
        SELECT COUNT(*)::int as threat_model_count
        FROM threat_model.threat_models
        WHERE project_id = $1
      `;
      const threatModelsResult = await client.query(threatModelsQuery, [projectId]);
      
      // Count threats by status
      const threatsQuery = `
        SELECT 
          t.status,
          COUNT(*)::int as count
        FROM threat_model.threats t
        JOIN threat_model.threat_models tm ON t.threat_model_id = tm.id
        WHERE tm.project_id = $1
        GROUP BY t.status
      `;
      const threatsResult = await client.query(threatsQuery, [projectId]);
      
      // Count vulnerabilities by severity
      const vulnerabilitiesQuery = `
        SELECT 
          v.severity,
          COUNT(*)::int as count
        FROM threat_model.vulnerabilities v
        JOIN threat_model.components c ON v.component_id = c.id
        JOIN threat_model.project_components pc ON c.id = pc.component_id
        WHERE pc.project_id = $1
        GROUP BY v.severity
      `;
      const vulnerabilitiesResult = await client.query(vulnerabilitiesQuery, [projectId]);
      
      // Count security incidents by severity
      const incidentsQuery = `
        SELECT 
          severity,
          COUNT(*)::int as count
        FROM threat_model.security_incidents
        WHERE project_id = $1
        GROUP BY severity
      `;
      const incidentsResult = await client.query(incidentsQuery, [projectId]);
      
      // Format the results
      const threatsByStatus = {};
      threatsResult.rows.forEach(row => {
        threatsByStatus[row.status] = row.count;
      });
      
      const vulnerabilitiesBySeverity = {};
      vulnerabilitiesResult.rows.forEach(row => {
        vulnerabilitiesBySeverity[row.severity] = row.count;
      });
      
      const incidentsBySeverity = {};
      incidentsResult.rows.forEach(row => {
        incidentsBySeverity[row.severity] = row.count;
      });
      
      return {
        components: componentsResult.rows[0].component_count,
        threatModels: threatModelsResult.rows[0].threat_model_count,
        threats: threatsByStatus,
        vulnerabilities: vulnerabilitiesBySeverity,
        incidents: incidentsBySeverity
      };
    });
  }
}

module.exports = Project;
