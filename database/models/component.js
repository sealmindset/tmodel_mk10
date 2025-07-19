/**
 * Component Model
 * 
 * Provides data access methods for system components in the database
 */
const db = require('../index');

class Component {
  /**
   * Create a new component
   * 
   * @param {Object} componentData - Component data
   * @returns {Promise<Object>} - Created component
   */
  static async create(componentData) {
    const { name, type, description, version, is_reusable = true, tags = [], created_by } = componentData;
    
    const query = `
      INSERT INTO threat_model.components 
        (name, type, description, version, is_reusable, tags, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [name, type, description, version, is_reusable, tags, created_by];
    const result = await db.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get component by ID
   * 
   * @param {string} id - Component ID
   * @returns {Promise<Object>} - Component data
   */
  static async getById(id) {
    const query = 'SELECT * FROM threat_model.components WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
  
  /**
   * Get all components
   * 
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of components
   */
  static async getAll(filters = {}) {
    const { type, is_reusable, tag } = filters;
    let query = 'SELECT * FROM threat_model.components';
    const values = [];
    
    // Add filters if provided
    const conditions = [];
    if (type) {
      conditions.push(`type = $${values.length + 1}`);
      values.push(type);
    }
    
    if (is_reusable !== undefined) {
      conditions.push(`is_reusable = $${values.length + 1}`);
      values.push(is_reusable);
    }
    
    if (tag) {
      conditions.push(`$${values.length + 1} = ANY(tags)`);
      values.push(tag);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY type, name';
    
    const result = await db.query(query, values);
    return result.rows;
  }
  
  /**
   * Update a component
   * 
   * @param {string} id - Component ID
   * @param {Object} componentData - Component data to update
   * @returns {Promise<Object>} - Updated component
   */
  static async update(id, componentData) {
    const { name, type, description, version, is_reusable, tags } = componentData;
    
    const query = `
      UPDATE threat_model.components
      SET 
        name = $1,
        type = $2,
        description = $3,
        version = $4,
        is_reusable = $5,
        tags = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    
    const values = [
      name, 
      type, 
      description, 
      version, 
      is_reusable, 
      tags,
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
  static async delete(id) {
    const query = 'DELETE FROM threat_model.components WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Get safeguards for a component
   * 
   * @param {string} componentId - Component ID
   * @returns {Promise<Array>} - Component safeguards
   */
  static async getSafeguards(componentId) {
    try {
      // First check if the component_safeguards table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'threat_model' 
          AND table_name = 'component_safeguards'
        );
      `;
      
      const tableExists = await db.query(tableCheckQuery);
      
      if (!tableExists.rows[0].exists) {
        console.log('Warning: threat_model.component_safeguards table does not exist');
        return [];
      }
      
      const query = `
        SELECT s.*, cs.status, cs.notes 
        FROM threat_model.safeguards s
        JOIN threat_model.component_safeguards cs ON s.id = cs.safeguard_id
        WHERE cs.component_id = $1
      `;
      
      const result = await db.query(query, [componentId]);
      return result.rows;
    } catch (error) {
      console.error('Error in getSafeguards:', error);
      return [];
    }
  }
  
  /**
   * Add a safeguard to a component
   * 
   * @param {string} componentId - Component ID
   * @param {Object} safeguardData - Safeguard data or ID
   * @param {string} status - Implementation status
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} - Junction record
   */
  static async addSafeguard(componentId, safeguardData, status = 'Implemented', notes = null) {
    try {
      // First check if the component_safeguards table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'threat_model' 
          AND table_name = 'component_safeguards'
        );
      `;
      
      const tableExists = await db.query(tableCheckQuery);
      
      if (!tableExists.rows[0].exists) {
        throw new Error('threat_model.component_safeguards table does not exist');
      }
      
      // Handle both safeguard ID and safeguard data object
      let safeguardId;
      
      if (typeof safeguardData === 'string') {
        // If safeguardData is a string, treat it as an ID
        safeguardId = safeguardData;
      } else {
        // If safeguardData is an object, create a new safeguard
        const { name, type, description } = safeguardData;
        
        // Check if a safeguard with this name already exists
        const existingQuery = 'SELECT id FROM threat_model.safeguards WHERE name = $1';
        const existingResult = await db.query(existingQuery, [name]);
        
        if (existingResult.rows.length > 0) {
          safeguardId = existingResult.rows[0].id;
        } else {
          // Create a new safeguard
          const createQuery = `
            INSERT INTO threat_model.safeguards (name, type, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `;
          
          const createValues = [name, type, description, safeguardData.created_by || 'system'];
          const createResult = await db.query(createQuery, createValues);
          safeguardId = createResult.rows[0].id;
        }
      }
      
      // Now add the association
      const query = `
        INSERT INTO threat_model.component_safeguards
          (component_id, safeguard_id, status, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (component_id, safeguard_id) 
        DO UPDATE SET status = $3, notes = $4
        RETURNING *
      `;
      
      const values = [componentId, safeguardId, status, notes];
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error in addSafeguard:', error);
      throw error;
    }
  }
  
  /**
   * Remove a safeguard from a component
   * 
   * @param {string} componentId - Component ID
   * @param {string} safeguardId - Safeguard ID
   * @returns {Promise<boolean>} - True if removed
   */
  static async removeSafeguard(componentId, safeguardId) {
    try {
      // First check if the component_safeguards table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'threat_model' 
          AND table_name = 'component_safeguards'
        );
      `;
      
      const tableExists = await db.query(tableCheckQuery);
      
      if (!tableExists.rows[0].exists) {
        console.log('Warning: threat_model.component_safeguards table does not exist');
        return false;
      }
      
      const query = `
        DELETE FROM threat_model.component_safeguards 
        WHERE component_id = $1 AND safeguard_id = $2
      `;
      
      const result = await db.query(query, [componentId, safeguardId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error in removeSafeguard:', error);
      return false;
    }
  }

  /**
   * Update a safeguard for a component
   * 
   * @param {string} componentId - Component ID
   * @param {string} safeguardId - Safeguard ID
   * @param {Object} safeguardData - Safeguard data to update
   * @param {string} status - Implementation status
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} - Updated safeguard
   */
  static async updateSafeguard(componentId, safeguardId, safeguardData, status, notes) {
    try {
      // First update the safeguard record itself
      const { name, type, description } = safeguardData;
      
      const safeguardQuery = `
        UPDATE threat_model.safeguards
        SET 
          name = $1,
          type = $2,
          description = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      
      const safeguardValues = [name, type, description, safeguardId];
      const safeguardResult = await db.query(safeguardQuery, safeguardValues);
      
      if (safeguardResult.rowCount === 0) {
        throw new Error('Safeguard not found');
      }
      
      // Then update the junction table with status and notes
      const junctionQuery = `
        UPDATE threat_model.component_safeguards
        SET 
          status = $1,
          notes = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE component_id = $3 AND safeguard_id = $4
        RETURNING *
      `;
      
      const junctionValues = [status, notes, componentId, safeguardId];
      const junctionResult = await db.query(junctionQuery, junctionValues);
      
      if (junctionResult.rowCount === 0) {
        throw new Error('Safeguard not associated with this component');
      }
      
      // Return the updated safeguard with status and notes
      return {
        ...safeguardResult.rows[0],
        status: junctionResult.rows[0].status,
        notes: junctionResult.rows[0].notes
      };
    } catch (error) {
      console.error('Error updating safeguard:', error);
      throw error;
    }
  }
  
  /**
   * Get vulnerabilities for a component
   * 
   * @param {string} componentId - Component ID
   * @returns {Promise<Array>} - Component vulnerabilities
   */
  static async getVulnerabilities(componentId) {
    try {
      // Check if the component_vulnerabilities table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'threat_model' 
          AND table_name = 'component_vulnerabilities'
        );
      `;
      
      const tableExists = await db.query(tableCheckQuery);
      
      if (!tableExists.rows[0].exists) {
        // Fall back to the old schema if the new table doesn't exist
        const oldQuery = `
          SELECT * FROM threat_model.vulnerabilities
          WHERE component_id = $1
          ORDER BY severity, created_at DESC
        `;
        
        const oldResult = await db.query(oldQuery, [componentId]);
        return oldResult.rows;
      }
      
      // Use the new schema with the junction table
      const query = `
        SELECT v.*, cv.status, cv.notes 
        FROM threat_model.vulnerabilities v
        JOIN threat_model.component_vulnerabilities cv ON v.id = cv.vulnerability_id
        WHERE cv.component_id = $1
        ORDER BY v.severity, v.created_at DESC
      `;
      
      const result = await db.query(query, [componentId]);
      return result.rows;
    } catch (error) {
      console.error('Error in getVulnerabilities:', error);
      return [];
    }
  }
  
  /**
   * Get projects using this component
   * 
   * @param {string} componentId - Component ID
   * @returns {Promise<Array>} - Projects using this component
   */
  static async getProjects(componentId) {
    const query = `
      SELECT p.* 
      FROM threat_model.projects p
      JOIN threat_model.project_components pc ON p.id = pc.project_id
      WHERE pc.component_id = $1
    `;
    
    const result = await db.query(query, [componentId]);
    return result.rows;
  }
  
  /**
   * Get threats associated with this component
   * 
   * @param {string} componentId - Component ID
   * @returns {Promise<Array>} - Threats for this component
   */
  static async getThreats(componentId) {
    const query = `
      SELECT * FROM threat_model.threats
      WHERE component_id = $1
      ORDER BY risk_score DESC
    `;
    
    const result = await db.query(query, [componentId]);
    return result.rows;
  }
  
  /**
   * Get component statistics
   * 
   * @param {string} componentId - Component ID
   * @returns {Promise<Object>} - Component statistics
   */
  static async getStatistics(componentId) {
    try {
      return db.transaction(async (client) => {
        // Count projects using this component
        const projectsQuery = `
          SELECT COUNT(*)::int as project_count
          FROM threat_model.project_components
          WHERE component_id = $1
        `;
        const projectsResult = await client.query(projectsQuery, [componentId]);
        
        // Check if component_safeguards table exists
        const safeguardsTableCheckQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'threat_model' 
            AND table_name = 'component_safeguards'
          );
        `;
        
        const safeguardsTableExists = await client.query(safeguardsTableCheckQuery);
        
        // Count safeguards if table exists
        let safeguardCount = 0;
        if (safeguardsTableExists.rows[0].exists) {
          const safeguardsQuery = `
            SELECT COUNT(*)::int as safeguard_count
            FROM threat_model.component_safeguards
            WHERE component_id = $1
          `;
          const safeguardsResult = await client.query(safeguardsQuery, [componentId]);
          safeguardCount = safeguardsResult.rows[0].safeguard_count;
        }
        
        // Check if component_vulnerabilities table exists
        const vulnTableCheckQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'threat_model' 
            AND table_name = 'component_vulnerabilities'
          );
        `;
        
        const vulnTableExists = await client.query(vulnTableCheckQuery);
        
        // Count vulnerabilities by severity
        let vulnerabilitiesResult;
        if (vulnTableExists.rows[0].exists) {
          // Use the new schema with junction table
          const vulnerabilitiesQuery = `
            SELECT 
              v.severity,
              COUNT(*)::int as count
            FROM threat_model.vulnerabilities v
            JOIN threat_model.component_vulnerabilities cv ON v.id = cv.vulnerability_id
            WHERE cv.component_id = $1
            GROUP BY v.severity
          `;
          vulnerabilitiesResult = await client.query(vulnerabilitiesQuery, [componentId]);
        } else {
          // Fall back to the old schema
          const vulnerabilitiesQuery = `
            SELECT 
              severity,
              COUNT(*)::int as count
            FROM threat_model.vulnerabilities
            WHERE component_id = $1
            GROUP BY severity
          `;
          vulnerabilitiesResult = await client.query(vulnerabilitiesQuery, [componentId]);
        }
        
        // Get threat models associated with this component through projects
        const threatModelsQuery = `
          SELECT DISTINCT tm.id
          FROM threat_model.threat_models tm
          JOIN threat_model.project_components pc ON tm.project_id = pc.project_id
          WHERE pc.component_id = $1
        `;
        const threatModelsResult = await client.query(threatModelsQuery, [componentId]);
        
        // Count threats by risk score if we have associated threat models
        let threatsByRiskLevel = {};
        if (threatModelsResult.rows.length > 0) {
          // Extract threat model IDs
          const threatModelIds = threatModelsResult.rows.map(row => row.id);
          
          // Only proceed if we actually have threat model IDs
          if (threatModelIds.length > 0) {
            // Build the IN clause for the query
            const placeholders = threatModelIds.map((_, i) => `$${i + 1}`).join(', ');
            
            const threatsQuery = `
              SELECT 
                CASE 
                  WHEN risk_score >= 20 THEN 'Critical'
                  WHEN risk_score >= 15 THEN 'High'
                  WHEN risk_score >= 8 THEN 'Medium'
                  ELSE 'Low'
                END as risk_level,
                COUNT(*)::int as count
              FROM threat_model.threats
              WHERE threat_model_id IN (${placeholders})
              GROUP BY CASE 
                  WHEN risk_score >= 20 THEN 'Critical'
                  WHEN risk_score >= 15 THEN 'High'
                  WHEN risk_score >= 8 THEN 'Medium'
                  ELSE 'Low'
                END
            `;
            
            const threatsResult = await client.query(threatsQuery, threatModelIds);
            
            // Format the threats by risk level
            threatsResult.rows.forEach(row => {
              threatsByRiskLevel[row.risk_level] = row.count;
            });
          }
        }
        
        // Format the vulnerabilities by severity
        const vulnerabilitiesBySeverity = {};
        vulnerabilitiesResult.rows.forEach(row => {
          vulnerabilitiesBySeverity[row.severity] = row.count;
        });
        
        return {
          projects: projectsResult.rows[0].project_count,
          safeguards: safeguardCount,
          vulnerabilities: vulnerabilitiesBySeverity,
          threats: threatsByRiskLevel
        };
      });
    } catch (error) {
      console.error('Error in getStatistics:', error);
      // Return default empty statistics
      return {
        projects: 0,
        safeguards: 0,
        vulnerabilities: {},
        threats: {}
      };
    }
  }
}

module.exports = Component;
